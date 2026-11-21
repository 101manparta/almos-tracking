# Desain Basis Data PostgreSQL — ALMOS Laundry Detailing

Seluruh skema didefinisikan di `src/db/schema.ts` dan dikelola menggunakan Drizzle Kit pada PostgreSQL (Cloud SQL region `asia-southeast1`).

## Daftar Tabel (17 Tabel)

1. **`roles`** — Referensi peran sistem (`ADMIN`, `SPOTTING`, `IRONING`, `PACKING`).
2. **`users`** — Akun pengguna internal (`full_name`, `username`, `email`, `password_hash`, `firebase_uid`, `role_id`, `is_active`).
3. **`user_sessions`** — Sesi aktif berbasis token hash SHA-256 dengan tanggal kedaluwarsa dan pencabutan (`revoked_at`).
4. **`workflow_templates`** — Template alur pengerjaan (`FULL_DETAILING`, `SPOTTING_IRONING`, `IRONING_PACKING`, `PACKING_ONLY`).
5. **`workflow_template_stages`** — Urutan tahapan divisi untuk setiap template (`stage_order`, `department`).
6. **`orders`** — Data pesanan pelanggan/vendor (`order_code`, `customer_name`, `customer_phone`, `order_category`, `status`, `expected_completion_at`, `archived_at`, `version`).
7. **`garments`** — Data garmen individual (`garment_code`, `order_id`, `physical_tag_number`, `tag_status`, `current_department`, `current_status`, `previous_status_before_hold`, `previous_department_before_hold`, `due_at`, `version`, `deleted_at`).
   - *Constraint*: `uq_garments_active_order_tag` memastikan nomor tag fisik tidak duplikat pada pesanan yang belum diambil (`current_status != 'PICKED_UP'`).
8. **`garment_workflow_stages`** — Status progres per divisi untuk tiap garmen (`PENDING`, `IN_PROGRESS`, `COMPLETED`, `ON_HOLD`).
9. **`garment_photos`** — Metadata dan path penyimpanan foto (`storage_provider`, `storage_path`, `thumbnail_path`, `photo_type`, `mime_type`, `file_size_bytes`, `deleted_at`).
10. **`workflow_history`** — Log kronologis perubahan status/divisi yang bersifat *append-only*.
11. **`checklists`** — Header checklist per tahap divisi (`identity_verified`, `verification_method`, `is_complete`).
12. **`checklist_items`** — Butir pemeriksaan detail dalam setiap checklist.
13. **`handover_records`** — Catatan serah terima antar divisi dengan dukungan `idempotency_key`.
14. **`issue_reports`** — Laporan kendala (`issue_type`, `severity`, `description`, `puts_garment_on_hold`, `resolution_status`, `resolution_notes`).
15. **`pickup_records`** — Catatan pengambilan pelanggan di tingkat pesanan (`recipient_name`, `recipient_phone`, `expected_garment_count`, `idempotency_key`, `confirmed_by`).
16. **`audit_logs`** — Jejak audit tindakan penting (registrasi, pembaruan data, penghapusan foto, perubahan peran, pengarsipan).
17. **`system_settings`** — Konfigurasi operasional (`sla_hours`, `photo_policy`, `checklist_templates`).

## Prinsip Data Referensi

Database hanya diisi data referensi statis (4 peran, 4 template alur + tahapannya, serta pengaturan SLA/checklist default). **Tidak ada data dummy** pesanan, garmen, atau akun fiktif.
