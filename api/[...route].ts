import { attachErrorHandler, createApp } from "../server/app";
import { registerRoutes } from "../server/routes";

const appPromise = (async () => {
  const app = createApp();
  await registerRoutes(app);
  attachErrorHandler(app);
  return app;
})();

export default async function handler(req: any, res: any) {
  const app = await appPromise;
  return app(req, res);
}
