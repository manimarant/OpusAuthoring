import express, { type Request, type Response, type NextFunction } from "express";
import dotenv from "dotenv";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { log } from "./vite";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function getUploadsDir() {
  if (process.env.VERCEL) {
    return path.join("/tmp", "opuslearn-uploads");
  }

  return path.join(__dirname, "..", "uploads");
}

function ensureUploadsDir() {
  const uploadsDir = getUploadsDir();
  if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir, { recursive: true });
  }
}

export function createApp() {
  ensureUploadsDir();

  const app = express();

  app.use((req, res, next) => {
    if (req.path.includes("/upload") || req.path.includes("/media-upload")) {
      return next();
    }
    express.json()(req, res, next);
  });

  app.use((req, res, next) => {
    if (req.path.includes("/upload") || req.path.includes("/media-upload")) {
      return next();
    }
    express.urlencoded({ extended: false })(req, res, next);
  });

  app.use((req, res, next) => {
    const start = Date.now();
    const requestPath = req.path;
    let capturedJsonResponse: Record<string, any> | undefined;

    const originalResJson = res.json;
    res.json = function (bodyJson, ...args) {
      capturedJsonResponse = bodyJson;
      return originalResJson.apply(res, [bodyJson, ...args]);
    };

    res.on("finish", () => {
      const duration = Date.now() - start;
      if (requestPath.startsWith("/api")) {
        let logLine = `${req.method} ${requestPath} ${res.statusCode} in ${duration}ms`;
        if (capturedJsonResponse) {
          logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
        }

        if (logLine.length > 80) {
          logLine = `${logLine.slice(0, 79)}...`;
        }

        log(logLine);
      }
    });

    next();
  });

  return app;
}

export function attachErrorHandler(app: express.Express) {
  app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
    const status = err.status || err.statusCode || 500;
    const message = err.message || "Internal Server Error";

    res.status(status).json({ message });
    throw err;
  });
}
