# CLAUDE.MD — AI Assistant Guide untuk SIRIS

> **PENTING:** File ini adalah panduan personalisasi untuk Claude Code (AI assistant) yang bekerja di repository ini. SELALU baca dan ikuti panduan ini sebelum memulai pekerjaan.

---

## 1. Project Context

**Nama Proyek:** SIRIS — Sistem Informasi Pelaporan Pelanggaran QRIS (Backend API)
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

| Layer | Technology | Keterangan |
|---|---|---|
| **Runtime** | Cloudflare Workers | Bukan Node.js/Bun. Env via `c.env` |
| **Framework** | Hono v4+ | Lightweight web framework |
| **OpenAPI** | `@hono/zod-openapi` | Route documentation dengan `createRoute` |
| **Auth** | Better Auth | |
| **Database** | PostgreSQL | Serverless Postgres |
| **ORM** | Drizzle ORM | Type-safe query |
| **Validation** | Zod | Request/response validation |
| **Language** | TypeScript (strict) | No `any`, no `process.env` |
| **Linting** | Oxlint & Oxfmt | Fast lint & format |

> ⚠️ **Cloudflare Workers** bukan Node.js/Bun. Environment variables diakses via `c.env`, **bukan** `process.env`. Database connections TIDAK BOLEH di-cache sebagai singleton (isolate freeze akan memutus TCP).

---

## 3. Architecture Rules

### 3.1 Struktur: Modular Monolith

```
src/
├── modules/          # Vertical slices
├── services/         # Cross-module logic
├── db/
│   ├── index.ts      # getDb(env) — SELALU buat client baru, JANGAN cache pool
│   └── schema.ts     # Semua Drizzle schema di sini
├── middlewares/      # CORS, auth guards, rate limiting
├── factory.ts        # createRouter() — JANGAN new Hono() langsung
├── auth.ts           # Better Auth config
└── env.ts            # Zod env schema + Env type
```

### 3.2 Golden Rules (WAJIB, pelanggaran = immediate rejection)

1. ✅ **SELALU** pakai `createRouter()` dari `src/factory.ts` — JANGAN `new Hono()` langsung
2. ✅ **SELALU** pakai `createRoute` + `router.openapi()` untuk dokumentasi
3. ✅ **SELALU** validasi request dengan Zod di `createRoute` schema
4. ✅ **JANGAN** pass Hono Context (`c`) ke Services — pass primitives
5. ✅ **JANGAN** pakai `process.env` — pakai `c.env`
6. ✅ **JANGAN** pakai `z.date()` di OpenAPI schema — pakai `z.string().datetime()`
7. ✅ **JANGAN** import `modules/A` → `modules/B` — pakai shared service
8. ✅ **JANGAN** cache database connections sebagai singleton — buat client baru per request

### 3.3 Development Workflow (Tambah Fitur Baru)

```
Phase 1: Data   → Update src/db/schema.ts → bun run db:push
Phase 2: Contract → Buat [name].schema.ts → [name].routes.ts
Phase 3: Logic  → Buat [name].handlers.ts → index.ts (createRouter + mount)
Phase 4: Register → Daftarkan module di src/app.ts
Phase 5: Docs   → bun run openapi:generate
Phase 6: Verify → bun run fl && bun run check
```

---

## 4. Code Quality Checklist

Sebelum commit, WAJIB jalankan:

```bash
bun run fl     # Format & lint (oxfmt + oxlint)
bun run check  # TypeScript type check (tsc --noEmit)
```

**Pre-commit Checklist:**
- ✅ Tidak ada `new Hono()` / `new OpenAPIHono()` di module (gunakan `createRouter()`)
- ✅ Tidak ada `process.env` (gunakan `c.env`)
- ✅ Semua route pakai `createRoute` + `router.openapi()`
- ✅ Tidak ada `z.date()` di OpenAPI schema (gunakan `z.string().datetime()`)
- ✅ Services tidak menerima Hono Context
- ✅ Tidak ada cross-module imports (`modules/A` → `modules/B`)
- ✅ Database connections tidak di-cache sebagai singleton
- ✅ TypeScript strict mode (no `any`, proper type narrowing)

---

## 5. Important Notes

### 5.1 Cloudflare Workers Isolation Model
- Setiap request berjalan di **isolate terpisah**
- Isolate bisa **freeze** saat idle → TCP connections mati
- **JANGAN** cache database connections, AI clients, atau I/O objects
- **SELALU** buat fresh connection per request
