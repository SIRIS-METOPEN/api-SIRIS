# SIRIS (Sistem Informasi Pelaporan Pelanggaran QRIS) — Backend API

Platform pelaporan pelanggaran Merchant Discount Rate (MDR) QRIS berbasis web untuk mendukung pengawasan kepatuhan merchant di Indonesia.

## Latar Belakang & Masalah
Kebijakan Bank Indonesia (PBI No. 23/6/PBI/2021) secara tegas melarang pedagang untuk membebankan biaya tambahan (surcharge) kepada konsumen yang bertransaksi menggunakan QRIS. Biaya MDR (Merchant Discount Rate) sepenuhnya adalah kewajiban pedagang. Namun di lapangan, masih banyak merchant nakal yang mengalihkan beban ini ke konsumen.

SIRIS hadir untuk menjembatani perlindungan konsumen. Sistem ini memberdayakan konsumen untuk berani melaporkan praktik curang, sekaligus menjadi alat bagi regulator (Bank Indonesia / OJK) dalam mengawasi dan menindaklanjuti laporan pelanggaran.

## Tech Stack
- **Runtime:** Cloudflare Workers (via Wrangler)
- **Framework:** Hono v4+
- **OpenAPI:** `@hono/zod-openapi` + Scalar UI
- **Auth:** Better Auth
- **Database:** PostgreSQL (Neon / Docker)
- **ORM:** Drizzle ORM
- **Validation:** Zod
- **Linting & Formatting:** Oxlint & Oxfmt

## Arsitektur
Proyek ini mengadopsi arsitektur **Modular Monolith** dengan pendekatan Cloudflare Workers.
- Database clients dibuat _per-request_ untuk menghindari timeout saat *isolate freeze*.
- Bisnis logic dan handler dipisah di direktori `/src/modules/` dan `/src/services/`.
- Tidak menggunakan objek `any`.

## Cara Menjalankan (Development)

1. **Jalankan Database:**
   ```bash
   bun run db:start
   ```

2. **Migrasi Database:**
   ```bash
   bun run db:generate
   bun run db:migrate
   # atau
   bun run db:push
   ```

3. **Jalankan Server Lokal:**
   ```bash
   bun run dev
   ```

4. **Lint & Format:**
   ```bash
   bun run fl
   bun run check
   ```

API Docs (Scalar) dapat diakses di `http://localhost:8787/docs`.
