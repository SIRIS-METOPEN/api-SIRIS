import { getAuth } from "../auth";
import { factory } from "../factory";

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
    return c.json({ message: "Unauthorized" }, 401);
  }

  c.set("user", session.user);
  c.set("session", session.session);

  await next();
});
