import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";
import type { Env } from "../env";

/**
 * Creates a fresh DB connection per-request.
 * Cloudflare Workers is stateless — module-level singletons are unreliable
 * across invocations. HYPERDRIVE is used in production; DATABASE_URL for local dev.
 *
 * @param env - The environment object containing HYPERDRIVE binding or DATABASE_URL
 */
export const getDb = (env: Env) => {
  const connectionString = env.HYPERDRIVE?.connectionString ?? env.DATABASE_URL;

  if (!connectionString) {
    throw new Error(
      "No database connection string available. Check HYPERDRIVE or DATABASE_URL.",
    );
  }

  const pool = new pg.Pool({ connectionString, max: 1 });
  return drizzle(pool, { schema });
};
