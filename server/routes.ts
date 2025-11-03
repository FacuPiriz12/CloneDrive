import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { setupAuth, isAuthenticated, isAdmin } from "./replitAuth";
import { GoogleDriveService } from "./services/googleDriveService";
import { DropboxService } from "./services/dropboxService";
import { getQueueWorker } from "./queueWorker";
import { insertCloudFileSchema, insertCopyOperationSchema } from "@shared/schema";
import { z } from "zod";
import { google } from "googleapis";
import crypto from "crypto";

// Utility function to compute redirect URI consistently across all OAuth flows
function getOAuthRedirectUri(req: any, path: string): string {
  // On Replit, use HTTPS with the dev domain; locally use request protocol/host
  const domain = process.env.REPLIT_DEV_DOMAIN;
  if (domain) {
    return `https://${domain}${path}`;
  }
  
  // Fallback for local development
  const protocol = req.protocol;
  const host = req.get('host') || 'localhost:5000';
  return `${protocol}://${host}${path}`;
}

// Utility function to detect provider from URL
function detectProviderFromUrl(sourceUrl: string): 'google' | 'dropbox' | null {
  try {
    const url = new URL(sourceUrl.toLowerCase());
    
    // Google Drive detection (case-insensitive)
    if (url.hostname.includes('drive.google.com') || 
        url.hostname.includes('docs.google.com') ||
        url.hostname.includes('sheets.google.com') ||
        url.hostname.includes('slides.google.com')) {
      return 'google';
    }
    
    // Dropbox detection (case-insensitive)
    if (url.hostname.includes('dropbox.com') || 
        url.hostname.includes('db.tt')) {
      return 'dropbox';
    }
    
    return null;
  } catch (error) {
    return null;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Trust proxy for correct protocol/host detection behind load balancers
  app.set('trust proxy', 1);
  
  // Supabase config endpoint for frontend
  app.get('/api/config/supabase', (req, res) => {
    res.json({
      url: process.env.SUPABASE_URL || '',
      anonKey: process.env.SUPABASE_ANON_KEY || ''
    });
  });

  
  // Auth middleware
  await setupAuth(app);

  // Auth routes
  // Ruta para verificar el estado de la sesión (debug)
  app.get('/api/session-status', (req, res) => {
    res.json({
      sessionId: req.sessionID,
      devLoggedIn: req.session?.devLoggedIn,
      hasUser: !!req.user,
      nodeEnv: process.env.NODE_ENV
    });
  });
  
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      let user = await storage.getUser(userId);
      
      // If user doesn't exist in database, create it (especially for development mode)
      if (!user) {
        const userData: any = {
          id: userId,
          email: req.user.claims.email,
          firstName: req.user.claims.first_name,
          lastName: req.user.claims.last_name,
          profileImageUrl: req.user.claims.profile_image_url,
        };
        
        // In development, dev-user-123 is always admin
        if (process.env.NODE_ENV === "development" && userId === "dev-user-123") {
          userData.role = 'admin';
        }
        
        user = await storage.upsertUser(userData);
      }
      
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // Update user information
  app.patch('/api/user/update', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body
      const updateSchema = z.object({
        firstName: z.string().min(1, "El nombre es requerido").max(50, "El nombre es muy largo").optional(),
        lastName: z.string().min(1, "El apellido es requerido").max(50, "El apellido es muy largo").optional(),
        email: z.string().email("Email inválido").optional(),
        profileImageUrl: z.string().url("URL de imagen inválida").optional()
      });

      const validation = updateSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Datos de usuario inválidos",
          errors: validation.error.errors
        });
      }

      // Check if user exists
      const existingUser = await storage.getUser(userId);
      if (!existingUser) {
        return res.status(404).json({ message: "Usuario no encontrado" });
      }

      // Update user information
      const updatedUser = await storage.updateUser(userId, validation.data);
      
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user:", error);
      
      // Handle specific database errors
      if (error instanceof Error) {
        if (error.message.includes('unique constraint') || error.message.includes('UNIQUE constraint')) {
          return res.status(409).json({ 
            message: "El email ya está en uso por otro usuario",
            code: "EMAIL_ALREADY_EXISTS"
          });
        }
        if (error.message.includes('User not found')) {
          return res.status(404).json({ message: "Usuario no encontrado" });
        }
      }
      
      res.status(500).json({ message: "Error al actualizar la información del usuario" });
    }
  });

  // Drive files routes
  app.get('/api/drive-files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      
      const result = await storage.getUserCloudFiles(userId, page, limit);
      res.json(result);
    } catch (error) {
      console.error("Error fetching drive files:", error);
      res.status(500).json({ message: "Failed to fetch drive files" });
    }
  });

  // Copy operations routes
  app.get('/api/copy-operations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const operations = await storage.getUserCopyOperations(userId);
      res.json(operations);
    } catch (error) {
      console.error("Error fetching copy operations:", error);
      res.status(500).json({ message: "Failed to fetch copy operations" });
    }
  });

  app.post('/api/copy-operations', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate provider before creating operation
      const provider = detectProviderFromUrl(req.body.sourceUrl);
      if (!provider) {
        return res.status(400).json({ 
          message: "Unsupported URL format - only Google Drive and Dropbox URLs are supported"
        });
      }
      

      const validation = insertCopyOperationSchema.parse({
        ...req.body,
        userId,
        status: 'pending',
      });

      const operation = await storage.createCopyOperation(validation);
      res.json(operation);

      // Start copy process in background with error handling based on provider
      if (provider === 'google') {
        const driveService = new GoogleDriveService(userId);
        // Wrap in try-catch to handle background errors
        setImmediate(async () => {
          try {
            await driveService.startCopyOperation(operation.id, validation.sourceUrl);
          } catch (error) {
            console.error(`Google Drive copy operation ${operation.id} failed:`, error);
            await storage.updateCopyOperationStatus(operation.id, 'failed', error instanceof Error ? error.message : 'Unknown error occurred');
          }
        });
      } else if (provider === 'dropbox') {
        const dropboxService = new DropboxService(userId);
        // Wrap in try-catch to handle background errors
        setImmediate(async () => {
          try {
            await dropboxService.startCopyOperation(operation.id, validation.sourceUrl);
          } catch (error) {
            console.error(`Dropbox copy operation ${operation.id} failed:`, error);
            await storage.updateCopyOperationStatus(operation.id, 'failed', error instanceof Error ? error.message : 'Unknown error occurred');
          }
        });
      }
    } catch (error) {
      console.error("Error creating copy operation:", error);
      res.status(500).json({ message: "Failed to create copy operation" });
    }
  });

  app.get('/api/copy-operations/:id', isAuthenticated, async (req: any, res) => {
    try {
      const { id } = req.params;
      const operation = await storage.getCopyOperation(id);
      
      if (!operation) {
        return res.status(404).json({ message: "Copy operation not found" });
      }

      // Check if user owns this operation
      const userId = req.user.claims.sub;
      if (operation.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json(operation);
    } catch (error) {
      console.error("Error fetching copy operation:", error);
      res.status(500).json({ message: "Failed to fetch copy operation" });
    }
  });

  // Preview route for copy operations
  app.post('/api/copy-operations/preview', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const previewSchema = z.object({
        sourceUrl: z.string().url("Invalid URL format").min(1, "Source URL is required")
      });
      
      const validation = previewSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }

      const { sourceUrl } = validation.data;
      
      // Detect provider and get preview from appropriate service
      const provider = detectProviderFromUrl(sourceUrl);
      
      let preview;
      if (provider === 'google') {
        const driveService = new GoogleDriveService(userId);
        preview = await driveService.getOperationPreview(sourceUrl);
      } else if (provider === 'dropbox') {
        const dropboxService = new DropboxService(userId);
        preview = await dropboxService.getOperationPreview(sourceUrl);
      } else {
        return res.status(400).json({ 
          message: "Unsupported URL format - only Google Drive and Dropbox URLs are supported"
        });
      }
      
      res.json(preview);
    } catch (error) {
      console.error("Error getting copy operation preview:", error);
      
      // Provide more specific error messages based on the actual errors thrown
      if (error instanceof Error) {
        // Google Drive specific errors
        if (error.message.includes('Invalid Google Drive URL')) {
          return res.status(400).json({ message: "Invalid Google Drive URL format" });
        }
        if (error.message.includes('Google Drive access expired')) {
          return res.status(401).json({ message: "Google Drive access expired. Please reconnect your account." });
        }
        
        // Dropbox specific errors
        if (error.message.includes('Invalid Dropbox URL')) {
          return res.status(400).json({ message: "Invalid Dropbox URL format" });
        }
        if (error.message.includes('Dropbox access token has expired')) {
          return res.status(401).json({ message: "Dropbox access expired. Please reconnect your account." });
        }
        
        // Generic errors that apply to both
        if (error.message.includes('access token has expired')) {
          return res.status(401).json({ message: "Cloud storage access expired. Please reconnect your account." });
        }
        if (error.message.includes('not connected')) {
          return res.status(401).json({ message: "Cloud storage account not connected" });
        }
        if (error.message.includes('shared link not found') || error.message.includes('not_found')) {
          return res.status(404).json({ message: "Shared file or folder not found" });
        }
      }
      
      res.status(500).json({ message: "Failed to get operation preview" });
    }
  });

  // Google Drive API routes
  app.post('/api/drive/parse-url', isAuthenticated, async (req: any, res) => {
    try {
      const { url } = req.body;
      const userId = req.user.claims.sub;
      const driveService = new GoogleDriveService(userId);
      const fileInfo = await driveService.parseGoogleDriveUrl(url);
      res.json(fileInfo);
    } catch (error) {
      console.error("Error parsing Drive URL:", error);
      res.status(500).json({ message: "Failed to parse Drive URL" });
    }
  });

  app.post('/api/drive/list-files', isAuthenticated, async (req: any, res) => {
    try {
      const { fileId } = req.body;
      const userId = req.user.claims.sub;
      const driveService = new GoogleDriveService(userId);
      const files = await driveService.listFiles(fileId);
      res.json(files);
    } catch (error) {
      console.error("Error listing Drive files:", error);
      res.status(500).json({ message: "Failed to list Drive files" });
    }
  });

  // Get folders for folder browser
  app.get('/api/drive/folders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const parentId = req.query.parentId || 'root';
      const pageToken = req.query.pageToken;
      
      const driveService = new GoogleDriveService(userId);
      const result = await driveService.listFolders(parentId, pageToken);
      
      res.json(result);
    } catch (error) {
      console.error("Error listing Drive folders:", error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('access token has expired')) {
          return res.status(401).json({ message: "Google Drive access expired. Please reconnect your account." });
        }
        if (error.message.includes('not connected')) {
          return res.status(401).json({ message: "Google Drive account not connected" });
        }
      }
      
      res.status(500).json({ message: "Failed to list Drive folders" });
    }
  });

  // Get folder path for breadcrumbs
  app.get('/api/drive/folders/:id/path', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const folderId = req.params.id;
      
      const driveService = new GoogleDriveService(userId);
      const path = await driveService.getFolderPath(folderId);
      
      res.json({ path });
    } catch (error) {
      console.error("Error getting folder path:", error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('access token has expired')) {
          return res.status(401).json({ message: "Google Drive access expired. Please reconnect your account." });
        }
        if (error.message.includes('not connected')) {
          return res.status(401).json({ message: "Google Drive account not connected" });
        }
      }
      
      res.status(500).json({ message: "Failed to get folder path" });
    }
  });

  // Google Drive upload route
  app.post('/api/drive/upload', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { filename, content, parentFolderId, mimeType } = req.body;

      // Validate required fields
      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ message: "Valid filename is required" });
      }
      if (content === undefined || content === null) {
        return res.status(400).json({ message: "File content is required" });
      }

      // Validate parent folder ID parameter
      if (parentFolderId !== undefined && typeof parentFolderId !== 'string') {
        return res.status(400).json({ message: "Invalid parent folder ID parameter" });
      }

      // Validate filename
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: "Invalid filename format" });
      }

      // Convert content to ArrayBuffer for service compatibility
      let contentBuffer: ArrayBuffer;
      if (typeof content === 'string') {
        // Convert string content to ArrayBuffer
        const encoder = new TextEncoder();
        contentBuffer = encoder.encode(content).buffer;
      } else if (content instanceof ArrayBuffer) {
        contentBuffer = content;
      } else {
        // Convert other types to JSON string then to ArrayBuffer  
        const encoder = new TextEncoder();
        contentBuffer = encoder.encode(JSON.stringify(content)).buffer;
      }

      // Validate file size (Google Drive supports up to 5TB with resumable uploads)
      const contentSize = contentBuffer.byteLength;
      const maxSize = 5 * 1024 * 1024 * 1024 * 1024; // 5TB limit for resumable uploads
      if (contentSize > maxSize) {
        return res.status(413).json({ message: "File too large. Maximum size is 5TB." });
      }

      const driveService = new GoogleDriveService(userId);
      const file = await driveService.uploadFile(filename, contentBuffer, parentFolderId, mimeType);

      console.log("File uploaded successfully to Google Drive:", { userId, filename, size: contentSize });
      res.json(file);
    } catch (error) {
      console.error("Error uploading file to Google Drive:", error, { 
        userId: req.user.claims.sub, 
        filename: req.body.filename 
      });
      
      if (error instanceof Error) {
        // Handle specific Google Drive API errors
        if (error.message.includes('access token has expired') || error.message.includes('expired access token')) {
          return res.status(401).json({ 
            message: "Google Drive access expired. Please reconnect your account.",
            action: "reconnect_required"
          });
        }
        if (error.message.includes('not connected') || error.message.includes('User has not connected')) {
          return res.status(401).json({ 
            message: "Google Drive account not connected",
            action: "connect_required"
          });
        }
        if (error.message.includes('insufficient_space') || error.message.includes('storage_quota')) {
          return res.status(507).json({ message: "Insufficient storage space in Google Drive account" });
        }
        if (error.message.includes('file_already_exists') || error.message.includes('already exists')) {
          return res.status(409).json({ message: "File already exists at this location" });
        }
        if (error.message.includes('invalid_path') || error.message.includes('path_not_found')) {
          return res.status(404).json({ message: "Upload path not found in Google Drive" });
        }
        if (error.message.includes('rate_limit') || error.message.includes('too_many_requests')) {
          return res.status(429).json({ message: "Rate limit exceeded. Please try again later." });
        }
        if (error.message.includes('file_size_error') || error.message.includes('too large')) {
          return res.status(413).json({ message: "File size exceeds Google Drive limits" });
        }
        if (error.message.includes('invalid_file_name') || error.message.includes('disallowed_name')) {
          return res.status(400).json({ message: "Invalid or disallowed filename" });
        }
      }
      
      res.status(500).json({ 
        message: "Failed to upload file to Google Drive",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Google OAuth Configuration
  const getGoogleOAuth2Client = (req?: any) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = req ? 
      getOAuthRedirectUri(req, '/api/auth/google/callback') :
      `https://${process.env.REPLIT_DEV_DOMAIN || 'localhost:5000'}/api/auth/google/callback`;
    
    return new google.auth.OAuth2(clientId, clientSecret, redirectUri);
  };

  // Google OAuth routes
  app.get('/api/auth/google', isAuthenticated, (req: any, res) => {
    try {
      const oauth2Client = getGoogleOAuth2Client(req);
      
      // Generate random state for CSRF protection (like Dropbox)
      const state = crypto.randomBytes(16).toString('hex');
      req.session.googleOAuthState = state;
      req.session.googleUserId = req.user.claims.sub;
      
      const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        prompt: 'consent',
        scope: [
          'https://www.googleapis.com/auth/drive',
          'https://www.googleapis.com/auth/drive.file',
          'https://www.googleapis.com/auth/gmail.send'
        ],
        state: state
      });

      res.redirect(authUrl);
    } catch (error) {
      console.error("Error starting Google OAuth:", error);
      res.status(500).json({ message: "Failed to start Google OAuth" });
    }
  });

  app.get('/api/auth/google/callback', isAuthenticated, async (req: any, res) => {
    try {
      const { code, state } = req.query;
      
      if (!code) {
        // Clean up session on error
        delete req.session.googleOAuthState;
        delete req.session.googleUserId;
        return res.redirect('/?google_auth=error&reason=no_code');
      }

      // Validate state parameter for CSRF protection (improved)
      const expectedState = req.session.googleOAuthState;
      const sessionUserId = req.session.googleUserId;
      
      if (state !== expectedState || sessionUserId !== req.user.claims.sub) {
        console.error("Invalid state parameter in Google OAuth callback", {
          expectedState,
          receivedState: state,
          expectedUserId: sessionUserId,
          receivedUserId: req.user.claims.sub
        });
        // Clean up session on error
        delete req.session.googleOAuthState;
        delete req.session.googleUserId;
        return res.redirect('/?google_auth=error&reason=invalid_state');
      }

      // Clean up session
      delete req.session.googleOAuthState;
      delete req.session.googleUserId;

      const oauth2Client = getGoogleOAuth2Client(req);
      const { tokens } = await oauth2Client.getToken(code as string);

      // Use user ID from authenticated session, not from state parameter
      const userId = req.user.claims.sub;

      // Save tokens to database
      await storage.updateUserGoogleTokens(userId, {
        accessToken: tokens.access_token!,
        refreshToken: tokens.refresh_token,
        expiry: tokens.expiry_date ? new Date(tokens.expiry_date) : undefined
      });

      // Redirect back to frontend with success
      res.redirect('/?google_auth=success');
    } catch (error) {
      console.error("Error in Google OAuth callback:", error);
      
      // Check for specific OAuth errors and provide helpful instructions
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('redirect_uri_mismatch')) {
        const domain = process.env.REPLIT_DEV_DOMAIN || req.get('host') || 'localhost:5000';
        const protocol = req.protocol;
        const redirectUri = `${protocol}://${domain}/api/auth/google/callback`;
        console.error(`Google OAuth redirect_uri_mismatch. Add this URL to Google Cloud Console: ${redirectUri}`);
        return res.redirect(`/?google_auth=error&reason=redirect_mismatch&domain=${encodeURIComponent(domain)}`);
      }
      
      if (errorMessage.includes('invalid_client') || errorMessage.includes('unauthorized_client')) {
        console.error('Google OAuth client configuration error. Check GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET.');
        return res.redirect('/?google_auth=error&reason=invalid_client');
      }
      
      res.redirect('/?google_auth=error');
    }
  });

  // Check Google connection status
  app.get('/api/auth/google/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      res.json({
        connected: user?.googleConnected || false,
        hasValidToken: user?.googleAccessToken && user?.googleTokenExpiry && 
                      new Date(user.googleTokenExpiry) > new Date()
      });
    } catch (error) {
      console.error("Error checking Google auth status:", error);
      res.status(500).json({ message: "Failed to check Google auth status" });
    }
  });

  // Disconnect Google account
  app.delete('/api/auth/google', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.updateUserGoogleTokens(userId, {
        accessToken: null,
        refreshToken: null,
        expiry: null
      });

      res.json({ message: "Google account disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Google account:", error);
      res.status(500).json({ message: "Failed to disconnect Google account" });
    }
  });

  // Dropbox OAuth routes
  app.get('/api/auth/dropbox', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const protocol = req.protocol;
      const host = req.get('host');
      const redirectUri = `${protocol}://${host}/api/auth/dropbox/callback`;
      
      // Generate random state and store in session
      const state = crypto.randomBytes(16).toString('hex');
      req.session.dropboxOAuthState = state;
      req.session.dropboxUserId = userId;

      const dropboxService = new DropboxService(userId);
      const authUrl = await dropboxService.getAuthUrl(redirectUri, state);

      res.redirect(authUrl);
    } catch (error) {
      console.error("Error starting Dropbox OAuth:", error);
      res.status(500).json({ message: "Failed to start Dropbox OAuth" });
    }
  });

  app.get('/api/auth/dropbox/callback', isAuthenticated, async (req: any, res) => {
    try {
      const { code, state, error: oauthError, error_description } = req.query;
      
      // Handle OAuth errors from Dropbox
      if (oauthError) {
        console.error("Dropbox OAuth error:", oauthError, error_description);
        // Clean up session on error
        delete req.session.dropboxOAuthState;
        delete req.session.dropboxUserId;
        const errorType = oauthError === 'access_denied' ? 'denied' : 'error';
        return res.redirect(`/?dropbox_auth=error&reason=${errorType}`);
      }
      
      if (!code) {
        console.error("Authorization code not provided in Dropbox callback");
        // Clean up session on error
        delete req.session.dropboxOAuthState;
        delete req.session.dropboxUserId;
        return res.redirect('/?dropbox_auth=error&reason=no_code');
      }

      // Validate state parameter for CSRF protection
      const expectedState = req.session.dropboxOAuthState;
      const sessionUserId = req.session.dropboxUserId;
      
      if (state !== expectedState || sessionUserId !== req.user.claims.sub) {
        console.error("Invalid state parameter in Dropbox OAuth callback", { 
          expectedState, 
          receivedState: state, 
          expectedUserId: sessionUserId, 
          receivedUserId: req.user.claims.sub 
        });
        // Clean up session on error
        delete req.session.dropboxOAuthState;
        delete req.session.dropboxUserId;
        return res.redirect('/?dropbox_auth=error&reason=invalid_state');
      }

      // Clean up session
      delete req.session.dropboxOAuthState;
      delete req.session.dropboxUserId;
      
      const userId = req.user.claims.sub;
      const protocol = req.protocol;
      const host = req.get('host');
      const redirectUri = `${protocol}://${host}/api/auth/dropbox/callback`;
      
      const dropboxService = new DropboxService(userId);
      const tokenData = await dropboxService.exchangeCodeForToken(redirectUri, code as string);

      // Save tokens to database
      await storage.updateUserDropboxTokens(userId, {
        accessToken: tokenData.accessToken,
        refreshToken: tokenData.refreshToken || null,
        expiry: tokenData.expiresAt || null
      });

      console.log("Dropbox OAuth completed successfully for user:", userId);
      // Redirect back to frontend with success
      res.redirect('/?dropbox_auth=success');
    } catch (error) {
      console.error("Error in Dropbox OAuth callback:", error);
      
      // Clean up session on any error
      delete req.session.dropboxOAuthState;
      delete req.session.dropboxUserId;
      
      // Check for specific OAuth errors and provide helpful instructions
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      if (errorMessage.includes('redirect_uri') || errorMessage.includes('invalid_redirect')) {
        const domain = process.env.REPLIT_DEV_DOMAIN || req.get('host') || 'localhost:5000';
        const protocol = req.protocol;
        const redirectUri = `${protocol}://${domain}/api/auth/dropbox/callback`;
        console.error(`Dropbox OAuth redirect URI error. Add this URL to Dropbox App Console: ${redirectUri}`);
        return res.redirect(`/?dropbox_auth=error&reason=redirect_mismatch&domain=${encodeURIComponent(domain)}`);
      }
      
      if (errorMessage.includes('invalid_grant')) {
        return res.redirect('/?dropbox_auth=error&reason=expired_code');
      }
      
      if (errorMessage.includes('invalid_client') || errorMessage.includes('unauthorized_client')) {
        console.error('Dropbox OAuth client configuration error. Check DROPBOX_APP_KEY and DROPBOX_APP_SECRET.');
        return res.redirect('/?dropbox_auth=error&reason=invalid_client');
      }
      
      res.redirect('/?dropbox_auth=error&reason=unknown');
    }
  });

  // Check Dropbox connection status
  app.get('/api/auth/dropbox/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.error("User not found when checking Dropbox status:", userId);
        return res.status(404).json({ 
          message: "User not found",
          connected: false,
          hasValidToken: false
        });
      }
      
      const hasAccessToken = !!user.dropboxAccessToken;
      const hasRefreshToken = !!user.dropboxRefreshToken;
      const isTokenExpired = user.dropboxTokenExpiry && new Date(user.dropboxTokenExpiry) <= new Date();
      
      // Connected if we have either token
      const connected = hasAccessToken || hasRefreshToken;
      
      // Valid token if we have unexpired access token OR we have refresh token to get new access token
      const hasValidToken = (hasAccessToken && !isTokenExpired) || hasRefreshToken;
      
      res.json({
        connected,
        hasValidToken,
        // Add debug info for development
        ...(process.env.NODE_ENV === 'development' && {
          debug: {
            hasAccessToken,
            hasRefreshToken,
            isTokenExpired,
            tokenExpiry: user.dropboxTokenExpiry
          }
        })
      });
    } catch (error) {
      console.error("Error checking Dropbox auth status:", error);
      res.status(500).json({ 
        message: "Failed to check Dropbox auth status",
        connected: false,
        hasValidToken: false,
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Disconnect Dropbox account
  app.delete('/api/auth/dropbox', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        console.error("User not found when disconnecting Dropbox:", userId);
        return res.status(404).json({ message: "User not found" });
      }
      
      if (!user.dropboxConnected) {
        return res.status(400).json({ message: "Dropbox account is not connected" });
      }

      await storage.updateUserDropboxTokens(userId, {
        accessToken: null,
        refreshToken: null,
        expiry: null
      });

      console.log("Dropbox account disconnected successfully for user:", userId);
      res.json({ message: "Dropbox account disconnected successfully" });
    } catch (error) {
      console.error("Error disconnecting Dropbox account:", error);
      
      if (error instanceof Error && error.message.includes('not found')) {
        return res.status(404).json({ message: "User not found" });
      }
      
      res.status(500).json({ 
        message: "Failed to disconnect Dropbox account",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Dropbox API routes
  app.get('/api/dropbox/files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const path = req.query.path as string || '';

      // Validate path parameter
      if (typeof path !== 'string') {
        return res.status(400).json({ message: "Invalid path parameter" });
      }

      const dropboxService = new DropboxService(userId);
      const files = await dropboxService.listFiles(path);

      res.json(files);
    } catch (error) {
      console.error("Error listing Dropbox files:", error, { userId: req.user.claims.sub, path: req.query.path });
      
      if (error instanceof Error) {
        // Handle specific Dropbox API errors
        if (error.message.includes('access token has expired') || error.message.includes('expired access token')) {
          return res.status(401).json({ 
            message: "Dropbox access expired. Please reconnect your account.",
            action: "reconnect_required"
          });
        }
        if (error.message.includes('not connected') || error.message.includes('User has not connected')) {
          return res.status(401).json({ 
            message: "Dropbox account not connected",
            action: "connect_required"
          });
        }
        if (error.message.includes('path_not_found') || error.message.includes('not_found')) {
          return res.status(404).json({ message: "Folder or path not found in Dropbox" });
        }
        if (error.message.includes('insufficient_permissions') || error.message.includes('access_denied')) {
          return res.status(403).json({ message: "Insufficient permissions to access this folder" });
        }
        if (error.message.includes('rate_limit') || error.message.includes('too_many_requests')) {
          return res.status(429).json({ message: "Rate limit exceeded. Please try again later." });
        }
        if (error.message.includes('invalid_cursor')) {
          return res.status(400).json({ message: "Invalid folder listing cursor. Please refresh." });
        }
      }
      
      res.status(500).json({ 
        message: "Failed to list Dropbox files",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  app.post('/api/dropbox/upload', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { filename, content, path } = req.body;

      // Validate required fields
      if (!filename || typeof filename !== 'string') {
        return res.status(400).json({ message: "Valid filename is required" });
      }
      if (content === undefined || content === null) {
        return res.status(400).json({ message: "File content is required" });
      }

      // Validate path parameter
      if (path !== undefined && typeof path !== 'string') {
        return res.status(400).json({ message: "Invalid path parameter" });
      }

      // Validate filename
      if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
        return res.status(400).json({ message: "Invalid filename format" });
      }

      // Convert content to ArrayBuffer for service compatibility
      let contentBuffer: ArrayBuffer;
      if (typeof content === 'string') {
        // Convert string content to ArrayBuffer
        const encoder = new TextEncoder();
        contentBuffer = encoder.encode(content).buffer;
      } else if (content instanceof ArrayBuffer) {
        contentBuffer = content;
      } else {
        // Convert other types to JSON string then to ArrayBuffer  
        const encoder = new TextEncoder();
        contentBuffer = encoder.encode(JSON.stringify(content)).buffer;
      }

      // Validate file size (Dropbox supports up to 350GB with upload sessions)
      const contentSize = contentBuffer.byteLength;
      const maxSize = 350 * 1024 * 1024 * 1024; // 350GB limit for upload sessions
      if (contentSize > maxSize) {
        return res.status(413).json({ message: "File too large. Maximum size is 350GB." });
      }

      const dropboxService = new DropboxService(userId);
      const file = await dropboxService.uploadFile(filename, contentBuffer, path);

      console.log("File uploaded successfully to Dropbox:", { userId, filename, size: contentSize });
      res.json(file);
    } catch (error) {
      console.error("Error uploading file to Dropbox:", error, { 
        userId: req.user.claims.sub, 
        filename: req.body.filename 
      });
      
      if (error instanceof Error) {
        // Handle specific Dropbox API errors
        if (error.message.includes('access token has expired') || error.message.includes('expired access token')) {
          return res.status(401).json({ 
            message: "Dropbox access expired. Please reconnect your account.",
            action: "reconnect_required"
          });
        }
        if (error.message.includes('not connected') || error.message.includes('User has not connected')) {
          return res.status(401).json({ 
            message: "Dropbox account not connected",
            action: "connect_required"
          });
        }
        if (error.message.includes('insufficient_space') || error.message.includes('storage_quota')) {
          return res.status(507).json({ message: "Insufficient storage space in Dropbox account" });
        }
        if (error.message.includes('file_already_exists') || error.message.includes('already exists')) {
          return res.status(409).json({ message: "File already exists at this location" });
        }
        if (error.message.includes('invalid_path') || error.message.includes('path_not_found')) {
          return res.status(404).json({ message: "Upload path not found in Dropbox" });
        }
        if (error.message.includes('rate_limit') || error.message.includes('too_many_requests')) {
          return res.status(429).json({ message: "Rate limit exceeded. Please try again later." });
        }
        if (error.message.includes('file_size_error') || error.message.includes('too large')) {
          return res.status(413).json({ message: "File size exceeds Dropbox limits" });
        }
        if (error.message.includes('invalid_file_name') || error.message.includes('disallowed_name')) {
          return res.status(400).json({ message: "Invalid or disallowed filename" });
        }
      }
      
      res.status(500).json({ 
        message: "Failed to upload file to Dropbox",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Cross-cloud transfer route - Queue-based asynchronous transfers
  app.post('/api/transfer-files', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;

      // Strict validation with Zod schema
      const transferSchema = z.object({
        sourceProvider: z.enum(['google', 'dropbox']),
        targetProvider: z.enum(['google', 'dropbox']),
        fileName: z.string().min(1, "File name is required").max(255, "File name too long"),
        targetPath: z.string().optional(),
        sourceFileId: z.string().optional(),
        sourceFilePath: z.string().optional()
      }).refine(data => data.sourceProvider !== data.targetProvider, {
        message: "Source and target providers must be different"
      }).refine(data => {
        // Google Drive requires sourceFileId
        if (data.sourceProvider === 'google') {
          return !!data.sourceFileId;
        }
        // Dropbox requires sourceFilePath
        if (data.sourceProvider === 'dropbox') {
          return !!data.sourceFilePath;
        }
        return true;
      }, {
        message: "Invalid source identifier for provider"
      });

      const validation = transferSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: validation.error.errors 
        });
      }

      const { sourceProvider, sourceFileId, sourceFilePath, targetProvider, targetPath, fileName } = validation.data;

      // Check user membership in backend for security
      const user = await storage.getUser(userId);
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const userMembership = user.membershipPlan || 'free';
      const membershipExpiry = user.membershipExpiry ? new Date(user.membershipExpiry) : null;
      const isExpired = membershipExpiry && membershipExpiry < new Date();

      if (userMembership === 'free' || isExpired) {
        return res.status(403).json({ 
          message: "Premium feature", 
          detail: isExpired 
            ? "Your PRO subscription has expired" 
            : "Cross-cloud transfers require a PRO subscription"
        });
      }

      // Create asynchronous transfer job in queue
      const copyOperation = await storage.createCopyOperation({
        userId,
        sourceProvider,
        sourceFileId: sourceFileId || null,
        sourceFilePath: sourceFilePath || null,
        destinationProvider: targetProvider,
        destinationFolderId: targetPath || null,
        fileName: fileName,
        status: 'pending'
      });

      console.log(`Transfer job created: ${sourceProvider} → ${targetProvider}`, {
        jobId: copyOperation.id,
        userId,
        fileName
      });

      // Return job ID immediately for tracking (202 Accepted for async processing)
      res.status(202).json({
        success: true,
        jobId: copyOperation.id,
        status: 'queued',
        message: 'Transfer started in background. Use the job ID to track progress.'
      });

    } catch (error) {
      console.error("Error creating transfer job:", error, {
        userId: req.user.claims.sub,
        sourceProvider: req.body.sourceProvider,
        targetProvider: req.body.targetProvider,
        fileName: req.body.fileName
      });

      res.status(500).json({
        message: "Failed to create transfer job",
        error: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }
  });

  // Job tracking endpoints
  app.get('/api/transfer-jobs/:jobId', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { jobId } = req.params;

      const job = await storage.getCopyOperation(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Ensure user can only access their own jobs
      if (job.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      res.json({
        id: job.id,
        status: job.status,
        fileName: job.fileName,
        sourceProvider: job.sourceProvider,
        destinationProvider: job.destinationProvider,
        progressPct: job.progressPct || 0,
        completedFiles: job.completedFiles || 0,
        totalFiles: job.totalFiles || 1,
        errorMessage: job.errorMessage,
        copiedFileUrl: job.copiedFileUrl,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      });
    } catch (error) {
      console.error("Error getting job status:", error);
      res.status(500).json({ message: "Failed to get job status" });
    }
  });

  app.get('/api/transfer-jobs', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const jobs = await storage.getUserCopyOperations(userId);

      res.json(jobs.map(job => ({
        id: job.id,
        status: job.status,
        fileName: job.fileName,
        sourceProvider: job.sourceProvider,
        destinationProvider: job.destinationProvider,
        progressPct: job.progressPct || 0,
        errorMessage: job.errorMessage,
        createdAt: job.createdAt,
        updatedAt: job.updatedAt
      })));
    } catch (error) {
      console.error("Error getting user jobs:", error);
      res.status(500).json({ message: "Failed to get jobs" });
    }
  });

  app.post('/api/transfer-jobs/:jobId/cancel', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { jobId } = req.params;

      const job = await storage.getCopyOperation(jobId);
      if (!job) {
        return res.status(404).json({ message: "Job not found" });
      }

      // Ensure user can only cancel their own jobs
      if (job.userId !== userId) {
        return res.status(403).json({ message: "Access denied" });
      }

      // Only allow cancellation of pending or in-progress jobs
      if (job.status !== 'pending' && job.status !== 'in_progress') {
        return res.status(400).json({ 
          message: `Cannot cancel job with status: ${job.status}` 
        });
      }

      const updatedJob = await storage.requestJobCancel(jobId);
      
      res.json({
        id: updatedJob.id,
        status: updatedJob.status,
        cancelRequested: updatedJob.cancelRequested,
        message: 'Cancellation requested'
      });
    } catch (error) {
      console.error("Error canceling job:", error);
      res.status(500).json({ message: "Failed to cancel job" });
    }
  });

  // Server-Sent Events endpoint for real-time job updates
  app.get('/api/transfer-jobs/events', isAuthenticated, (req: any, res) => {
    const userId = req.user.claims.sub;
    
    // Set proper SSE headers for production
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Cache-Control');

    // Flush headers immediately to establish connection
    res.flushHeaders();

    // Send initial connection confirmation with proper SSE format
    res.write(`event: connected\n`);
    res.write(`data: ${JSON.stringify({ userId, timestamp: new Date().toISOString() })}\n\n`);

    // Get the queue worker instance
    const worker = getQueueWorker();
    if (!worker) {
      res.write(`event: error\n`);
      res.write(`data: ${JSON.stringify({ message: 'Queue worker not available' })}\n\n`);
      res.end();
      return;
    }

    // Event listeners for job updates with proper SSE format
    const sendJobUpdate = async (eventType: string, jobId: string, jobUserId: string, extraData?: any) => {
      // Only send events for this user's jobs
      if (jobUserId === userId) {
        try {
          // Get job details from storage to include full info
          const job = await storage.getCopyOperation(jobId);
          if (job) {
            const eventData = {
              jobId: job.id,
              status: job.status,
              fileName: job.fileName,
              progressPct: extraData?.progressPct || job.progressPct || 0,
              errorMessage: extraData?.error || job.errorMessage,
              copiedFileUrl: job.copiedFileUrl,
              timestamp: new Date().toISOString(),
              ...extraData
            };
            
            res.write(`event: ${eventType}\n`);
            res.write(`data: ${JSON.stringify(eventData)}\n\n`);
          }
        } catch (error) {
          console.error('Error writing SSE data:', error);
        }
      }
    };

    // Register event listeners with correct signatures
    const onJobProgress = (jobId: string, jobUserId: string, data: any) => sendJobUpdate('progress', jobId, jobUserId, data);
    const onJobCompleted = (jobId: string, jobUserId: string, result: any) => sendJobUpdate('completed', jobId, jobUserId, result);
    const onJobFailed = (jobId: string, jobUserId: string, errorMessage: string) => sendJobUpdate('failed', jobId, jobUserId, { error: errorMessage });
    const onJobCancelled = (jobId: string, jobUserId: string) => sendJobUpdate('cancelled', jobId, jobUserId);
    const onJobRetry = (jobId: string, jobUserId: string, data: any) => sendJobUpdate('retry', jobId, jobUserId, data);

    worker.on('jobProgress', onJobProgress);
    worker.on('jobCompleted', onJobCompleted);
    worker.on('jobFailed', onJobFailed);
    worker.on('jobCancelled', onJobCancelled);
    worker.on('jobRetry', onJobRetry);

    // Handle client disconnect
    req.on('close', () => {
      console.log(`SSE client disconnected: ${userId}`);
      worker.off('jobProgress', onJobProgress);
      worker.off('jobCompleted', onJobCompleted);
      worker.off('jobFailed', onJobFailed);
      worker.off('jobCancelled', onJobCancelled);
      worker.off('jobRetry', onJobRetry);
    });

    req.on('error', (error: any) => {
      console.error('SSE client error:', error);
      worker.off('jobProgress', onJobProgress);
      worker.off('jobCompleted', onJobCompleted);
      worker.off('jobFailed', onJobFailed);
      worker.off('jobCancelled', onJobCancelled);
      worker.off('jobRetry', onJobRetry);
    });

    // Keep connection alive with periodic heartbeat
    const heartbeat = setInterval(() => {
      try {
        res.write(`event: heartbeat\n`);
        res.write(`data: ${JSON.stringify({ timestamp: new Date().toISOString() })}\n\n`);
      } catch (error) {
        console.error('Error sending heartbeat:', error);
        clearInterval(heartbeat);
      }
    }, 30000); // Every 30 seconds

    // Clear heartbeat on disconnect
    req.on('close', () => {
      clearInterval(heartbeat);
    });
  });

  // Membership management routes
  app.get('/api/membership/status', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      
      if (!user) {
        return res.status(404).json({ message: "User not found" });
      }

      const membershipExpiry = user.membershipExpiry ? new Date(user.membershipExpiry) : null;
      const isExpired = membershipExpiry && membershipExpiry < new Date();

      res.json({
        plan: user.membershipPlan || 'free',
        expiry: membershipExpiry,
        isExpired,
        trialUsed: user.membershipTrialUsed || false
      });
    } catch (error) {
      console.error("Error getting membership status:", error);
      res.status(500).json({ message: "Failed to get membership status" });
    }
  });

  app.post('/api/membership/upgrade', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request with Zod
      const upgradeSchema = z.object({
        plan: z.literal('pro'),
        duration: z.number().int().positive().max(24, "Duration cannot exceed 24 months")
      });
      
      const validation = upgradeSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data", 
          errors: validation.error.errors 
        });
      }
      
      const { plan, duration } = validation.data;

      // Calculate expiry (duration in months)
      const expiryDate = new Date();
      expiryDate.setMonth(expiryDate.getMonth() + (duration || 1));

      // Update user membership (this would integrate with payment system)
      const updatedUser = await storage.updateUser(userId, {
        membershipPlan: 'pro',
        membershipExpiry: expiryDate
      });

      res.json({
        success: true,
        plan: updatedUser.membershipPlan,
        expiry: updatedUser.membershipExpiry,
        message: `Successfully upgraded to ${plan.toUpperCase()} plan`
      });
    } catch (error) {
      console.error("Error upgrading membership:", error);
      res.status(500).json({ message: "Failed to upgrade membership" });
    }
  });

  // Dropbox URL parsing and copy operations
  app.post('/api/dropbox/parse-url', isAuthenticated, async (req: any, res) => {
    try {
      const { url } = req.body;
      const userId = req.user.claims.sub;
      const dropboxService = new DropboxService(userId);
      const urlInfo = dropboxService.parseDropboxUrl(url);
      res.json(urlInfo);
    } catch (error) {
      console.error("Error parsing Dropbox URL:", error);
      res.status(500).json({ message: "Failed to parse Dropbox URL" });
    }
  });

  app.post('/api/dropbox/list-shared-files', isAuthenticated, async (req: any, res) => {
    try {
      const { sharedUrl, path = '' } = req.body;
      const userId = req.user.claims.sub;
      const dropboxService = new DropboxService(userId);
      
      if (!sharedUrl) {
        return res.status(400).json({ message: "Shared URL is required" });
      }

      const files = await dropboxService.listSharedFolderContents(sharedUrl, path);
      res.json(files);
    } catch (error) {
      console.error("Error listing shared folder contents:", error);
      
      if (error instanceof Error) {
        if (error.message.includes('access token has expired')) {
          return res.status(401).json({ message: "Dropbox access expired. Please reconnect your account." });
        }
        if (error.message.includes('not connected')) {
          return res.status(401).json({ message: "Dropbox account not connected" });
        }
        if (error.message.includes('Invalid Dropbox URL')) {
          return res.status(400).json({ message: "Invalid Dropbox URL format" });
        }
      }
      
      res.status(500).json({ message: "Failed to list shared folder contents" });
    }
  });

  app.post('/api/dropbox/copy-from-url', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const validation = insertCopyOperationSchema.parse({
        ...req.body,
        userId,
        status: 'pending',
      });

      const operation = await storage.createCopyOperation(validation);
      res.json(operation);

      // Start copy process in background for Dropbox
      const dropboxService = new DropboxService(userId);
      dropboxService.startCopyFromUrl(operation.id, validation.sourceUrl);
    } catch (error) {
      console.error("Error creating Dropbox copy operation:", error);
      res.status(500).json({ message: "Failed to create Dropbox copy operation" });
    }
  });

  app.post('/api/dropbox/copy-operations/preview', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      
      // Validate request body with Zod
      const previewSchema = z.object({
        sourceUrl: z.string().url("Invalid URL format").min(1, "Source URL is required")
      });
      
      const validation = previewSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({ 
          message: "Invalid request data",
          errors: validation.error.errors
        });
      }

      const { sourceUrl } = validation.data;
      const dropboxService = new DropboxService(userId);
      const preview = await dropboxService.getOperationPreview(sourceUrl);
      
      res.json(preview);
    } catch (error) {
      console.error("Error getting Dropbox operation preview:", error);
      
      // Provide more specific error messages based on the actual errors thrown
      if (error instanceof Error) {
        if (error.message.includes('Invalid Dropbox URL')) {
          return res.status(400).json({ message: "Invalid Dropbox URL format" });
        }
        if (error.message.includes('access token has expired')) {
          return res.status(401).json({ message: "Dropbox access expired. Please reconnect your account." });
        }
        if (error.message.includes('not connected')) {
          return res.status(401).json({ message: "Dropbox account not connected" });
        }
      }
      
      res.status(500).json({ message: "Failed to get Dropbox operation preview" });
    }
  });

  // Dropbox folder browsing endpoints
  app.get('/api/dropbox/folders', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const path = String(req.query.path || '/');
      const cursor = req.query.cursor ? String(req.query.cursor) : undefined;
      
      // Validate path format
      if (typeof req.query.path !== 'undefined' && typeof req.query.path !== 'string') {
        return res.status(400).json({ message: "Invalid path parameter" });
      }
      
      const dropboxService = new DropboxService(userId);
      const result = await dropboxService.listFolders(path, cursor);
      
      res.json(result);
    } catch (error) {
      console.error("Error listing Dropbox folders:", error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('access token has expired')) {
          return res.status(401).json({ message: "Dropbox access expired. Please reconnect your account." });
        }
        if (error.message.includes('not connected')) {
          return res.status(401).json({ message: "Dropbox account not connected" });
        }
        if (error.message.includes('path_not_found') || error.message.includes('not_found')) {
          return res.status(404).json({ message: "Folder path not found in Dropbox" });
        }
        if (error.message.includes('path_malformed') || error.message.includes('malformed_path')) {
          return res.status(400).json({ message: "Invalid folder path format" });
        }
      }
      
      res.status(500).json({ message: "Failed to list Dropbox folders" });
    }
  });

  app.get('/api/dropbox/folders/path', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const path = String(req.query.path || '/');
      
      // Validate path format
      if (typeof req.query.path !== 'undefined' && typeof req.query.path !== 'string') {
        return res.status(400).json({ message: "Invalid path parameter" });
      }
      
      const dropboxService = new DropboxService(userId);
      const breadcrumbs = await dropboxService.getFolderPath(path);
      
      res.json({ path: breadcrumbs });
    } catch (error) {
      console.error("Error getting Dropbox folder path:", error);
      
      // Provide more specific error messages
      if (error instanceof Error) {
        if (error.message.includes('access token has expired')) {
          return res.status(401).json({ message: "Dropbox access expired. Please reconnect your account." });
        }
        if (error.message.includes('not connected')) {
          return res.status(401).json({ message: "Dropbox account not connected" });
        }
        if (error.message.includes('path_not_found') || error.message.includes('not_found')) {
          return res.status(404).json({ message: "Folder path not found in Dropbox" });
        }
        if (error.message.includes('path_malformed') || error.message.includes('malformed_path')) {
          return res.status(400).json({ message: "Invalid folder path format" });
        }
      }
      
      res.status(500).json({ message: "Failed to get Dropbox folder path" });
    }
  });

  // OAuth help and status endpoints
  app.get('/api/oauth/help', (req, res) => {
    const googleUri = getOAuthRedirectUri(req, '/api/auth/google/callback');
    const dropboxUri = getOAuthRedirectUri(req, '/api/auth/dropbox/callback');
    const domain = process.env.REPLIT_DEV_DOMAIN || req.get('host') || 'localhost:5000';
    
    res.json({
      message: "Add these redirect URIs to your OAuth applications",
      redirectUris: {
        google: {
          service: "Google Cloud Console",
          url: googleUri,
          instructions: "Go to Google Cloud Console → APIs & Services → Credentials → Edit your OAuth 2.0 Client ID → Add this URL to 'Authorized redirect URIs'"
        },
        dropbox: {
          service: "Dropbox App Console",
          url: dropboxUri,
          instructions: "Go to Dropbox App Console → Your App → Settings → Add this URL to 'OAuth2 Redirect URIs'"
        }
      },
      currentDomain: domain,
      note: "💡 Remember: Each time you remix this Repl, the domain changes and you'll need to add the new URLs to your OAuth configurations."
    });
  });

  app.get('/api/oauth/status', async (req: any, res) => {
    try {
      const isAuthenticated = req.user ? true : false;
      let status = {
        authenticated: isAuthenticated,
        domain: process.env.REPLIT_DEV_DOMAIN || req.get('host') || 'localhost:5000',
        google: { configured: false, connected: false },
        dropbox: { configured: false, connected: false }
      };

      // Check if OAuth credentials are configured
      status.google.configured = !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
      status.dropbox.configured = !!(process.env.DROPBOX_APP_KEY && process.env.DROPBOX_APP_SECRET);

      if (isAuthenticated) {
        try {
          const userId = req.user.claims.sub;
          const user = await storage.getUser(userId);
          
          status.google.connected = !!(user?.googleAccessToken || user?.googleRefreshToken);
          status.dropbox.connected = !!(user?.dropboxAccessToken || user?.dropboxRefreshToken);
        } catch (error) {
          console.error("Error checking user OAuth status:", error);
        }
      }

      res.json(status);
    } catch (error) {
      console.error("Error getting OAuth status:", error);
      res.status(500).json({ message: "Failed to get OAuth status" });
    }
  });

  // ============================================
  // ADMIN ENDPOINTS
  // ============================================

  // Get all users (admin only)
  app.get('/api/admin/users', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      
      const result = await storage.getAllUsers(page, limit);
      res.json(result);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Update user limits (admin only)
  app.put('/api/admin/users/:id/limits', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      
      const limitsSchema = z.object({
        maxStorageBytes: z.number().positive().optional(),
        maxConcurrentOperations: z.number().positive().optional(),
        maxDailyOperations: z.number().positive().optional(),
      });

      const validation = limitsSchema.safeParse(req.body);
      if (!validation.success) {
        return res.status(400).json({
          message: "Invalid limits data",
          errors: validation.error.errors
        });
      }

      const updatedUser = await storage.updateUserLimits(userId, validation.data);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user limits:", error);
      res.status(500).json({ message: "Failed to update user limits" });
    }
  });

  // Update user role (admin only)
  app.put('/api/admin/users/:id/role', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const { role } = req.body;

      if (!role || !['admin', 'user'].includes(role)) {
        return res.status(400).json({ message: "Invalid role. Must be 'admin' or 'user'" });
      }

      const updatedUser = await storage.updateUserRole(userId, role);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error updating user role:", error);
      res.status(500).json({ message: "Failed to update user role" });
    }
  });

  // Suspend user (admin only)
  app.post('/api/admin/users/:id/suspend', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const updatedUser = await storage.suspendUser(userId);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error suspending user:", error);
      res.status(500).json({ message: "Failed to suspend user" });
    }
  });

  // Activate user (admin only)
  app.post('/api/admin/users/:id/activate', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const updatedUser = await storage.activateUser(userId);
      res.json(updatedUser);
    } catch (error) {
      console.error("Error activating user:", error);
      res.status(500).json({ message: "Failed to activate user" });
    }
  });

  // Delete user (admin only)
  app.delete('/api/admin/users/:id', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      await storage.deleteUser(userId);
      res.json({ message: "User deleted successfully" });
    } catch (error) {
      console.error("Error deleting user:", error);
      res.status(500).json({ message: "Failed to delete user" });
    }
  });

  // Get user activity (admin only)
  app.get('/api/admin/users/:id/activity', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const userId = req.params.id;
      const activity = await storage.getUserActivity(userId);
      res.json(activity);
    } catch (error) {
      console.error("Error fetching user activity:", error);
      res.status(500).json({ message: "Failed to fetch user activity" });
    }
  });

  // Get all operations with filters (admin only)
  app.get('/api/admin/operations', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const filters: any = {
        page: parseInt(req.query.page as string) || 1,
        limit: parseInt(req.query.limit as string) || 20,
      };

      if (req.query.userId) filters.userId = req.query.userId as string;
      if (req.query.status) filters.status = req.query.status as string;
      if (req.query.provider) filters.provider = req.query.provider as string;
      if (req.query.startDate) filters.startDate = new Date(req.query.startDate as string);
      if (req.query.endDate) filters.endDate = new Date(req.query.endDate as string);

      const result = await storage.getAllOperations(filters);
      res.json(result);
    } catch (error) {
      console.error("Error fetching operations:", error);
      res.status(500).json({ message: "Failed to fetch operations" });
    }
  });

  // Retry failed operation (admin only)
  app.post('/api/admin/operations/:id/retry', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const operationId = req.params.id;
      const retriedOperation = await storage.retryOperation(operationId);
      res.json(retriedOperation);
    } catch (error) {
      console.error("Error retrying operation:", error);
      res.status(500).json({ message: "Failed to retry operation" });
    }
  });

  // Get system metrics (admin only)
  app.get('/api/admin/metrics', isAuthenticated, isAdmin, async (req: any, res) => {
    try {
      const metrics = await storage.getSystemMetrics();
      res.json(metrics);
    } catch (error) {
      console.error("Error fetching metrics:", error);
      res.status(500).json({ message: "Failed to fetch metrics" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
