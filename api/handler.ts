import * as serverApp from "../server/app";
import * as serverRoutes from "../server/routes";

const appPromise = (async () => {
  const app = (serverApp as any).createApp();
  await (serverRoutes as any).registerRoutes(app);
  (serverApp as any).attachErrorHandler(app);
  return app;
})();

export default async function handler(req: any, res: any) {
  // Ensure the URL starts with /api for the Express routes to match
  if (req.url && !req.url.startsWith('/api')) {
    req.url = '/api' + (req.url.startsWith('/') ? '' : '/') + req.url;
  }
  console.log(`API Request: ${req.method} ${req.url}`);
  const app = await appPromise;
  return app(req, res);
}
