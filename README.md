# ALMOS Laundry Detailing — Garment Tracking & Operations System

*"your professional detailing laundry"*

Sistem operasional internal dan pelacakan garmen per item (*individual garment tracking*) untuk **ALMOS Laundry Detailing**. Dibangun untuk melacak setiap potong pakaian dari proses penerimaan/registrasi, tahap *Spotting*, *Ironing*, *Packing*, serah terima antar divisi, pelaporan kendala, hingga pengambilan pelanggan dan pengarsipan permanen—tanpa mengubah proses *physical tag* manual yang sudah berjalan (tanpa QR code, barcode, atau RFID).

## Fitur Utama

- **Otentikasi & RBAC Nyata**: Login kata sandi (`crypto.scrypt`) dan Google Sign-In (Firebase Auth), proteksi endpoint backend (`ADMIN`, `SPOTTING`, `IRONING`, `PACKING`), manajemen sesi aman via `HttpOnly` cookie & `Authorization: Bearer`.
- **Manajemen Pesanan & Garmen Per Item**: Pendaftaran pesanan pelanggan/vendor (*Villa*, *Hotel*, *Wedding Organizer*, *Salon*, *Pelanggan Pribadi*) dan registrasi item pakaian dengan nomor tag fisik unik per pesanan aktif, ciri khusus, kondisi awal, catatan noda, dan instruksi khusus.
- **Dokumentasi Foto Referensi**: Kompresi foto dan pembuatan thumbnail WebP di sisi klien + validasi *magic bytes* di server; tersimpan di Supabase Storage (jika dikonfigurasi) atau penyimpanan privat lokal yang dilayani lewat endpoint terotentikasi `/api/v1/photos/:id/file`.
- **Workflow State Machine Ketat**: Transisi status hanya dapat dilakukan melalui endpoint workflow resmi (`start`, `checklist`, `complete`, `handover`, `hold`, `resume`) dengan *optimistic locking* (`version`), verifikasi tag fisik (atau verifikasi cadangan foto + detail saat tag hilang), serta checklist wajib sebelum serah terima.
- **Pengambilan & Arsip Permanen**: Konfirmasi pengambilan di level pesanan (hanya jika seluruh barang berstatus `READY_FOR_PICKUP`) memindahkan pesanan ke status `ARCHIVED` dan barang ke `PICKED_UP` tanpa menghapus data historis.
- **Pelaporan Kendala & Laporan Operasional**: Pelaporan kendala per item, ringkasan antrean tiap divisi, barang melewati SLA (*overdue*), dan statistik status.

## Menjalankan Secara Lokal / Preview

```bash
npm install
npm run dev       # Menjalankan Express API + Vite dev server di port 3000
npm test          # Menjalankan automated tests (Vitest)
npm run lint      # Verifikasi TypeScript (tsc --noEmit)
npm run build     # Build frontend production ke dist/
npm start         # Menjalankan production server (node server.ts)
```

## Dokumentasi Lengkap

- [Arsitektur Sistem](docs/architecture.md)
- [Desain Basis Data PostgreSQL](docs/database.md)
- [Kontrak REST API (/api/v1)](docs/api.md)
- [Panduan Deployment & Environment](docs/deployment.md)
