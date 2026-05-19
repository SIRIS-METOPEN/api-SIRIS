# AGENTS.md - Project Context & Directives

> **SYSTEM INSTRUCTION:** ALL AI AGENTS WORKING ON THIS REPOSITORY MUST READ AND ADHERE TO THE FOLLOWING ARCHITECTURAL GUIDELINES. DO NOT DEVIATE WITHOUT EXPLICIT USER OVERRIDE.

## 1. Project Overview

**Project:** SIRIS — Sistem Informasi Pelaporan Pelanggaran QRIS (Backend API)
**Deskripsi:** Platform pelaporan pelanggaran Merchant Discount Rate (MDR) QRIS berbasis web untuk mendukung pengawasan kepatuhan merchant di Indonesia.

**Solusi Utama:**
1. **Pelaporan Pelanggaran (Surcharge)** — Fasilitas untuk konsumen melaporkan merchant nakal yang mengenakan biaya tambahan MDR.
2. **Manajemen Laporan** — Dashboard bagi regulator/admin untuk mengawasi dan menindaklanjuti laporan pelanggaran.
3. **Edukasi Konsumen & Merchant** — Wadah literasi kepatuhan QRIS.

**Dokumen Referensi:**
- `siris.md` — Dokumen proposal dan analisis proyek
- `IMPLEMENTATION_PLAN.md` — Phase-by-phase implementation plan

---

## 2. Tech Stack (Strict)

| Layer | Tech | Keterangan |
|---|---|---|
| Runtime | **Cloudflare Workers** (via Wrangler) | Bukan Node.js/Bun |
| Framework | [Hono](https://hono.dev) v4+ | Lightweight web framework |
| OpenAPI | `@hono/zod-openapi` (`createRoute` + Zod schemas) | Route documentation |
| Auth | [Better Auth](https://www.better-auth.com) | |
| Database | PostgreSQL | |
| ORM | [Drizzle ORM](https://orm.drizzle.team) | Type-safe query |
| Validation | Zod | Request/response validation |
| Language | TypeScript (strict) | No `any`, no `process.env` |
| Linting | Oxlint & Oxfmt | Fast lint & format |

> ⚠️ **Cloudflare Workers** bukan Node.js/Bun. Environment variables diakses via `c.env`, **bukan** `process.env`.
> ⚠️ **JANGAN** cache database connections sebagai singleton — isolate freeze akan memutus TCP → hang → 500 error.

---

## 3. Architecture & Core Philosophy

Struktur **Modular Monolith** dengan pemisahan layer yang jelas:

- **Modules:** Vertical slices per domain
- **Services:** Pure business logic untuk cross-module concerns. **JANGAN** pass Hono Context (`c`) ke Service
- **Factory:** Single source of truth untuk pembuatan Hono app (`src/factory.ts`)
- **Database:** Semua schema di `src/db/schema.ts`. Instance dibuat fresh per request via `getDb(env)`

---

## 4. The "Golden Rules" (Violations = Immediate Rejection)

### Rule 1: The Factory Rule
**JANGAN** gunakan `new Hono()` atau `new OpenAPIHono()` langsung di module. **SELALU** gunakan `createRouter()` dari `src/factory.ts`.

### Rule 2: The OpenAPI Documentation Rule
**SELALU** gunakan `createRoute` + `router.openapi()` dari `@hono/zod-openapi` untuk mendokumentasikan route.

### Rule 3: The Validation Rule
**SELALU** definisikan request schema di `createRoute` menggunakan `request.body`, `request.params`, atau `request.query`.

### Rule 4: The Service Purity Rule
Services harus bisa di-test tanpa Hono. Pass primitives, bukan Context.

### Rule 5: The Environment Variable Rule
**JANGAN** pakai `process.env`. Di Cloudflare Workers, env diakses via `c.env`.

### Rule 6: The Zod ISO Date Rule
Gunakan `z.string().datetime()` bukan `z.date()` untuk field timestamp di OpenAPI schema.

### Rule 7: The Import Direction Rule
- `modules/` → imports → `db/schema/`, `auth.ts`, `env.ts`, `services/`
- `services/` → imports → `db/schema/`
- ❌ `modules/A` → imports → `modules/B` (Gunakan shared service)

### Rule 8: The Database Connection Rule
**JANGAN** cache database connections sebagai singleton. Buat fresh client per request.

---

## 5. Code Quality Checklist

Sebelum commit:

```bash
bun run fl     # Format & lint
bun run check  # TypeScript type check
```
