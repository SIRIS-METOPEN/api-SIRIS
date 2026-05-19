import { z } from "zod";

/**
 * Cloudflare Hyperdrive binding type
 * Provides connection pooling at the edge for Neon PostgreSQL
 */
export interface Hyperdrive {
  /** Connection string to use for database connections through Hyperdrive */
  connectionString: string;
}

/**
 * Cloudinary configuration
 * Used for image storage and CDN delivery
 */
export interface CloudinaryConfig {
  cloudName: string;
  apiKey: string;
  apiSecret: string;
}

export const EnvSchema = z.object({
  // Use HYPERDRIVE connection string when available (production),
  // fallback to DATABASE_URL for local development
  DATABASE_URL: z.string().url("DATABASE_URL harus berupa URL yang valid"),
  GOOGLE_CLIENT_ID: z.string().min(1, "GOOGLE_CLIENT_ID wajib diisi"),
  GOOGLE_CLIENT_SECRET: z.string().min(1, "GOOGLE_CLIENT_SECRET wajib diisi"),
  BETTER_AUTH_SECRET: z
    .string()
    .min(32, "BETTER_AUTH_SECRET minimal 32 karakter"),
  BETTER_AUTH_URL: z
    .string()
    .url("BETTER_AUTH_URL harus berupa URL yang valid"),
  FRONTEND_URLS: z
    .string()
    .min(1, "FRONTEND_URLS wajib diisi")
    .transform((val) =>
      val
        .split(",")
        .map((url) => url.trim())
        .filter(Boolean),
    )
    .pipe(
      z
        .array(
          z.string().url({ message: "Setiap URL harus berupa URL yang valid" }),
        )
        .min(1, "FRONTEND_URLS harus berisi setidaknya satu URL yang valid"),
    ),
  NODE_ENV: z.enum(["development", "production"]).optional(),
  CLOUDINARY_CLOUD_NAME: z.string().min(1, "CLOUDINARY_CLOUD_NAME wajib diisi"),
  CLOUDINARY_API_KEY: z.string().min(1, "CLOUDINARY_API_KEY wajib diisi"),
  CLOUDINARY_API_SECRET: z.string().min(1, "CLOUDINARY_API_SECRET wajib diisi"),
});

export type Env = z.infer<typeof EnvSchema> & {
  /** Cloudflare Hyperdrive binding for connection pooling */
  HYPERDRIVE?: Hyperdrive;
};
