import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";
import { createServer } from "http";
import { startQueueWorker } from "./queueWorker";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      if (logLine.length > 80) {
        logLine = logLine.slice(0, 79) + "…";
      }

      log(logLine);
    }
  });

  next();
});

(async () => {
  const server = await registerRoutes(app);

  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });

  // Setup Vite for React development
  const httpServer = createServer(app);
  await setupVite(app, httpServer);

  // ALWAYS serve the app on the port specified in the environment variable PORT
  // Other ports are firewalled. Default to 5000 if not specified.
  // this serves both the API and the client.
  // It is the only port that is not firewalled.
  const port = parseInt(process.env.PORT || '5000', 10);
  httpServer.listen(port, "0.0.0.0", () => {
    log(`serving on port ${port}`);
    
    // Debug Supabase environment variables
    console.log('\n🔍 SUPABASE ENVIRONMENT VARIABLES DEBUG:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('SUPABASE_URL:', process.env.SUPABASE_URL ? 'SET' : 'NOT SET');
    console.log('SUPABASE_ANON_KEY:', process.env.SUPABASE_ANON_KEY ? 'SET' : 'NOT SET');
    if (process.env.SUPABASE_URL) {
      console.log('SUPABASE_URL length:', process.env.SUPABASE_URL.length);
      console.log('SUPABASE_URL preview:', process.env.SUPABASE_URL.substring(0, 30) + '...');
    }
    if (process.env.SUPABASE_ANON_KEY) {
      console.log('SUPABASE_ANON_KEY length:', process.env.SUPABASE_ANON_KEY.length);
      console.log('SUPABASE_ANON_KEY preview:', process.env.SUPABASE_ANON_KEY.substring(0, 30) + '...');
    }
    const supabaseKeys = Object.keys(process.env).filter(key => key.includes('SUPABASE'));
    console.log('All SUPABASE keys:', supabaseKeys);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    // Display OAuth redirect URIs for easy configuration
    const domain = process.env.REPLIT_DEV_DOMAIN || `localhost:${port}`;
    const protocol = process.env.REPLIT_DEV_DOMAIN ? 'https' : 'http';
    
    console.log('🔗 OAUTH REDIRECT URIs - Add these to your OAuth applications:');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`📍 Google Cloud Console:`);
    console.log(`   ${protocol}://${domain}/api/auth/google/callback`);
    console.log(`📍 Dropbox App Console:`);
    console.log(`   ${protocol}://${domain}/api/auth/dropbox/callback`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
  });
  
  // Start queue worker for background job processing (once after server setup)
  try {
    startQueueWorker({
      globalConcurrency: 5,
      pollInterval: 2000
    });
    console.log('🚀 Queue worker started successfully');
  } catch (error) {
    console.error('❌ Failed to start queue worker:', error);
  }
})();
