/**
 * Factory Pattern for Hono
 *
 * Single source of truth untuk Hono app creation.
 * Semua module HARUS menggunakan `createRouter()` dari file ini,
 * bukan `new Hono()` atau `new OpenAPIHono()` langsung.
 */

import { OpenAPIHono } from "@hono/zod-openapi";
import { createFactory } from "hono/factory";
import type { Context } from "hono";
import type { Env } from "./env";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/**
 * Request-scoped context variables — di-set oleh middleware, dibaca oleh handler.
 * Akses via `c.get('user')` atau `c.var.user`.
 */
export type AppVariables = {
  /** User yang sedang login — di-set oleh auth middleware */
  user?: {
    id: string;
    name: string;
    email: string;
    image?: string | null;
  };
  /** Session aktif — di-set oleh auth middleware */
  session?: {
    id: string;
    userId: string;
    expiresAt: Date;
  };
  /** Unique request ID untuk tracing */
  requestId?: string;
};

/**
 * Full application environment type (Bindings + Variables).
 * Dipakai di semua Hono instance di seluruh aplikasi.
 */
export type AppEnv = {
  Bindings: Env;
  Variables: AppVariables;
};

// ---------------------------------------------------------------------------
// Factory & Router
// ---------------------------------------------------------------------------

/**
 * Hono factory dengan typed AppEnv.
 * Dipakai untuk membuat middleware dan handler yang type-safe.
 *
 * @example
 * const authMiddleware = factory.createMiddleware(async (c, next) => {
 *   c.set('user', { id: '...', name: '...', email: '...' });
 *   await next();
 * });
 */
export const factory = createFactory<AppEnv>();

/**
 * Buat Hono router baru dengan tipe AppEnv.
 * Gunakan ini di semua module, bukan `new Hono()` atau `new OpenAPIHono()`.
 *
 * @example
 * const router = createRouter();
 * router.get('/health', (c) => c.json({ status: 'ok' }));
 */
export const createRouter = (): OpenAPIHono<AppEnv> =>
  new OpenAPIHono<AppEnv>();

// ---------------------------------------------------------------------------
// Convenience Types
// ---------------------------------------------------------------------------

/** Type-safe Context untuk handler yang didefinisikan di luar factory.createHandlers */
export type AppContext = Context<AppEnv>;

/** Re-export untuk convenience */
export type { MiddlewareHandler, Next } from "hono";
