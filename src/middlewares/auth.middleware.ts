import { createMiddleware } from "hono/factory";
import { getAuth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import type { AppEnv } from "@/factory";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw });

  if (!session) {
    throw new UnauthorizedError();
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});
