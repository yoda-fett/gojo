CREATE TABLE IF NOT EXISTS "issue_reports" (
  "id" TEXT NOT NULL PRIMARY KEY,
  "property_id" TEXT NOT NULL,
  "entry_context" TEXT NOT NULL,
  "category" TEXT NOT NULL,
  "attribution_stream" TEXT NOT NULL,
  "room_id" TEXT,
  "catalog_item_id" TEXT,
  "qty" INTEGER,
  "vendor_name" VARCHAR(80),
  "voice_file_url" TEXT,
  "photo_file_url" TEXT,
  "text_note" VARCHAR(280),
  "reported_by" TEXT NOT NULL,
  "reported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "status" TEXT NOT NULL DEFAULT 'PENDING_REVIEW',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "reject_reason" TEXT,
  "state_version" INTEGER NOT NULL DEFAULT 0,
  "deleted_at" TIMESTAMP(3),
  "deleted_by" TEXT
);

CREATE INDEX IF NOT EXISTS "issue_reports_property_id_status_attribution_stream_idx"
  ON "issue_reports"("property_id", "status", "attribution_stream");

CREATE INDEX IF NOT EXISTS "issue_reports_property_id_reported_at_idx"
  ON "issue_reports"("property_id", "reported_at");

DO $$ BEGIN
  ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_entry_context_check"
    CHECK ("entry_context" IN ('COLD', 'MISSING_FROM_ROOM', 'DAMAGED_ON_RETURN'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_category_check"
    CHECK ("category" IN ('DAMAGE_IN_ROOM', 'MISSING_ITEM', 'DAMAGED_RETURN', 'OTHER'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_attribution_stream_check"
    CHECK ("attribution_stream" IN ('ROOM_SHORTAGE', 'LAUNDRY_SHORTAGE', 'OTHER'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "issue_reports" ADD CONSTRAINT "issue_reports_status_check"
    CHECK ("status" IN ('PENDING_REVIEW', 'APPROVED', 'REJECTED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
