import { Scalar } from "@scalar/hono-api-reference";
import type { ContentfulStatusCode } from "hono/utils/http-status";
import { getAuth } from "./auth";
import { EnvSchema } from "./env";
import { createRouter } from "./factory";
import { authRouter } from "./modules/auth";
import { reportsRouter } from "./modules/reports";
import { corsMiddleware } from "./middlewares/cors";
import z from "zod";

const app = createRouter();

const openApiInfo = {
  version: "1.0.0",
  title: "SIRIS API",
  description:
    "API Documentation untuk sistem SIRIS. Autentikasi utama menggunakan Google OAuth via Better-Auth.",
};

// cors pertama sebelum validation apapun
app.use("*", corsMiddleware);

// Env validation setelah CORS
app.use("*", async (c, next) => {
  const result = EnvSchema.safeParse(c.env);
  if (!result.success) {
    const errors = result.error.issues.map((i) => i.message);
    return c.json({ message: "Server misconfiguration", errors }, 500);
  }
  await next();
});

// Base OpenAPI Documentation
app.doc("/doc", {
  openapi: "3.0.0",
  info: openApiInfo,
});

const AuthApiSchema = z.object({
  paths: z
    .record(
      z.string(),
      z.record(
        z.string(),
        z.object({ tags: z.array(z.string()).optional() }).passthrough(),
      ),
    )
    .optional(),
  components: z
    .object({
      schemas: z.record(z.string(), z.unknown()).optional(),
      securitySchemes: z.record(z.string(), z.unknown()).optional(),
    })
    .passthrough()
    .optional(),
});

const openAPICache = new Map<string, unknown>();

app.get("/api/openapi.json", async (c) => {
  const cacheKey = c.env.DATABASE_URL;
  if (openAPICache.has(cacheKey)) return c.json(openAPICache.get(cacheKey));

  const auth = getAuth(c.env);
  const rawAuthSchema = await auth.api.generateOpenAPISchema();
  const authSchema = AuthApiSchema.parse(rawAuthSchema);

  const honoSchema = app.getOpenAPIDocument({
    openapi: "3.0.0",
    info: openApiInfo,
  });

  const authPaths = authSchema.paths || {};
  const authComponents = authSchema.components || {};

  const mergedPaths: Record<string, unknown> = { ...honoSchema.paths };
  for (const path in authPaths) {
    const methods = authPaths[path];
    for (const method in methods) {
      const routeInfo = methods[method];
      if (!routeInfo.tags) {
        routeInfo.tags = ["Auth"];
      }
    }
    mergedPaths[`/api/auth${path}`] = methods;
  }

  const mergedSchema = {
    ...honoSchema,
    paths: mergedPaths,
    components: {
      ...honoSchema.components,
      ...authComponents,
      schemas: {
        ...honoSchema.components?.schemas,
        ...authComponents.schemas,
      },
    },
  };

  openAPICache.set(cacheKey, mergedSchema);
  return c.json(mergedSchema);
});

app.get(
  "/reference",
  Scalar({
    pageTitle: "SIRIS API Reference",
    theme: "kepler",
    sources: [{ url: "/api/openapi.json", title: "SIRIS API" }],
  }),
);

// Auth — semua /api/auth/* didelegasikan ke Better Auth
app.route("/api/auth", authRouter);

// Reports
app.route("/api/reports", reportsRouter);

app.get("/", (c) => c.text("SIRIS API is running."));

// Temporary Testing UI for Google Login
app.get("/test-login", (c) => {
  return c.html(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Test OAuth Login</title>
        <style>
          body { font-family: sans-serif; display: flex; justify-content: center; align-items: center; height: 100vh; background: #f0f0f0; }
          .card { background: white; padding: 40px; border-radius: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); text-align: center; }
          h1 { margin-bottom: 20px; font-size: 24px; }
          button { padding: 15px 30px; font-size: 18px; cursor: pointer; background: #4285F4; color: white; border: none; border-radius: 5px; }
          button:hover { background: #3367D6; }
          pre { margin-top: 20px; text-align: left; background: #f5f5f5; padding: 15px; border-radius: 5px; font-size: 12px; max-height: 300px; overflow: auto; }
          .status { margin-top: 10px; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="card">
          <h1>Test OAuth Login</h1>
          <button onclick="login()">Login with Google</button>
          <div class="status" id="status"></div>
          <pre id="result"></pre>
        </div>
        <script>
          async function login() {
            const statusEl = document.getElementById("status");
            const resultEl = document.getElementById("result");
            statusEl.textContent = "Redirecting to Google...";
            resultEl.textContent = "";
            try {
              const res = await fetch("/api/auth/sign-in/social", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ provider: "google", callbackURL: "${c.env.BETTER_AUTH_URL}/" })
              });
              const data = await res.json();
              if (data.url) {
                window.location.href = data.url;
              } else {
                statusEl.textContent = "Error";
                resultEl.textContent = JSON.stringify(data, null, 2);
              }
            } catch (e) {
              statusEl.textContent = "Error";
              resultEl.textContent = e.message;
            }
          }

          // Check session unconditionally on load
          document.getElementById("status").textContent = "Checking session...";
          fetch("/api/auth/get-session", { credentials: "include" })
            .then(r => r.json())
            .then(data => {
              if (data && data.user) {
                document.getElementById("status").textContent = "Logged in as " + data.user.email;
                document.getElementById("result").textContent = JSON.stringify(data, null, 2);
              } else {
                document.getElementById("status").textContent = "Not logged in. Click the button to login.";
                
                // Show error if redirected with error
                const urlParams = new URLSearchParams(window.location.search);
                if (urlParams.has("error")) {
                  document.getElementById("result").textContent = "OAuth Error: " + urlParams.get("error");
                }
              }
            })
            .catch(e => {
              document.getElementById("status").textContent = "Session check failed";
              document.getElementById("result").textContent = e.message;
            });
        </script>
      </body>
    </html>
  `);
});

app.notFound((c) => {
  return c.json({ message: "Route not found", data: [] }, 404);
});

app.onError((err, c) => {
  console.error("Global Hono Error:", err);

  const status =
    "status" in err && typeof err.status === "number" ? err.status : 500;

  return c.json(
    {
      message:
        c.env.NODE_ENV === "development"
          ? err.message
          : "Internal Server Error",
      data: c.env.NODE_ENV === "development" ? [err.stack] : [],
    },
    status as ContentfulStatusCode,
  );
});

export { app };
