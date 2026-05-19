import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI } from "better-auth/plugins";
import { getDb } from "./db";
import * as schema from "./db/schema";
import type { Env } from "./env";

/**
 * Creates a fresh Better Auth instance for each request.
 * IMPORTANT: Do NOT cache auth instances globally in Cloudflare Workers.
 * I/O objects (db connections) created in one request context cannot be
 * accessed from another request's handler due to Cloudflare's isolation model.
 *
 * Uses Cloudflare Hyperdrive for connection pooling when available (production),
 * falling back to direct Neon connection for local development.
 */
export function createAuth(env: Env) {
  // Get a fresh database connection for this request
  const db = getDb(env);

  return betterAuth({
    database: drizzleAdapter(db, {
      provider: "pg", // Use 'postgresql' for Neon/Postgres
      schema: {
        user: schema.users,
        session: schema.session,
        account: schema.account,
        verification: schema.verification,
      },
    }),

    user: {
      additionalFields: {
        role: {
          type: "string",
          required: false,
          defaultValue: "tenant",
        },
      },
    },

    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    trustedOrigins: [
      ...(Array.isArray(env.FRONTEND_URLS)
        ? env.FRONTEND_URLS
        : (env.FRONTEND_URLS as string).split(",").map((url) => url.trim())),
      env.BETTER_AUTH_URL,
    ],

    account: {
      skipStateCookieCheck: true,
    },

    advanced: {
      trustProxy: true,
      cookiePrefix: "rents",
      defaultCookieAttributes: {
        sameSite: "none",
        secure: true,
      },
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5,
      },
    },

    socialProviders: {
      google: {
        clientId: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
      },
    },

    rateLimit: {
      window: 60,
      max: 10,
    },

    plugins: [
      openAPI({
        disableDefaultReference: true,
      }),
    ],
  });
}

/**
 * @deprecated Use createAuth(env) directly in request handlers for Cloudflare Workers compatibility
 */
export const getAuth = (env: Env) => createAuth(env);
