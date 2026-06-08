import { createRouter } from "../../factory";
import { getAuth } from "../../auth";

const router = createRouter();

router.on(["POST", "GET"], "/*", async (c) => {
  console.log("=== AUTH REQUEST START ===");
  console.log("Method:", c.req.method);
  console.log("Path:", c.req.path);
  console.log("Origin:", c.req.header("Origin"));

  const frontendUrls = c.env.FRONTEND_URLS;
  const allowedOrigins = Array.isArray(frontendUrls)
    ? frontendUrls
    : (frontendUrls as string).split(",").map((url) => url.trim());

  const origin = c.req.header("Origin");
  const corsHeaders: Record<string, string> = {};

  if (origin && allowedOrigins.includes(origin)) {
    corsHeaders["Access-Control-Allow-Origin"] = origin;
    corsHeaders["Access-Control-Allow-Credentials"] = "true";
  }

  try {
    console.log("Calling Better Auth handler...");
    const authResponse = await getAuth(c.env).handler(c.req.raw);
    console.log("Better Auth response status:", authResponse.status);

    // Create a new Response copy to preserve multiple Set-Cookie headers
    // while keeping headers modifiable for CORS headers injection.
    const response = new Response(authResponse.body, authResponse);
    Object.entries(corsHeaders).forEach(([key, value]) => {
      if (!response.headers.has(key)) {
        response.headers.set(key, value);
      }
    });

    console.log("=== AUTH REQUEST SUCCESS ===");
    return response;
  } catch (error: unknown) {
    console.error("=== AUTH REQUEST ERROR ===");
    console.error("[BetterAuth Error]:", error);

    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    const errorStack = error instanceof Error ? error.stack : undefined;

    // Log additional error details for database connection debugging
    if (error && typeof error === "object" && "cause" in error) {
      console.error("Error cause:", (error as { cause: unknown }).cause);
    }

    console.error("Error message:", errorMessage);
    console.error("Error stack:", errorStack);

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
