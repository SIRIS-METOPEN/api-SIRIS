import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";
import type { Env } from "../env";

/**
 * Creates a fresh DB connection per-request.
 * Cloudflare Workers is stateless — module-level singletons are unreliable
 * across invocations.
 *
 * We use Neon Serverless HTTP driver. This avoids TCP connection leaks
 * in Cloudflare Workers and bypasses Hyperdrive caching which causes
 * read-after-write inconsistencies for authentication.
 *
 * @param env - The environment object containing DATABASE_URL
 */
export const getDb = (env: Env) => {
  const connectionString = env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "No database connection string available. Check DATABASE_URL.",
    );
  }

  const sql = neon(connectionString);
  return drizzle(sql, { schema });
};
