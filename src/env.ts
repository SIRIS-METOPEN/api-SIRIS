import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url()
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (env: Record<string, string>) => envSchema.parse(env);