import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import notFound from "stoker/middlewares/not-found";
import onError from "stoker/middlewares/on-error";
import { apiReference } from "@scalar/hono-api-reference";
import { getAuth } from "./auth";
import { parseEnv } from "./env";
import type { AppEnv } from "./factory";
import "zod-openapi/extend";

export const app = new OpenAPIHono<AppEnv>();

// Parse Env early
app.use("*", async (c, next) => {
  // @ts-expect-error - overriding env for type safety
  c.env = parseEnv(c.env as unknown);
  await next();
});

// Global Middlewares
app.use("*", logger());
app.use("*", cors());

// Auth Route
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

// Mount OpenAPI Spec
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "SIRIS API",
    version: "1.0.0",
    description: "API for SIRIS Project",
  },
});

// Mount Scalar UI
app.get(
  "/docs",
  apiReference({
    spec: { url: "/openapi.json" },
  }),
);

// Fallback handlers
app.notFound(notFound);
app.onError(onError);
