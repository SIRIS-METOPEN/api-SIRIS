import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Env } from "@/env";

// Do not cache the database connection pool in the global scope
export const getDb = (env: Env) => {
  const client = postgres(env.DATABASE_URL);
  return drizzle(client, { schema });
};