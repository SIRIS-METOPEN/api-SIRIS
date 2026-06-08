import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { openAPI, anonymous } from "better-auth/plugins";
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
  const db = getDb(env);
  const isProduction = env.BETTER_AUTH_URL?.startsWith("https://");

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
          defaultValue: "user",
        },
      },
    },

    baseURL: env.BETTER_AUTH_URL,
    secret: env.BETTER_AUTH_SECRET,

    trustedOrigins: [
      ...(Array.isArray(env.FRONTEND_URLS)
        ? env.FRONTEND_URLS
        : (env.FRONTEND_URLS as string).split(",")
      ).map((url) => url.trim().replace(/\/$/, "")),
      env.BETTER_AUTH_URL.replace(/\/$/, ""),
    ],

    account: {
      skipStateCookieCheck: true,
      accountLinking: {
        enabled: true,
        trustedProviders: ["google"],
      },
    },

    databaseHooks: {
      user: {
        create: {
          before: async (user) => {
            return {
              data: {
                ...user,
                emailVerified: true,
              },
            };
          },
        },
      },
    },

    advanced: {
      trustProxy: true,
      cookiePrefix: "siris",
      defaultCookieAttributes: isProduction
        ? {
            sameSite: "none",
            secure: true,
          }
        : undefined,
    },

    session: {
      expiresIn: 60 * 60 * 24 * 7,
      updateAge: 60 * 60 * 24,
      cookieCache: {
        enabled: true,
        maxAge: 5,
      },
    },

    emailAndPassword: {
      enabled: true,
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
      anonymous(),
    ],
  });
}

/**
 * @deprecated Use createAuth(env) directly in request handlers for Cloudflare Workers compatibility
 */
export const getAuth = (env: Env) => createAuth(env);
