import * as serverApp from "../server/app";
import * as serverRoutes from "../server/routes";

const appPromise = (async () => {
  const app = (serverApp as any).createApp();
  await (serverRoutes as any).registerRoutes(app);
  (serverApp as any).attachErrorHandler(app);
  return app;
})();

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
