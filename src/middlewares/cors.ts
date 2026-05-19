import { cors } from "hono/cors";
import { factory } from "../factory";

export const corsMiddleware = factory.createMiddleware((c, next) => {
  const frontendUrls = c.env.FRONTEND_URLS;
  const allowedOrigins = Array.isArray(frontendUrls)
    ? frontendUrls
    : (frontendUrls as string).split(",").map((url) => url.trim());

  return cors({
    origin: (origin) => {
      if (!origin) return "*";

      if (allowedOrigins.includes(origin)) {
        return origin;
      }
      return undefined;
    },
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowHeaders: ["Content-Type", "Authorization", "Cookie", "Set-Cookie"],
    exposeHeaders: ["Content-Length", "Set-Cookie"],
    maxAge: 600,
    credentials: true,
  })(c, next);
});
