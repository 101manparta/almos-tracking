# Arsitektur Sistem — ALMOS Laundry Detailing

## Ringkasan Modular Monolith

Aplikasi dibangun sebagai **Modular Monolith** dengan pemisahan lapisan tanggung jawab yang tegas:

- `server.ts` — Entry point server HTTP (port `3000`), menggabungkan API backend Express dengan Vite middleware di mode pengembangan atau static `dist/` di mode produksi.
- `src/server/app.ts` — Konfigurasi Express, security headers, CORS, `cookie-parser`, JSON body limit, mounting `/api/v1`, dan global error handler.
- `src/server/routes/api.ts` — Definisi seluruh endpoint REST `/api/v1/*`, validasi schema input menggunakan Zod, middleware otentikasi/otorisasi, serta endpoint spesifikasi OpenAPI (`/api/v1/openapi.json`).
- `src/server/middleware/auth.ts` — Verifikasi token sesi (`HttpOnly` cookie & Bearer), verifikasi Firebase ID Token, rate limiter login, proteksi CSRF untuk mutasi cookie, dan guard `requireRole(...)`.
- `src/server/services/` — Seluruh logika bisnis dan integritas transaksional:
  - `auth.service.ts` — Bootstrap Admin perdana, login password (`scrypt`), login Google/Firebase, manajemen akun staf.
  - `order.service.ts` — Pembuatan pesanan, pembaruan dengan *optimistic locking*, pembatalan, dan pencarian arsip.
  - `garment.service.ts` — Registrasi garmen, pembuatan tahapan workflow & checklist dari template, manajemen foto, riwayat pelacakan.
  - `workflow.rules.ts` & `workflow.service.ts` — *Finite State Machine* murni + transaksi atomik `start`, `checklist`, `complete`, `handover`, `hold`, `resume`, serta pelaporan kendala.
  - `pickup.service.ts` — Validasi kelayakan pengambilan pesanan dan pengarsipan atomik tanpa penghapusan data.
  - `report.service.ts` — Agregasi metrik dashboard Admin, ringkasan staf, laporan divisi, pencarian global, dan pengaturan SLA/kebijakan.
  - `storage.service.ts` — Adapter penyimpanan foto privat (Supabase Storage REST API jika env terkonfigurasi, atau penyimpanan disk lokal terisolasi di `./storage/photos` dengan proteksi path-traversal).
- `src/db/` — Skema PostgreSQL Drizzle ORM (`schema.ts`), konfigurasi Drizzle Kit, dan pool koneksi `pg`.
- `src/pages/` & `src/components/` — Antarmuka mobile-first berbasis React, TypeScript, Tailwind CSS, dan TanStack Query (Admin desktop sidebar + drawer; Staf 5-tab bottom navigation).

## Catatan Lingkungan Runtime Preview

Spesifikasi awal menyebut Rust/Axum + Next.js, namun container preview Node.js (`v22.23.2`) tidak menyediakan toolchain Rust (`cargo`/`rustc`), Docker, maupun Next.js. Untuk menghadirkan aplikasi full-stack nyata yang langsung berjalan, teruji, dan terhubung ke database PostgreSQL Cloud SQL pada port `3000`, aplikasi ini mengimplementasikan arsitektur modular monolith yang setara menggunakan **TypeScript + Express + Drizzle ORM + PostgreSQL (Cloud SQL) + React + Vite**, lengkap dengan kontrak REST `/api/v1` dan spesifikasi OpenAPI `/api/v1/openapi.json`.
