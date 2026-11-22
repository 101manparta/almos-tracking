-- ALMOS Laundry Tracking — Full PostgreSQL Schema & Reference Seed for Supabase
-- Tempel seluruh isi file ini di Supabase -> SQL Editor -> Run

CREATE TABLE IF NOT EXISTS "audit_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity_type" text NOT NULL,
	"entity_id" text,
	"metadata" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"ip_address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "checklist_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"checklist_id" uuid NOT NULL,
	"item_key" text NOT NULL,
	"label" text NOT NULL,
	"sort_order" integer NOT NULL,
	"is_checked" boolean DEFAULT false NOT NULL,
	"note" text,
	"checked_by" uuid,
	"checked_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "checklists" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garment_id" uuid NOT NULL,
	"stage_id" uuid NOT NULL,
	"department" text NOT NULL,
	"identity_verified" boolean DEFAULT false NOT NULL,
	"verification_method" text DEFAULT 'PHYSICAL_TAG' NOT NULL,
	"is_complete" boolean DEFAULT false NOT NULL,
	"completed_by" uuid,
	"completed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "checklists_stage_id_unique" UNIQUE("stage_id")
);

CREATE TABLE IF NOT EXISTS "garment_photos" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garment_id" uuid NOT NULL,
	"photo_type" text NOT NULL,
	"storage_provider" text DEFAULT 'LOCAL_PRIVATE' NOT NULL,
	"storage_path" text NOT NULL,
	"thumbnail_path" text NOT NULL,
	"mime_type" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"caption" text,
	"uploaded_by" uuid NOT NULL,
	"deleted_at" timestamp with time zone,
	"deleted_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "garment_workflow_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garment_id" uuid NOT NULL,
	"department" text NOT NULL,
	"stage_order" integer NOT NULL,
	"status" text DEFAULT 'PENDING' NOT NULL,
	"assigned_to" uuid,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"due_at" timestamp with time zone,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "garments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garment_code" text NOT NULL,
	"order_id" uuid NOT NULL,
	"template_id" uuid NOT NULL,
	"garment_name" text NOT NULL,
	"category" text NOT NULL,
	"garment_type" text NOT NULL,
	"brand" text,
	"color" text NOT NULL,
	"size" text,
	"physical_tag_number" text NOT NULL,
	"tag_status" text DEFAULT 'ATTACHED' NOT NULL,
	"distinctive_features" text,
	"initial_condition" text NOT NULL,
	"stain_description" text,
	"special_instructions" text,
	"current_department" text DEFAULT 'ADMIN' NOT NULL,
	"current_status" text DEFAULT 'REGISTERED' NOT NULL,
	"previous_status_before_hold" text,
	"previous_department_before_hold" text,
	"assigned_staff_id" uuid,
	"due_at" timestamp with time zone,
	"deleted_at" timestamp with time zone,
	"registered_by" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "garments_garment_code_unique" UNIQUE("garment_code")
);

CREATE TABLE IF NOT EXISTS "handover_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garment_id" uuid NOT NULL,
	"from_department" text NOT NULL,
	"to_department" text NOT NULL,
	"handed_over_by" uuid NOT NULL,
	"received_by" uuid,
	"physical_tag_verified" boolean NOT NULL,
	"condition_notes" text,
	"idempotency_key" text,
	"handed_over_at" timestamp with time zone DEFAULT now() NOT NULL,
	"received_at" timestamp with time zone,
	CONSTRAINT "handover_records_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "issue_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garment_id" uuid NOT NULL,
	"department" text NOT NULL,
	"reported_by" uuid NOT NULL,
	"issue_type" text NOT NULL,
	"severity" text NOT NULL,
	"description" text NOT NULL,
	"puts_garment_on_hold" boolean DEFAULT false NOT NULL,
	"resolution_status" text DEFAULT 'OPEN' NOT NULL,
	"resolved_by" uuid,
	"resolution_notes" text,
	"resolved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "orders" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_code" text NOT NULL,
	"customer_name" text NOT NULL,
	"customer_phone" text NOT NULL,
	"order_category" text NOT NULL,
	"expected_completion_at" timestamp with time zone,
	"notes" text,
	"status" text DEFAULT 'ACTIVE' NOT NULL,
	"archived_at" timestamp with time zone,
	"cancelled_at" timestamp with time zone,
	"cancel_reason" text,
	"created_by" uuid NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "orders_order_code_unique" UNIQUE("order_code")
);

CREATE TABLE IF NOT EXISTS "pickup_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"order_id" uuid NOT NULL,
	"confirmed_by" uuid NOT NULL,
	"recipient_name" text NOT NULL,
	"recipient_phone" text,
	"verification_notes" text,
	"garment_count" integer NOT NULL,
	"idempotency_key" text,
	"picked_up_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pickup_records_order_id_unique" UNIQUE("order_id"),
	CONSTRAINT "pickup_records_idempotency_key_unique" UNIQUE("idempotency_key")
);

CREATE TABLE IF NOT EXISTS "roles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "roles_code_unique" UNIQUE("code")
);

CREATE TABLE IF NOT EXISTS "system_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "user_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"user_agent" text,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "user_sessions_token_hash_unique" UNIQUE("token_hash")
);

CREATE TABLE IF NOT EXISTS "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"uid" text,
	"role_id" uuid NOT NULL,
	"full_name" text NOT NULL,
	"username" text NOT NULL,
	"email" text NOT NULL,
	"password_hash" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_login_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_uid_unique" UNIQUE("uid"),
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_email_unique" UNIQUE("email")
);

CREATE TABLE IF NOT EXISTS "workflow_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"garment_id" uuid NOT NULL,
	"previous_status" text NOT NULL,
	"new_status" text NOT NULL,
	"from_department" text,
	"to_department" text,
	"performed_by" uuid NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "workflow_template_stages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"department" text NOT NULL,
	"stage_order" integer NOT NULL,
	"sla_hours" integer DEFAULT 12 NOT NULL
);

CREATE TABLE IF NOT EXISTS "workflow_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "workflow_templates_code_unique" UNIQUE("code")
);

DO $$ BEGIN
  ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actor_user_id_users_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checklist_id_checklists_id_fk" FOREIGN KEY ("checklist_id") REFERENCES "public"."checklists"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "checklist_items" ADD CONSTRAINT "checklist_items_checked_by_users_id_fk" FOREIGN KEY ("checked_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "checklists" ADD CONSTRAINT "checklists_garment_id_garments_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "checklists" ADD CONSTRAINT "checklists_stage_id_garment_workflow_stages_id_fk" FOREIGN KEY ("stage_id") REFERENCES "public"."garment_workflow_stages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "checklists" ADD CONSTRAINT "checklists_completed_by_users_id_fk" FOREIGN KEY ("completed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "garment_photos" ADD CONSTRAINT "garment_photos_garment_id_garments_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "garment_photos" ADD CONSTRAINT "garment_photos_uploaded_by_users_id_fk" FOREIGN KEY ("uploaded_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "garment_photos" ADD CONSTRAINT "garment_photos_deleted_by_users_id_fk" FOREIGN KEY ("deleted_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "garment_workflow_stages" ADD CONSTRAINT "garment_workflow_stages_garment_id_garments_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "garment_workflow_stages" ADD CONSTRAINT "garment_workflow_stages_assigned_to_users_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "garments" ADD CONSTRAINT "garments_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "garments" ADD CONSTRAINT "garments_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "garments" ADD CONSTRAINT "garments_assigned_staff_id_users_id_fk" FOREIGN KEY ("assigned_staff_id") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "garments" ADD CONSTRAINT "garments_registered_by_users_id_fk" FOREIGN KEY ("registered_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_garment_id_garments_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_handed_over_by_users_id_fk" FOREIGN KEY ("handed_over_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "handover_records" ADD CONSTRAINT "handover_records_received_by_users_id_fk" FOREIGN KEY ("received_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_garment_id_garments_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_reported_by_users_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_resolved_by_users_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "orders" ADD CONSTRAINT "orders_created_by_users_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "pickup_records" ADD CONSTRAINT "pickup_records_order_id_orders_id_fk" FOREIGN KEY ("order_id") REFERENCES "public"."orders"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "pickup_records" ADD CONSTRAINT "pickup_records_confirmed_by_users_id_fk" FOREIGN KEY ("confirmed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "system_settings" ADD CONSTRAINT "system_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "users" ADD CONSTRAINT "users_role_id_roles_id_fk" FOREIGN KEY ("role_id") REFERENCES "public"."roles"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_garment_id_garments_id_fk" FOREIGN KEY ("garment_id") REFERENCES "public"."garments"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_history" ADD CONSTRAINT "workflow_history_performed_by_users_id_fk" FOREIGN KEY ("performed_by") REFERENCES "public"."users"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  ALTER TABLE "workflow_template_stages" ADD CONSTRAINT "workflow_template_stages_template_id_workflow_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."workflow_templates"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

CREATE INDEX IF NOT EXISTS "idx_audit_logs_entity" ON "audit_logs" USING btree ("entity_type","entity_id","created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_checklist_item_key" ON "checklist_items" USING btree ("checklist_id","item_key");

CREATE INDEX IF NOT EXISTS "idx_checklists_garment" ON "checklists" USING btree ("garment_id");

CREATE INDEX IF NOT EXISTS "idx_garment_photos_garment" ON "garment_photos" USING btree ("garment_id","photo_type");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_garment_stage_order" ON "garment_workflow_stages" USING btree ("garment_id","stage_order");

CREATE INDEX IF NOT EXISTS "idx_garment_stages_dept_status" ON "garment_workflow_stages" USING btree ("department","status");

CREATE INDEX IF NOT EXISTS "idx_garments_order_id" ON "garments" USING btree ("order_id");

CREATE INDEX IF NOT EXISTS "idx_garments_status_dept" ON "garments" USING btree ("current_status","current_department");

CREATE INDEX IF NOT EXISTS "idx_garments_physical_tag" ON "garments" USING btree ("physical_tag_number");

CREATE INDEX IF NOT EXISTS "idx_handover_garment" ON "handover_records" USING btree ("garment_id");

CREATE INDEX IF NOT EXISTS "idx_issue_reports_garment_status" ON "issue_reports" USING btree ("garment_id","resolution_status");

CREATE INDEX IF NOT EXISTS "idx_orders_status_created" ON "orders" USING btree ("status","created_at");

CREATE INDEX IF NOT EXISTS "idx_orders_customer_name" ON "orders" USING btree ("customer_name");

CREATE INDEX IF NOT EXISTS "idx_user_sessions_user_id" ON "user_sessions" USING btree ("user_id");

CREATE INDEX IF NOT EXISTS "idx_users_role_id" ON "users" USING btree ("role_id");

CREATE INDEX IF NOT EXISTS "idx_users_email" ON "users" USING btree ("email");

CREATE INDEX IF NOT EXISTS "idx_workflow_history_garment" ON "workflow_history" USING btree ("garment_id","created_at");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_template_stage_order" ON "workflow_template_stages" USING btree ("template_id","stage_order");

CREATE UNIQUE INDEX IF NOT EXISTS "uq_template_department" ON "workflow_template_stages" USING btree ("template_id","department");

-- ============================================================================
-- Seed Data Referensi Sistem ALMOS Laundry Detailing (Idempoten)
-- ============================================================================

INSERT INTO "roles" ("code", "name", "description") VALUES
  ('ADMIN', 'Administrator', 'Akses penuh sistem operasional, pendaftaran pesanan/barang, pengambilan, arsip, laporan, dan manajemen pengguna'),
  ('SPOTTING', 'Staf Spotting', 'Penanganan noda awal, inspeksi kondisi, pengisian checklist spotting, laporan kendala, dan serah terima ke divisi berikutnya'),
  ('IRONING', 'Staf Ironing', 'Proses setrika dan uap presisi, verifikasi identitas barang, pengisian checklist ironing, laporan kendala, dan serah terima'),
  ('PACKING', 'Staf Packing', 'Pemeriksaan akhir, pengemasan protektif, pengisian checklist packing, dan serah terima ke Admin untuk pengambilan')
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "workflow_templates" ("code", "name", "description", "is_active") VALUES
  ('FULL_DETAILING', 'Full Detailing (Spotting → Ironing → Packing)', 'Alur lengkap untuk pakaian detailing, jas, gaun, kebaya, dan item bernoda', true),
  ('SPOTTING_IRONING', 'Spotting & Ironing (Spotting → Ironing)', 'Penanganan noda dan setrika tanpa pengemasan khusus', true),
  ('IRONING_PACKING', 'Press & Packing (Ironing → Packing)', 'Setrika/steam dan pengemasan akhir untuk item bersih atau delicate press', true),
  ('PACKING_ONLY', 'Packing Only (Packing)', 'Pemeriksaan akhir dan pengemasan langsung sebelum pengambilan', true)
ON CONFLICT ("code") DO NOTHING;

INSERT INTO "workflow_template_stages" ("template_id", "department", "stage_order", "sla_hours")
SELECT wt.id, v.department, v.stage_order, v.sla_hours
FROM "workflow_templates" wt
JOIN (VALUES
  ('FULL_DETAILING', 'SPOTTING', 1, 12),
  ('FULL_DETAILING', 'IRONING',  2, 12),
  ('FULL_DETAILING', 'PACKING',  3, 8),
  ('SPOTTING_IRONING', 'SPOTTING', 1, 12),
  ('SPOTTING_IRONING', 'IRONING',  2, 12),
  ('IRONING_PACKING', 'IRONING',  1, 12),
  ('IRONING_PACKING', 'PACKING',  2, 8),
  ('PACKING_ONLY', 'PACKING', 1, 8)
) AS v(template_code, department, stage_order, sla_hours)
  ON wt.code = v.template_code
ON CONFLICT DO NOTHING;

INSERT INTO "system_settings" ("key", "value") VALUES
  ('sla_hours', '{"SPOTTING":12,"IRONING":12,"PACKING":8}'::jsonb),
  ('photo_policy', '{"max_file_size_mb":10,"allowed_mime_types":["image/jpeg","image/png","image/webp"],"require_photo_before_queue":false}'::jsonb),
  ('checklist_templates', '{"SPOTTING":[{"key":"tag_match","label":"Nomor tag fisik & detail barang sesuai catatan"},{"key":"stain_assessed","label":"Jenis noda & risiko luntur/kerusakan serat telah diperiksa"},{"key":"treatment_done","label":"Proses spotting/pre-treatment selesai tanpa merusak kain"},{"key":"hardware_checked","label":"Kancing, ritsleting, dan aksesoris dalam kondisi aman"}],"IRONING":[{"key":"tag_match","label":"Identitas barang & tag fisik terverifikasi dari divisi Spotting"},{"key":"temp_matched","label":"Suhu setrika/steamer sesuai dengan label perawatan bahan"},{"key":"finish_checked","label":"Tidak ada lipatan berlebih, kilap setrika, atau sisa kelembapan"},{"key":"visual_clean","label":"Tidak ada noda tertinggal yang muncul setelah pemanasan"}],"PACKING":[{"key":"tag_match","label":"Identitas barang, vendor/pelanggan, dan tag fisik terverifikasi"},{"key":"final_qc","label":"Kualitas kebersihan, kerapatan jahitan, dan kerapian akhir lolos QC"},{"key":"scent_cover","label":"Gantungan/lipatan dan pelindung debu terpasang rapi"},{"key":"ready_label","label":"Barang siap ditempatkan di rak pengambilan pelanggan"}]}'::jsonb)
ON CONFLICT ("key") DO NOTHING;
