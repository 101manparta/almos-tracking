# Panduan Deployment — ALMOS Laundry Detailing

## Variabel Lingkungan (Environment Variables)

Lihat `.env.example` untuk daftar variabel:

- `SQL_HOST`, `SQL_DB_NAME`, `SQL_ADMIN_USER` / `SQL_USER`, `SQL_ADMIN_PASSWORD` / `SQL_PASSWORD` — Kredensial koneksi PostgreSQL (Cloud SQL). Dikelola secara otomatis oleh lingkungan AI Studio / Cloud SQL.
- `PORT` — Port HTTP server (default: `3000`).
- `APP_URL` — URL publik aplikasi (digunakan untuk validasi origin CSRF pada permintaan mutasi berbasis cookie).
- `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_STORAGE_BUCKET` *(Opsional)* — Jika diisi dengan bucket privat Supabase Storage, foto barang akan disimpan ke bucket Supabase. Jika tidak diisi, server menggunakan direktori privat lokal `./storage/photos` yang hanya dapat diakses melalui endpoint terotentikasi `/api/v1/photos/:id/file`.

## Langkah Build & Jalankan Produksi

1. Instal dependensi: `npm install`
2. Sinkronkan skema PostgreSQL jika diperlukan (`src/db/schema.ts`)
3. Build aset frontend: `npm run build`
4. Jalankan server produksi: `npm start` (`node server.ts` di Node.js v22+)

## Checklist Keamanan & Operasional

- **First-Run Admin Setup**: Saat database baru dan belum memiliki user `ADMIN`, layar login menampilkan formulir **Aktivasi Admin Perdana** agar akun Admin pertama dibuat dengan kata sandi kuat (minimal 8 karakter).
- **Backup Database**: Aktifkan backup otomatis terjadwal pada instance Cloud SQL (`ai-studio-bd7c4503`) untuk menjaga keutuhan arsip permanen pesanan & riwayat garmen.
- **Health Check**: Arahkan readiness/liveness probe ke `GET /api/v1/health`.
