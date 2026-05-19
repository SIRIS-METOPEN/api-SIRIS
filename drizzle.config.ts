import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

// Load from .dev.vars for Cloudflare Workers local development
config({ path: ".dev.vars" });

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) {
  throw new Error(
    "DATABASE_URL environment variable is required for drizzle-kit. " +
      "Please set it in .dev.vars or .env file",
  );
}

export default defineConfig({
  out: "./drizzle",
  schema: "./src/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: databaseUrl,
  },
  strict: true,
  verbose: true,
});
