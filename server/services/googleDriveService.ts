import { google } from 'googleapis';
import { storage } from '../storage';

export interface DriveFileInfo {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  webViewLink?: string;
  parents?: string[];
  createdTime?: string;
  modifiedTime?: string;
}

export interface FileStructure {
  name: string;
  type: 'file' | 'folder';
  size?: number;
  children?: FileStructure[];
}

export interface OperationPreview {
  name: string;
  type: 'file' | 'folder';
  totalFiles: number;
  totalFolders: number;
  totalSize: number;
  estimatedDurationSeconds: number;
  fileTypes: { [key: string]: number };
  structure: FileStructure;
}

interface ProgressContext {
  completedFiles: number;
  totalFiles: number;
  operationId: string;
  onProgress?: (completedFiles: number, totalFiles: number, progressPct: number) => Promise<void>;
}

export class GoogleDriveService {
  private drive: any;
  private auth: any;
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
    this.auth = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      `https://${process.env.REPLIT_DEV_DOMAIN}/api/auth/google/callback`
    );
  }

  private async ensureValidToken(): Promise<void> {
    const user = await storage.getUser(this.userId);
    
    if (!user?.googleAccessToken) {
      throw new Error('User has not connected their Google Drive account');
    }

    // Check if token is expired
    if (user.googleTokenExpiry && new Date(user.googleTokenExpiry) <= new Date()) {
      // Try to refresh token
      if (user.googleRefreshToken) {
        try {
          this.auth.setCredentials({
            access_token: user.googleAccessToken,
            refresh_token: user.googleRefreshToken
          });

          const { credentials } = await this.auth.refreshAccessToken();
          
          // Update tokens in database
          await storage.updateUserGoogleTokens(this.userId, {
            accessToken: credentials.access_token!,
            refreshToken: credentials.refresh_token || user.googleRefreshToken,
            expiry: credentials.expiry_date ? new Date(credentials.expiry_date) : undefined
          });

          this.auth.setCredentials(credentials);
        } catch (error) {
          console.error('Failed to refresh Google token:', error);
          throw new Error('Google Drive access token has expired. Please reconnect your account.');
        }
      } else {
        throw new Error('Google Drive access token has expired. Please reconnect your account.');
      }
    } else {
      // Token is still valid
      this.auth.setCredentials({
        access_token: user.googleAccessToken,
        refresh_token: user.googleRefreshToken
      });
    }

    this.drive = google.drive({ version: 'v3', auth: this.auth });
  }

  /**
   * Parse Google Drive URL to extract file/folder ID
   */
  parseGoogleDriveUrl(url: string): { fileId: string; type: 'file' | 'folder' } {
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
    const openMatch = url.match(/[?&]id=([a-zA-Z0-9-_]+)/);

    if (folderMatch) {
      return { fileId: folderMatch[1], type: 'folder' };
    } else if (fileMatch) {
      return { fileId: fileMatch[1], type: 'file' };
    } else if (openMatch) {
      return { fileId: openMatch[1], type: 'file' };
    } else {
      throw new Error('Invalid Google Drive URL format');
    }
  }

  /**
   * Get file/folder information
   */
  async getFileInfo(fileId: string): Promise<DriveFileInfo> {
    try {
      await this.ensureValidToken();
      
      const response = await this.drive.files.get({
        fileId,
        fields: 'id,name,mimeType,size,webViewLink,parents,createdTime,modifiedTime'
      });

      return response.data;
    } catch (error) {
      console.error('Error getting file info:', error);
      throw new Error('Failed to get file information');
    }
  }

  /**
   * List files in a folder with pagination
   */
  async listFiles(folderId?: string): Promise<DriveFileInfo[]> {
    try {
      await this.ensureValidToken();
      
      let query = 'trashed = false';
      if (folderId) {
        query += ` and '${folderId}' in parents`;
      }

      const allFiles: DriveFileInfo[] = [];
      let nextPageToken: string | undefined;
      
      do {
        const response = await this.drive.files.list({
          q: query,
          fields: 'nextPageToken,files(id,name,mimeType,size,webViewLink,parents,createdTime,modifiedTime)',
          pageSize: 100,
          pageToken: nextPageToken
        });
        
        if (response.data.files) {
          allFiles.push(...response.data.files);
        }
        
        nextPageToken = response.data.nextPageToken;
      } while (nextPageToken);

      return allFiles;
    } catch (error) {
      console.error('Error listing files:', error);
      throw new Error('Failed to list files');
    }
  }

  /**
   * Copy a file to user's drive
   */
  async copyFile(fileId: string, newName?: string, parentFolderId?: string): Promise<DriveFileInfo> {
    try {
      await this.ensureValidToken();
      
      const requestBody: any = {};
      
      if (newName) {
        requestBody.name = newName;
      }
      
      if (parentFolderId) {
        requestBody.parents = [parentFolderId];
      }

      const response = await this.drive.files.copy({
        fileId,
        resource: requestBody,
        fields: 'id,name,mimeType,size,webViewLink,parents'
      });

      return response.data;
    } catch (error) {
      console.error('Error copying file:', error);
      throw new Error('Failed to copy file');
    }
  }

  /**
   * Create a folder in user's drive
   */
  async createFolder(name: string, parentFolderId?: string): Promise<DriveFileInfo> {
    try {
      await this.ensureValidToken();
      
      const requestBody: any = {
        name,
        mimeType: 'application/vnd.google-apps.folder'
      };

      if (parentFolderId) {
        requestBody.parents = [parentFolderId];
      }

      const response = await this.drive.files.create({
        resource: requestBody,
        fields: 'id,name,mimeType,parents,webViewLink'
      });

      return response.data;
    } catch (error) {
      console.error('Error creating folder:', error);
      throw new Error('Failed to create folder');
    }
  }

  /**
   * Upload file content to Google Drive with support for large files using resumable uploads
   */
  async uploadFile(filename: string, content: ArrayBuffer, parentFolderId?: string, mimeType?: string): Promise<DriveFileInfo> {
    await this.ensureValidToken();
    
    try {
      const fileSize = content.byteLength;
      const maxRegularUploadSize = 10 * 1024 * 1024; // 10MB threshold for resumable uploads
      const maxGoogleDriveSize = 5 * 1024 * 1024 * 1024 * 1024; // 5TB maximum for Google Drive
      
      // Check file size limit
      if (fileSize > maxGoogleDriveSize) {
        throw new Error(`File size (${Math.round(fileSize / 1024 / 1024 / 1024 / 1024)}TB) exceeds Google Drive maximum limit of 5TB`);
      }
      
      // Use resumable uploads for larger files
      if (fileSize > maxRegularUploadSize) {
        console.log(`Large file detected (${Math.round(fileSize / 1024 / 1024)}MB), using resumable upload`);
        return await this.uploadLargeFile(filename, content, parentFolderId, mimeType);
      }
      
      // Regular upload for smaller files
      const requestBody: any = {
        name: filename,
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      const media = {
        mimeType: mimeType || 'application/octet-stream',
        body: Buffer.from(content)
      };

      const response = await this.drive.files.create({
        resource: requestBody,
        media: media,
        fields: 'id,name,mimeType,size,webViewLink,parents'
      });

      return response.data;
    } catch (error) {
      console.error('Error uploading file to Google Drive:', error);
      throw new Error('Failed to upload file to Google Drive');
    }
  }

  private async uploadLargeFile(filename: string, content: ArrayBuffer, parentFolderId?: string, mimeType?: string): Promise<DriveFileInfo> {
    const chunkSize = 256 * 1024; // 256KB chunks for resumable uploads
    const totalSize = content.byteLength;
    
    try {
      // Create resumable upload session
      const requestBody: any = {
        name: filename,
        parents: parentFolderId ? [parentFolderId] : undefined
      };

      // Start resumable upload session
      const initResponse = await this.auth.request({
        url: 'https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json; charset=UTF-8',
          'X-Upload-Content-Type': mimeType || 'application/octet-stream',
          'X-Upload-Content-Length': totalSize.toString()
        },
        data: JSON.stringify(requestBody)
      });

      const uploadUrl = initResponse.headers.location;
      if (!uploadUrl) {
        throw new Error('Failed to get resumable upload URL');
      }

      console.log(`Starting resumable upload for ${filename} (${Math.round(totalSize / 1024 / 1024)}MB)`);

      // Upload file in chunks
      let uploadedBytes = 0;
      while (uploadedBytes < totalSize) {
        const end = Math.min(uploadedBytes + chunkSize, totalSize);
        const chunk = content.slice(uploadedBytes, end);
        const chunkRange = `bytes ${uploadedBytes}-${end - 1}/${totalSize}`;
        
        console.log(`Uploading chunk: ${chunkRange} (${Math.round((uploadedBytes / totalSize) * 100)}%)`);
        
        const chunkResponse = await this.auth.request({
          url: uploadUrl,
          method: 'PUT',
          headers: {
            'Content-Range': chunkRange,
            'Content-Type': mimeType || 'application/octet-stream'
          },
          data: Buffer.from(chunk)
        });

        if (chunkResponse.status === 200 || chunkResponse.status === 201) {
          // Upload complete
          return chunkResponse.data;
        } else if (chunkResponse.status === 308) {
          // Partial upload, continue
          const rangeHeader = chunkResponse.headers.range;
          if (rangeHeader) {
            const nextByte = parseInt(rangeHeader.split('-')[1]) + 1;
            uploadedBytes = nextByte;
          } else {
            uploadedBytes = end;
          }
        } else {
          throw new Error(`Unexpected response status: ${chunkResponse.status}`);
        }
      }

      throw new Error('Resumable upload completed unexpectedly');
    } catch (error) {
      console.error('Error in large file upload:', error);
      throw new Error(`Failed to upload large file: ${error.message}`);
    }
  }

  /**
   * Download file content from Google Drive
   */
  async downloadFile(fileId: string): Promise<ArrayBuffer> {
    await this.ensureValidToken();
    
    try {
      const response = await this.drive.files.get({
        fileId,
        alt: 'media'
      }, { responseType: 'arraybuffer' });

      return response.data as ArrayBuffer;
    } catch (error) {
      console.error('Error downloading file from Google Drive:', error);
      throw new Error('Failed to download file from Google Drive');
    }
  }

  /**
   * Count total files recursively in a folder (for accurate progress tracking)
   */
  private async countFilesRecursively(folderId: string): Promise<number> {
    try {
      const files = await this.listFiles(folderId);
      let count = 0;
      
      for (const file of files) {
        if (file.mimeType === 'application/vnd.google-apps.folder') {
          // Recursively count files in subfolders
          count += await this.countFilesRecursively(file.id);
        } else {
          // Count individual files only (not folders)
          count++;
        }
      }
      
      return count;
    } catch (error) {
      console.error('Error counting files recursively:', error);
      return 0; // Return 0 if counting fails to avoid breaking the operation
    }
  }

  /**
   * Recursively copy folder and its contents (internal version with progress context)
   */
  private async copyFolderRecursiveInternal(
    sourceFolderId: string, 
    destinationFolderId?: string, 
    newFolderName?: string,
    progressContext?: ProgressContext
  ): Promise<DriveFileInfo> {
    try {
      // Get source folder info
      const sourceFolder = await this.getFileInfo(sourceFolderId);
      
      // Create new folder
      const newFolder = await this.createFolder(
        newFolderName || `Copy of ${sourceFolder.name}`,
        destinationFolderId
      );

      // Save the new folder to drive_files table
      try {
        await storage.createCloudFile({
          userId: this.userId,
          provider: 'google',
          originalFileId: sourceFolderId,
          copiedFileId: newFolder.id!,
          fileName: newFolder.name!,
          mimeType: newFolder.mimeType,
          fileSize: null, // Folders don't have file size
          sourceUrl: `https://drive.google.com/drive/folders/${sourceFolderId}`
        });
        console.log(`📂 Archived folder ${newFolder.name} in drive_files table`);
      } catch (error) {
        console.error(`Failed to save folder ${newFolder.name} to drive_files:`, error);
      }

      // Get all files in source folder
      const files = await this.listFiles(sourceFolderId);

      // Copy each file/folder
      for (const file of files) {
        try {
          let copiedFile: DriveFileInfo;
          
          if (file.mimeType === 'application/vnd.google-apps.folder') {
            // Recursively copy subfolders - Pass progress context to track progress in all levels
            copiedFile = await this.copyFolderRecursiveInternal(file.id, newFolder.id, file.name, progressContext);
          } else {
            // Copy individual files
            copiedFile = await this.copyFile(file.id, undefined, newFolder.id);
            
            // Save individual file to drive_files table
            try {
              await storage.createCloudFile({
                userId: this.userId,
                provider: 'google',
                originalFileId: file.id,
                copiedFileId: copiedFile.id!,
                fileName: copiedFile.name!,
                mimeType: copiedFile.mimeType,
                fileSize: copiedFile.size ? Number(copiedFile.size) || null : null,
                sourceUrl: `https://drive.google.com/file/d/${file.id}/view`
              });
              console.log(`📁 Archived individual file ${copiedFile.name} in drive_files table`);
            } catch (error) {
              console.error(`Failed to save individual file ${copiedFile.name} to drive_files:`, error);
            }

            // Increment progress counter for files only (not folders)
            if (progressContext) {
              progressContext.completedFiles++;
              // Calculate progress percentage using proper total
              const progressPct = Math.min(100, Math.round((progressContext.completedFiles / Math.max(1, progressContext.totalFiles)) * 100));
              // Update progress in database
              await storage.setJobProgress(
                progressContext.operationId, 
                progressContext.completedFiles, 
                progressContext.totalFiles,
                progressPct
              );
              // Emit real-time progress update if callback is provided
              if (progressContext.onProgress) {
                await progressContext.onProgress(progressContext.completedFiles, progressContext.totalFiles, progressPct);
              }
            }
          }
        } catch (error) {
          console.error(`Error copying file ${file.name}:`, error);
          // Continue with other files even if one fails
        }
      }

      return newFolder;
    } catch (error) {
      console.error('Error copying folder:', error);
      if (progressContext) {
        await storage.updateCopyOperation(progressContext.operationId, {
          status: 'failed',
          errorMessage: error instanceof Error ? error.message : 'Unknown error'
        });
      }
      throw error;
    }
  }

  /**
   * Public interface for copying folders recursively
   */
  async copyFolderRecursive(
    sourceFolderId: string, 
    destinationFolderId?: string, 
    newFolderName?: string,
    operationId?: string,
    onProgress?: (completedFiles: number, totalFiles: number, progressPct: number) => Promise<void>
  ): Promise<DriveFileInfo> {
    if (operationId) {
      // Count total files first for accurate progress tracking
      const totalFiles = await this.countFilesRecursively(sourceFolderId);
      
      // Create progress context for tracking
      const progressContext: ProgressContext = {
        completedFiles: 0,
        totalFiles: totalFiles,
        operationId,
        onProgress
      };
      
      // Set total files once at the beginning
      await storage.updateCopyOperation(operationId, {
        status: 'in_progress',
        totalFiles,
        completedFiles: 0
      });
      
      return this.copyFolderRecursiveInternal(sourceFolderId, destinationFolderId, newFolderName, progressContext);
    } else {
      // No progress tracking needed
      return this.copyFolderRecursiveInternal(sourceFolderId, destinationFolderId, newFolderName);
    }
  }

  /**
   * Start copy operation (background process)
   */
  async startCopyOperation(operationId: string, sourceUrl: string): Promise<void> {
    const startTime = Date.now();
    
    try {
      const { fileId, type } = this.parseGoogleDriveUrl(sourceUrl);
      
      await storage.updateCopyOperation(operationId, {
        status: 'in_progress'
      });

      let result: DriveFileInfo;

      if (type === 'folder') {
        result = await this.copyFolderRecursive(fileId, undefined, undefined, operationId);
      } else {
        result = await this.copyFile(fileId);
        await storage.updateCopyOperation(operationId, {
          totalFiles: 1,
          completedFiles: 1
        });
      }

      // Calcular duración
      const duration = Math.round((Date.now() - startTime) / 1000);

      // Completar operación con todos los datos
      await storage.updateCopyOperation(operationId, {
        status: 'completed',
        copiedFileId: result.id,
        copiedFileName: result.name,
        copiedFileUrl: result.webViewLink,
        duration: duration
      });

      // Guardar solo archivos individuales en la tabla drive_files
      // Las carpetas se guardan automáticamente en copyFolderRecursive
      if (type !== 'folder') {
        try {
          await storage.createCloudFile({
            userId: this.userId,
            provider: 'google',
            originalFileId: fileId,
            copiedFileId: result.id!,
            fileName: result.name!,
            mimeType: result.mimeType,
            fileSize: result.size ? Number(result.size) || null : null,
            sourceUrl: sourceUrl
          });
          console.log(`✅ Archived file ${result.name} in drive_files table`);
        } catch (error) {
          console.error('Failed to save file to drive_files table:', error);
        }
      } else {
        console.log(`📂 Folder ${result.name} and contents archived via copyFolderRecursive`);
      }

      // Enviar notificación por email
      await this.sendCompletionEmail(operationId, result, duration);

    } catch (error) {
      console.error('Copy operation failed:', error);
      const duration = Math.round((Date.now() - startTime) / 1000);
      
      await storage.updateCopyOperation(operationId, {
        status: 'failed',
        errorMessage: error instanceof Error ? error.message : 'Unknown error',
        duration: duration
      });
    }
  }

  /**
   * Get preview information for copy operation
   */
  async getOperationPreview(sourceUrl: string): Promise<OperationPreview> {
    const { fileId, type } = this.parseGoogleDriveUrl(sourceUrl);
    const sourceInfo = await this.getFileInfo(fileId);
    
    let totalFiles = 0;
    let totalFolders = 0;
    let totalSize = 0;
    const fileTypes: { [key: string]: number } = {};
    let structure: FileStructure;

    if (type === 'file') {
      totalFiles = 1;
      totalSize = Number(sourceInfo.size) || 0;
      const fileType = this.getFileType(sourceInfo.mimeType);
      fileTypes[fileType] = 1;
      
      structure = {
        name: sourceInfo.name,
        type: 'file',
        size: totalSize
      };
    } else {
      // Analyze folder structure recursively
      const analysis = await this.analyzeStructureRecursive(fileId, sourceInfo.name);
      totalFiles = analysis.fileCount;
      totalFolders = analysis.folderCount;
      totalSize = analysis.totalSize;
      Object.assign(fileTypes, analysis.fileTypes);
      structure = analysis.structure;
    }

    // Estimate duration based on historical data
    const estimatedDurationSeconds = await this.estimateDuration(totalFiles, totalSize);

    return {
      name: sourceInfo.name,
      type,
      totalFiles,
      totalFolders,
      totalSize,
      estimatedDurationSeconds,
      fileTypes,
      structure
    };
  }

  /**
   * Recursively analyze folder structure for preview
   */
  private async analyzeStructureRecursive(folderId: string, folderName: string): Promise<{
    fileCount: number;
    folderCount: number;
    totalSize: number;
    fileTypes: { [key: string]: number };
    structure: FileStructure;
  }> {
    const files = await this.listFiles(folderId);
    let fileCount = 0;
    let folderCount = 0;
    let totalSize = 0;
    const fileTypes: { [key: string]: number } = {};
    const children: FileStructure[] = [];

    for (const file of files) {
      if (file.mimeType === 'application/vnd.google-apps.folder') {
        folderCount++;
        const subAnalysis = await this.analyzeStructureRecursive(file.id, file.name);
        fileCount += subAnalysis.fileCount;
        folderCount += subAnalysis.folderCount;
        totalSize += subAnalysis.totalSize;
        
        // Merge file types
        for (const [type, count] of Object.entries(subAnalysis.fileTypes)) {
          fileTypes[type] = (fileTypes[type] || 0) + count;
        }
        
        children.push(subAnalysis.structure);
      } else {
        fileCount++;
        const fileSize = Number(file.size) || 0;
        totalSize += fileSize;
        
        const fileType = this.getFileType(file.mimeType);
        fileTypes[fileType] = (fileTypes[fileType] || 0) + 1;
        
        children.push({
          name: file.name,
          type: 'file',
          size: fileSize
        });
      }
    }

    return {
      fileCount,
      folderCount,
      totalSize,
      fileTypes,
      structure: {
        name: folderName,
        type: 'folder',
        children
      }
    };
  }

  /**
   * Estimate copy duration based on historical data and file characteristics
   */
  private async estimateDuration(totalFiles: number, totalSize: number): Promise<number> {
    try {
      // Get historical operations for this user
      const recentOperations = await storage.getRecentCopyOperations(this.userId, 10);
      
      if (recentOperations.length >= 3) {
        // Calculate average time per file and per MB from recent operations
        let totalDuration = 0;
        let totalFilesCopied = 0;
        let totalSizeCopied = 0;
        
        for (const op of recentOperations) {
          if (op.status === 'completed' && op.duration && op.completedFiles) {
            totalDuration += op.duration;
            totalFilesCopied += op.completedFiles;
            // Estimate size if not available (rough approximation)
            totalSizeCopied += 10 * 1024 * 1024; // 10MB average per file
          }
        }
        
        if (totalFilesCopied > 0) {
          const avgTimePerFile = totalDuration / totalFilesCopied;
          const baseEstimate = Math.ceil(totalFiles * avgTimePerFile);
          
          // Add size-based adjustment (1 second per 50MB)
          const sizeAdjustment = Math.ceil(totalSize / (50 * 1024 * 1024));
          
          return Math.max(5, baseEstimate + sizeAdjustment); // Minimum 5 seconds
        }
      }
      
      // Fallback estimation if no historical data
      const baseTimePerFile = 3; // 3 seconds per file
      const sizeTimePerMB = totalSize > 0 ? Math.ceil(totalSize / (1024 * 1024)) * 0.5 : 0;
      
      return Math.max(5, Math.ceil(totalFiles * baseTimePerFile + sizeTimePerMB));
    } catch (error) {
      console.error('Error estimating duration:', error);
      // Fallback to simple estimation
      return Math.max(5, totalFiles * 3);
    }
  }

  /**
   * Get file type category from mime type
   */
  private getFileType(mimeType: string): string {
    if (mimeType.includes('folder')) return 'Carpetas';
    if (mimeType.includes('image/')) return 'Imágenes';
    if (mimeType.includes('video/')) return 'Videos';
    if (mimeType.includes('audio/')) return 'Audio';
    if (mimeType.includes('pdf')) return 'PDFs';
    if (mimeType.includes('document') || mimeType.includes('word')) return 'Documentos';
    if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return 'Hojas de cálculo';
    if (mimeType.includes('presentation') || mimeType.includes('powerpoint')) return 'Presentaciones';
    if (mimeType.includes('zip') || mimeType.includes('archive')) return 'Archivos comprimidos';
    return 'Otros';
  }

  /**
   * Send completion email to user using Gmail API
   */
  private async sendCompletionEmail(operationId: string, result: DriveFileInfo, duration: number): Promise<void> {
    try {
      const user = await storage.getUser(this.userId);
      if (!user?.email) {
        console.log('User email not available, skipping email notification');
        return;
      }

      if (!user.googleAccessToken) {
        console.log('User not connected to Google, skipping email notification');
        return;
      }

      const operation = await storage.getCopyOperation(operationId);
      if (!operation) {
        console.log('Operation not found, skipping email notification');
        return;
      }

      // Configurar Gmail API con el token del usuario
      const gmail = google.gmail({ version: 'v1', auth: this.auth });

      // Formatear fechas reales de la operación
      const startDate = new Date(operation.createdAt!).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
      
      const endDate = new Date(operation.updatedAt!).toLocaleDateString('es-ES', {
        day: '2-digit',
        month: '2-digit', 
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });

      // Crear template HTML similar a la imagen de referencia
      const emailHtml = `
<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Proceso de copia completado</title>
    <style>
        body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; margin: 0; padding: 20px; background-color: #f5f5f5; }
        .container { max-width: 600px; margin: 0 auto; background: white; border-radius: 8px; overflow: hidden; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
        .header { background-color: #4285f4; color: white; padding: 20px; text-align: center; }
        .content { padding: 30px; }
        .success-message { color: #137333; font-weight: 500; margin-bottom: 20px; }
        .drive-link { display: inline-block; background-color: #4285f4; color: white !important; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: 500; margin: 20px 0; }
        .summary { background-color: #f8f9fa; padding: 20px; border-radius: 6px; margin: 20px 0; }
        .summary h3 { margin: 0 0 15px 0; color: #202124; }
        .summary ul { margin: 0; padding-left: 0; list-style: none; }
        .summary li { margin: 8px 0; color: #5f6368; }
        .summary li strong { color: #202124; }
        .footer { text-align: center; color: #5f6368; font-size: 14px; padding: 20px; border-top: 1px solid #e8eaed; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CloneDrive</h1>
        </div>
        <div class="content">
            <p>Hola <strong>${user.firstName || user.email}</strong>,</p>
            
            <p class="success-message">El proceso de copia de la ${result.mimeType === 'application/vnd.google-apps.folder' ? 'carpeta' : 'archivo'} para <strong>"${result.name}"</strong> ha finalizado exitosamente.</p>
            
            <p><strong>Enlace ${result.mimeType === 'application/vnd.google-apps.folder' ? 'a la carpeta copiada' : 'al archivo copiado'} en tu Drive:</strong></p>
            <a href="${result.webViewLink}" class="drive-link">Abrir en Google Drive</a>
            
            <div class="summary">
                <h3>Resumen de la Operación:</h3>
                <ul>
                    <li><strong>Nombre del ${result.mimeType === 'application/vnd.google-apps.folder' ? 'Carpeta Copiada' : 'Archivo Copiado'}:</strong> ${result.name}</li>
                    <li><strong>Iniciado:</strong> ${startDate}</li>
                    <li><strong>Completado:</strong> ${endDate}</li>
                    <li><strong>Duración Total:</strong> ${duration} segundos</li>
                    <li><strong>Total Archivos Copiados:</strong> ${operation.completedFiles || 0}</li>
                    ${operation.totalFiles > 1 ? `<li><strong>Total Carpetas Creadas:</strong> ${Math.ceil((operation.totalFiles - operation.completedFiles) / 2) || 1}</li>` : ''}
                </ul>
            </div>
        </div>
        <div class="footer">
            <p>Gracias por usar CloneDrive.</p>
            <p><em>1 archivo adjunto • Analizado por Gmail</em></p>
        </div>
    </div>
</body>
</html>`;

      // Crear el mensaje de email con formato HTML
      const subject = `Proceso de copia completado - ${result.name}`;
      const message = [
        `To: ${user.email}`,
        `From: ${user.email}`,
        `Subject: ${subject}`,
        'MIME-Version: 1.0',
        'Content-Type: text/html; charset=utf-8',
        '',
        emailHtml
      ].join('\n');

      // Codificar el mensaje en base64
      const encodedMessage = Buffer.from(message)
        .toString('base64')
        .replace(/\+/g, '-')
        .replace(/\//g, '_')
        .replace(/=+$/, '');

      // Enviar el email
      await gmail.users.messages.send({
        userId: 'me',
        requestBody: {
          raw: encodedMessage,
        },
      });

      console.log(`✅ Notification email sent to ${user.email} for operation ${operationId}`);
      
    } catch (error) {
      console.error('Failed to send completion email:', error);
      // No lanzar error para no afectar la operación principal
    }
  }

  /**
   * List folders in the specified parent folder
   */
  async listFolders(parentId: string = 'root', pageToken?: string): Promise<{
    folders: DriveFileInfo[];
    nextPageToken?: string;
  }> {
    await this.ensureValidToken();
    
    try {
      const query = `'${parentId}' in parents and mimeType='application/vnd.google-apps.folder' and trashed=false`;
      
      const response = await this.drive.files.list({
        q: query,
        fields: 'files(id,name,parents),nextPageToken',
        pageSize: 20,
        pageToken: pageToken,
        orderBy: 'name'
      });

      return {
        folders: response.data.files || [],
        nextPageToken: response.data.nextPageToken
      };
    } catch (error) {
      console.error('Error listing folders:', error);
      throw new Error('Failed to list folders');
    }
  }

  /**
   * Get the folder path (breadcrumbs) for a given folder ID
   */
  async getFolderPath(folderId: string): Promise<{ id: string; name: string }[]> {
    if (folderId === 'root') {
      return [{ id: 'root', name: 'Mi Drive' }];
    }

    await this.ensureValidToken();

    try {
      const path: { id: string; name: string }[] = [];
      let currentId = folderId;

      while (currentId && currentId !== 'root') {
        const response = await this.drive.files.get({
          fileId: currentId,
          fields: 'id,name,parents'
        });

        const folder = response.data;
        path.unshift({ id: folder.id!, name: folder.name! });

        // Move to parent
        currentId = folder.parents && folder.parents.length > 0 ? folder.parents[0] : 'root';
      }

      // Add root at the beginning
      path.unshift({ id: 'root', name: 'Mi Drive' });

      return path;
    } catch (error) {
      console.error('Error getting folder path:', error);
      throw new Error('Failed to get folder path');
    }
  }
}
