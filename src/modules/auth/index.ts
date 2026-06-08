import { createRouter } from "../../factory";
import { getAuth } from "../../auth";

const router = createRouter();

router.on(["POST", "GET"], "/*", async (c) => {
  const path = c.req.path;
  const method = c.req.method;
  const origin = c.req.header("Origin") ?? "NO_ORIGIN";
  const rawCookieHeader = c.req.header("Cookie") ?? "NO_COOKIES";
  const isGetSession = path.includes("get-session");
  const isCallback = path.includes("callback");

  // === DIAGNOSTIC LOGGING ===
  console.log(`\n[AUTH] ${method} ${path}`);
  console.log(`[AUTH] Origin: ${origin}`);
  if (isGetSession || isCallback) {
    console.log(`[AUTH] Cookie header: ${rawCookieHeader}`);
    // List each cookie name (not values for security)
    const cookieNames = rawCookieHeader
      .split(";")
      .map((c) => c.trim().split("=")[0])
      .filter(Boolean);
    console.log(`[AUTH] Cookie names received: [${cookieNames.join(", ")}]`);
  }

  const frontendUrls = c.env.FRONTEND_URLS;
  const allowedOrigins = (
    Array.isArray(frontendUrls)
      ? frontendUrls
      : (frontendUrls as string).split(",")
  ).map((url) => url.trim());

  const corsHeaders: Record<string, string> = {};
  if (origin && origin !== "NO_ORIGIN" && allowedOrigins.includes(origin)) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
    console.log(`[AUTH] CORS headers will be set for origin: ${origin}`);
  } else {
    console.log(
      `[AUTH] WARN: Origin "${origin}" not in allowedOrigins: [${allowedOrigins.join(", ")}]`,
    );
  }

  try {
    const authResponse = await getAuth(c.env).handler(c.req.raw);
    console.log(`[AUTH] Response status: ${authResponse.status}`);

    // Extract Set-Cookie headers before copying the response
    const setCookies = authResponse.headers.getSetCookie
      ? authResponse.headers.getSetCookie()
      : [];
    console.log(`[AUTH] Set-Cookie headers count: ${setCookies.length}`);
    setCookies.forEach((cookie, i) => {
      // Log cookie name + attributes, but not the value
      const [nameVal, ...attrs] = cookie.split(";");
      const name = nameVal.split("=")[0];
      console.log(`[AUTH] Set-Cookie[${i}]: ${name}; ${attrs.join(";")}`);
    });

    // Build new response with CORS + individual Set-Cookie headers
    const response = new Response(authResponse.body, {
      status: authResponse.status,
      statusText: authResponse.statusText,
      headers: authResponse.headers,
    });

    // Apply CORS headers
    Object.entries(corsHeaders).forEach(([key, value]) => {
      response.headers.set(key, value);
    });

    // Re-apply Set-Cookie headers individually to prevent folding
    if (setCookies.length > 0) {
      response.headers.delete("Set-Cookie");
      setCookies.forEach((cookie) => {
        response.headers.append("Set-Cookie", cookie);
      });
    }

    return response;
  } catch (error: unknown) {
    console.error("[AUTH] ERROR:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    return c.json(
      {
        error: "Better Auth Internal Error",
        message: c.env.NODE_ENV === "development" ? errorMessage : undefined,
        stack: c.env.NODE_ENV === "development" ? errorStack : undefined,
      },
      500,
      corsHeaders,
    );
  }
});

export { router as authRouter };
