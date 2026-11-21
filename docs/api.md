# Dokumentasi REST API (`/api/v1`)

Spesifikasi OpenAPI JSON tersedia langsung di endpoint: `GET /api/v1/openapi.json`.

## Format Respons Standar

- Sukses: `{ "data": <payload>, "meta"?: { "page", "perPage", "total", "totalPages" } }`
- Kesalahan: `{ "error": { "code": "<ERROR_CODE>", "message": "<Pesan Bahasa Indonesia>", "details"?: ... } }`

## Endpoint Utama

### Kesehatan & Spesifikasi
- `GET /api/v1/health` — Pemeriksaan status layanan.
- `GET /api/v1/openapi.json` — Dokumen OpenAPI 3.0.

### Otentikasi
- `GET /api/v1/auth/status` — Mengecek apakah sistem membutuhkan registrasi Admin perdana (`needsBootstrap`).
- `POST /api/v1/auth/bootstrap-admin` — Membuat akun Admin pertama (hanya aktif saat belum ada Admin).
- `POST /api/v1/auth/login` — Login username/email + password (rate-limited).
- `POST /api/v1/auth/firebase-login` — Login menggunakan Firebase Google ID Token.
- `POST /api/v1/auth/logout` — Mencabut sesi dan menghapus cookie.
- `GET /api/v1/auth/me` — Profil pengguna terotentikasi.

### Manajemen Pengguna (Khusus ADMIN)
- `GET /api/v1/users`, `POST /api/v1/users`, `GET /api/v1/users/:id`, `PATCH /api/v1/users/:id`

### Pesanan & Pengambilan (Khusus ADMIN untuk mutasi)
- `GET /api/v1/orders`, `POST /api/v1/orders`, `GET /api/v1/orders/:id`, `PATCH /api/v1/orders/:id`
- `POST /api/v1/orders/:id/cancel` — Pembatalan pesanan dengan alasan wajib.
- `POST /api/v1/orders/:id/pickup` — Konfirmasi pengambilan seluruh barang pesanan (`READY_FOR_PICKUP` → `ARCHIVED` & `PICKED_UP`).
- `GET /api/v1/archive`, `GET /api/v1/archive/:orderId` — Pencarian dan detail arsip permanen.

### Garmen & Foto Referensi
- `POST /api/v1/garments` (ADMIN), `GET /api/v1/garments`, `GET /api/v1/garments/:id`, `PATCH /api/v1/garments/:id` (ADMIN, menolak mutasi `currentStatus`/`currentDepartment` langsung), `GET /api/v1/garments/:id/history`.
- `POST /api/v1/garments/:id/photos` (multipart `file` + `thumbnail`), `GET /api/v1/photos`, `GET /api/v1/photos/:id/file?variant=thumb|original`, `DELETE /api/v1/photos/:id` (ADMIN soft-delete).

### Workflow Operasional Staf & Kendala
- `GET /api/v1/staff/dashboard`, `GET /api/v1/staff/queue?status=ALL|WAITING|IN_PROGRESS|ON_HOLD`, `GET /api/v1/staff/history`
- `POST /api/v1/garments/:id/start` — Memulai pekerjaan divisi (verifikasi tag fisik atau foto+detail cadangan).
- `GET /api/v1/garments/:id/checklist`, `POST /api/v1/garments/:id/checklist` — Menyimpan progres verifikasi & checklist.
- `POST /api/v1/garments/:id/complete` / `POST /api/v1/garments/:id/handover` — Menyelesaikan tahap & menyerahkan ke divisi berikutnya / `READY_FOR_PICKUP`.
- `POST /api/v1/garments/:id/hold`, `POST /api/v1/garments/:id/resume` (ADMIN)
- `POST /api/v1/garments/:id/issues`, `GET /api/v1/issues`, `PATCH /api/v1/issues/:id/resolve` (ADMIN)

### Laporan & Pencarian Global
- `GET /api/v1/reports/overview`, `GET /api/v1/reports/departments`, `GET /api/v1/reports/completed`
- `GET /api/v1/search?q=...`, `GET /api/v1/settings`, `PATCH /api/v1/settings/:key`
