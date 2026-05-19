import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/db";
import * as schema from "@/db/schema";
import type { Env } from "@/env";

export const getAuth = (env: Env) => {
  const db = getDb(env);
  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    database: drizzleAdapter(db, {
      provider: "pg",
      schema: { ...schema },
    }),
    emailAndPassword: {
      enabled: true,
    },
  });
};
