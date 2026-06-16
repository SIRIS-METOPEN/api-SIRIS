import { getAuth } from "../auth";
import { factory, type AppVariables } from "../factory";
import * as HttpStatusCodes from "stoker/http-status-codes";

/**
 * Auth Middleware — Proteksi rute yang memerlukan login.
 * Mengambil session dari Better Auth, mengecek validitasnya,
 * dan menyimpan data user/session ke dalam context Hono.
 *
 * @throws 401 Unauthorized jika session tidak valid atau tidak ada.
 */
export const authMiddleware = factory.createMiddleware(async (c, next) => {
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({
    headers: c.req.raw.headers,
  });

  if (!session) {
    return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
  }

  c.set("user", session.user as AppVariables["user"]);
  c.set("session", session.session);

  await next();
});

/**
 * Admin Middleware — Proteksi rute khusus admin.
 * Memastikan user memiliki role 'admin'.
 *
 * @throws 403 Forbidden jika role bukan admin.
 */
export const adminMiddleware = factory.createMiddleware(async (c, next) => {
  let user = c.get("user");

  if (!user) {
    const auth = getAuth(c.env);
    const session = await auth.api.getSession({
      headers: c.req.raw.headers,
    });
    if (!session) {
      return c.json({ message: "Unauthorized" }, HttpStatusCodes.UNAUTHORIZED);
    }
    user = session.user as AppVariables["user"];
    c.set("user", user);
    c.set("session", session.session);
  }

  if (!user || user.role !== "admin") {
    return c.json({ message: "Forbidden" }, HttpStatusCodes.FORBIDDEN);
  }

  await next();
});
