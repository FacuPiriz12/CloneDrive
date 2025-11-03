import * as client from "openid-client";
import { Strategy, type VerifyFunction } from "openid-client/passport";

import passport from "passport";
import session from "express-session";
import type { Express, RequestHandler } from "express";
import memoize from "memoizee";
import connectPg from "connect-pg-simple";
import { storage } from "./storage";
import { createClient } from '@supabase/supabase-js';

if (!process.env.REPLIT_DOMAINS) {
  throw new Error("Environment variable REPLIT_DOMAINS not provided");
}

// Create Supabase client for server-side auth
function createSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
  
  if (!supabaseUrl || !supabaseAnonKey) {
    console.log('Supabase credentials not found, using Replit Auth only');
    return null;
  }
  
  return createClient(supabaseUrl, supabaseAnonKey);
}

const getOidcConfig = memoize(
  async () => {
    return await client.discovery(
      new URL(process.env.ISSUER_URL ?? "https://replit.com/oidc"),
      process.env.REPL_ID!
    );
  },
  { maxAge: 3600 * 1000 }
);

export function getSession() {
  const sessionTtl = 7 * 24 * 60 * 60 * 1000; // 1 week
  
  let sessionStore;
  
  // Use PostgreSQL store when DATABASE_URL is available (even in development)
  if (process.env.DATABASE_URL && process.env.DATABASE_URL.trim() !== '') {
    console.log('Using PostgreSQL session store');
    const pgStore = connectPg(session);
    sessionStore = new pgStore({
      conString: process.env.DATABASE_URL,
      createTableIfMissing: false,
      ttl: sessionTtl,
      tableName: "sessions",
    });
  } else {
    console.log('Using memory session store - sessions will be lost on server restart');
    console.log('Note: For persistent sessions with Supabase auth, DATABASE_URL is recommended but not required');
    // Memory store - sessions will be lost on server restart
    sessionStore = undefined; // Express session will use memory store by default
  }
  
  return session({
    secret: process.env.SESSION_SECRET!,
    store: sessionStore,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Solo seguro en producción
      sameSite: 'lax',
      maxAge: sessionTtl,
    },
  });
}

function updateUserSession(
  user: any,
  tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers
) {
  user.claims = tokens.claims();
  user.access_token = tokens.access_token;
  user.refresh_token = tokens.refresh_token;
  user.expires_at = user.claims?.exp;
}

async function upsertUser(
  claims: any,
) {
  await storage.upsertUser({
    id: claims["sub"],
    email: claims["email"],
    firstName: claims["first_name"],
    lastName: claims["last_name"],
    profileImageUrl: claims["profile_image_url"],
  });
}

export async function setupAuth(app: Express) {
  app.set("trust proxy", 1);
  app.use(getSession());
  app.use(passport.initialize());
  app.use(passport.session());

  const config = await getOidcConfig();

  const verify: VerifyFunction = async (
    tokens: client.TokenEndpointResponse & client.TokenEndpointResponseHelpers,
    verified: passport.AuthenticateCallback
  ) => {
    const user = {};
    updateUserSession(user, tokens);
    await upsertUser(tokens.claims());
    verified(null, user);
  };

  for (const domain of process.env
    .REPLIT_DOMAINS!.split(",")) {
    const strategy = new Strategy(
      {
        name: `replitauth:${domain}`,
        config,
        scope: "openid email profile offline_access",
        callbackURL: `https://${domain}/api/callback`,
      },
      verify,
    );
    passport.use(strategy);
  }

  passport.serializeUser((user: Express.User, cb) => cb(null, user));
  passport.deserializeUser((user: Express.User, cb) => cb(null, user));

  app.get("/api/login", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, {
      prompt: "login consent",
      scope: ["openid", "email", "profile", "offline_access"],
    })(req, res, next);
  });

  app.get("/api/callback", (req, res, next) => {
    passport.authenticate(`replitauth:${req.hostname}`, (err: any, user: any) => {
      if (err) {
        console.error('Authentication error:', err);
        return res.redirect("/api/login");
      }
      
      if (!user) {
        return res.redirect("/api/login");
      }
      
      req.logIn(user, (err) => {
        if (err) {
          console.error('Login error:', err);
          return res.redirect("/api/login");
        }
        
        // Ensure session is saved before redirecting
        req.session!.save((err) => {
          if (err) {
            console.error('Session save error:', err);
          }
          return res.redirect("/");
        });
      });
    })(req, res, next);
  });

  // Logout route - POST method for better session handling
  app.post("/api/logout", (req, res) => {
    console.log('Solicitud de logout recibida');
    console.log('Session ID:', req.sessionID);
    
    // Handle development logout
    if (process.env.NODE_ENV === "development") {
      req.session!.destroy((err) => {
        if (err) {
          console.error('Error al destruir sesión:', err);
          return res.status(500).json({ error: 'No se pudo cerrar sesión' });
        }
        
        console.log('Sesión destruida exitosamente');
        res.clearCookie('connect.sid');
        res.json({ success: true, redirect: '/' });
      });
      return;
    }
    
    req.logout(() => {
      req.session!.destroy((err) => {
        if (err) {
          console.error('Error al destruir sesión:', err);
          return res.status(500).json({ error: 'No se pudo cerrar sesión' });
        }
        
        res.clearCookie('connect.sid');
        res.redirect(
          client.buildEndSessionUrl(config, {
            client_id: process.env.REPL_ID!,
            post_logout_redirect_uri: `${req.protocol}://${req.hostname}`,
          }).href
        );
      });
    });
  });

  // Development login endpoint
  app.get("/api/dev-login", (req, res) => {
    if (process.env.NODE_ENV === "development") {
      req.session!.devLoggedIn = true;
      req.session!.save(() => {
        return res.redirect("/");
      });
      return;
    }
    res.redirect("/api/login");
  });
}

export const isAuthenticated: RequestHandler = async (req, res, next) => {
  // Check for Supabase auth first
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.substring(7);
    const supabase = createSupabaseClient();
    
    if (supabase) {
      try {
        const { data: { user }, error } = await supabase.auth.getUser(token);
        
        if (user && !error) {
          // Create user object compatible with existing code
          req.user = {
            claims: {
              sub: user.id,
              email: user.email || '',
              first_name: user.user_metadata?.first_name || user.user_metadata?.name?.split(' ')[0] || '',
              last_name: user.user_metadata?.last_name || user.user_metadata?.name?.split(' ').slice(1).join(' ') || ''
            },
            access_token: token,
            expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
          };
          
          // Upsert user in database with Supabase auth provider
          await storage.upsertUser({
            id: user.id,
            email: user.email || '',
            firstName: user.user_metadata?.first_name || user.user_metadata?.name?.split(' ')[0] || '',
            lastName: user.user_metadata?.last_name || user.user_metadata?.name?.split(' ').slice(1).join(' ') || '',
            profileImageUrl: user.user_metadata?.avatar_url || '',
            authProvider: 'supabase'
          });
          
          return next();
        }
      } catch (error) {
        console.error('Supabase auth error:', error);
      }
    }
  }
  
  // In development, use session-based authentication
  if (process.env.NODE_ENV === "development") {
    // Check if user is logged in (default is logged out)
    const isLoggedIn = req.session?.devLoggedIn;
    if (!isLoggedIn) {
      return res.status(401).json({ message: "Not authenticated in development" });
    }
    
    // Create a mock user for development
    req.user = {
      claims: {
        sub: "dev-user-123",
        email: "developer@example.com",
        first_name: "Dev",
        last_name: "User"
      },
      access_token: "dev-token",
      expires_at: Math.floor(Date.now() / 1000) + 3600 // 1 hour from now
    };
    return next();
  }

  const user = req.user as any;

  if (!req.isAuthenticated() || !user.expires_at) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  const now = Math.floor(Date.now() / 1000);
  if (now <= user.expires_at) {
    return next();
  }

  const refreshToken = user.refresh_token;
  if (!refreshToken) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }

  try {
    const config = await getOidcConfig();
    const tokenResponse = await client.refreshTokenGrant(config, refreshToken);
    updateUserSession(user, tokenResponse);
    return next();
  } catch (error) {
    res.status(401).json({ message: "Unauthorized" });
    return;
  }
};

export const isAdmin: RequestHandler = async (req, res, next) => {
  try {
    const userId = (req.user as any).claims.sub;
    
    // In development, dev-user-123 is always admin
    if (process.env.NODE_ENV === "development" && userId === "dev-user-123") {
      return next();
    }
    
    const user = await storage.getUser(userId);
    
    if (!user) {
      return res.status(403).json({ message: "User not found" });
    }
    
    if (user.role !== 'admin') {
      return res.status(403).json({ message: "Access denied. Admin privileges required." });
    }
    
    next();
  } catch (error) {
    console.error('Error checking admin privileges:', error);
    res.status(500).json({ message: "Internal server error" });
  }
};
