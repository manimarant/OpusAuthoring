import { attachErrorHandler, createApp } from "./app";
import { registerRoutes } from "./routes";
import { setupVite, serveStatic, log } from "./vite";

const app = createApp();

(async () => {
  const server = await registerRoutes(app);
  attachErrorHandler(app);

  if (app.get("env") === "development") {
    await setupVite(app, server);
  } else {
    serveStatic(app);
  }

  const port = parseInt(process.env.PORT || "5000", 10);
  server.listen(port, "localhost", () => {
    log(`serving on port ${port}`);
  });
})();
