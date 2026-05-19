# Hono + Drizzle + Better Auth Setup Implementation Plan (Cloudflare Workers)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Initialize a modular monolith backend for `api-SIRIS` using Cloudflare Workers, Hono, Drizzle ORM (PostgreSQL), Better Auth, Stoker, and OpenAPI.

**Architecture:** A robust modular monolith approach matching `RentSafe-ai-be`. Features are separated by domain into `src/modules/`, cross-domain logic in `src/services/`, and single-source-of-truth configurations in `src/factory.ts` and `src/env.ts`. It uses Wrangler and Cloudflare Workers runtime. Database connections are recreated per request, not cached as singletons.

**Tech Stack:** Cloudflare Workers, Hono, Drizzle ORM (Postgres), Better Auth, Zod, Stoker, Scalar, Oxlint, Oxfmt.

---

### Task 1: Project Initialization and Dependencies

**Files:**

- Create: `package.json`
- Create: `tsconfig.json`
- Create: `wrangler.toml`

- [ ] **Step 1: Initialize Bun project**

```bash
cd "d:\kuliah\smt 4\metopen\SIRIS\api-SIRIS"
bun init -y
```

- [ ] **Step 2: Install dependencies**

```bash
cd "d:\kuliah\smt 4\metopen\SIRIS\api-SIRIS"
bun add hono better-auth drizzle-orm postgres stoker @hono/zod-openapi @scalar/hono-api-reference zod drizzle-zod
bun add -d @cloudflare/workers-types wrangler typescript @types/pg drizzle-kit oxlint oxfmt
```

- [ ] **Step 3: Setup tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ESNext",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "skipLibCheck": true,
    "lib": ["ESNext"],
    "types": ["@cloudflare/workers-types"],
    "jsx": "react-jsx",
    "jsxImportSource": "hono/jsx",
    "baseUrl": ".",
    "paths": {
      "@/*": ["./src/*"]
    }
  }
}
```

- [ ] **Step 4: Update package.json scripts**

```bash
cd "d:\kuliah\smt 4\metopen\SIRIS\api-SIRIS"
npm pkg set scripts.dev="wrangler dev"
npm pkg set scripts.deploy="wrangler deploy --minify"
npm pkg set scripts.db:generate="drizzle-kit generate"
npm pkg set scripts.db:migrate="drizzle-kit migrate"
npm pkg set scripts.db:push="drizzle-kit push"
npm pkg set scripts.fl="oxlint && oxfmt --write"
npm pkg set scripts.check="tsc --noEmit"
```

- [ ] **Step 5: Setup wrangler.toml**

```toml
name = "api-siris"
compatibility_date = "2024-04-01"
main = "src/index.ts"

[observability]
enabled = true

[vars]
NODE_ENV = "development"
```

- [ ] **Step 6: Commit**

```bash
cd "d:\kuliah\smt 4\metopen\SIRIS\api-SIRIS"
git add package.json bun.lockb tsconfig.json wrangler.toml
git commit -m "chore: initialize project with cloudflare workers and dependencies"
```

### Task 2: Core Configuration (Env & Factory)

**Files:**

- Create: `src/env.ts`
- Create: `src/factory.ts`
- Create: `src/lib/errors.ts`

- [ ] **Step 1: Create environment validation**

```typescript
import { z } from "zod";

const envSchema = z.object({
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
});

export type Env = z.infer<typeof envSchema>;

export const parseEnv = (env: Record<string, string>) => envSchema.parse(env);
```

- [ ] **Step 2: Create AppError classes**

```typescript
export class AppError extends Error {
  constructor(
    public statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AppError {
  constructor(message = "Resource not found") {
    super(404, message);
  }
}

export class ValidationError extends AppError {
  constructor(message = "Validation error") {
    super(400, message);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message = "Unauthorized") {
    super(401, message);
  }
}
```

- [ ] **Step 3: Create Hono factory**

```typescript
import { createFactory } from "hono/factory";
import type { Env } from "./env";

export interface AppEnv {
  Bindings: Env;
  Variables: {
    user: import("better-auth").User | null;
    session: import("better-auth").Session | null;
  };
}

export const factory = createFactory<AppEnv>();

export function createRouter() {
  return factory.createApp();
}
```

- [ ] **Step 4: Commit**

```bash
cd "d:\kuliah\smt 4\metopen\SIRIS\api-SIRIS"
git add src/env.ts src/factory.ts src/lib/errors.ts
git commit -m "feat: setup env validation, error classes, and hono factory"
```

### Task 3: Database Setup (Drizzle)

**Files:**

- Create: `drizzle.config.ts`
- Create: `src/db/schema.ts`
- Create: `src/db/index.ts`

- [ ] **Step 1: Configure Drizzle Kit**

```typescript
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
});
```

- [ ] **Step 2: Define initial user schema**

```typescript
import { pgTable, text, timestamp, boolean } from "drizzle-orm/pg-core";

export const users = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull(),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const sessions = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
});

export const accounts = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId")
    .notNull()
    .references(() => users.id),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull(),
  updatedAt: timestamp("updatedAt").notNull(),
});

export const verifications = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt"),
  updatedAt: timestamp("updatedAt"),
});
```

- [ ] **Step 3: Setup database client (Fresh connection per request)**

```typescript
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";
import type { Env } from "@/env";

// Do not cache the database connection pool in the global scope
export const getDb = (env: Env) => {
  const client = postgres(env.DATABASE_URL);
  return drizzle(client, { schema });
};
```

- [ ] **Step 4: Commit**

```bash
cd "d:\kuliah\smt 4\metopen\SIRIS\api-SIRIS"
git add drizzle.config.ts src/db
git commit -m "feat: setup drizzle orm schemas and per-request db client"
```

### Task 4: Better Auth Configuration

**Files:**

- Create: `src/auth.ts`
- Create: `src/middlewares/auth.middleware.ts`

- [ ] **Step 1: Setup Better Auth instance factory**

```typescript
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
```

- [ ] **Step 2: Create Auth Middleware**

```typescript
import { createMiddleware } from "hono/factory";
import { getAuth } from "@/auth";
import { UnauthorizedError } from "@/lib/errors";
import type { AppEnv } from "@/factory";

export const requireAuth = createMiddleware<AppEnv>(async (c, next) => {
  const auth = getAuth(c.env);
  const session = await auth.api.getSession({ headers: c.req.raw });

  if (!session) {
    throw new UnauthorizedError();
  }

  c.set("user", session.user);
  c.set("session", session.session);
  await next();
});
```

- [ ] **Step 3: Commit**

```bash
cd "d:\kuliah\smt 4\metopen\SIRIS\api-SIRIS"
git add src/auth.ts src/middlewares/auth.middleware.ts
git commit -m "feat: configure better auth and middleware for workers"
```

### Task 5: Root Application Setup (OpenAPI & Stoker)

**Files:**

- Create: `src/app.ts`
- Create: `src/index.ts`

- [ ] **Step 1: Setup core app with middlewares**

```typescript
import { OpenAPIHono } from "@hono/zod-openapi";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import notFound from "stoker/middlewares/not-found";
import onError from "stoker/middlewares/on-error";
import { apiReference } from "@scalar/hono-api-reference";
import { getAuth } from "./auth";
import { parseEnv } from "./env";
import type { AppEnv } from "./factory";
import "zod-openapi/extend";

export const app = new OpenAPIHono<AppEnv>();

// Parse Env early
app.use("*", async (c, next) => {
  // @ts-expect-error - overriding env for type safety
  c.env = parseEnv(c.env as any);
  await next();
});

// Global Middlewares
app.use("*", logger());
app.use("*", cors());

// Auth Route
app.on(["POST", "GET"], "/api/auth/**", (c) => {
  const auth = getAuth(c.env);
  return auth.handler(c.req.raw);
});

// Mount OpenAPI Spec
app.doc("/openapi.json", {
  openapi: "3.0.0",
  info: {
    title: "SIRIS API",
    version: "1.0.0",
    description: "API for SIRIS Project",
  },
});

// Mount Scalar UI
app.get(
  "/docs",
  apiReference({
    spec: { url: "/openapi.json" },
  }),
);

// Fallback handlers
app.notFound(notFound);
app.onError(onError);
```

- [ ] **Step 2: Setup Cloudflare Worker entrypoint**

```typescript
import { app } from "./app";

export default {
  fetch: app.fetch,
};
```

- [ ] **Step 3: Commit**

```bash
cd "d:\kuliah\smt 4\metopen\SIRIS\api-SIRIS"
git add src/app.ts src/index.ts
git commit -m "feat: setup app entrypoint, openapi, and stoker error handling"
```
