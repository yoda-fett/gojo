CREATE TABLE IF NOT EXISTS "inventory_restocks" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "property_id" TEXT NOT NULL,
  "catalog_item_id" TEXT NOT NULL,
  "qty_added" INTEGER NOT NULL,
  "reference" VARCHAR(120),
  "recorded_by" TEXT NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_restocks_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "consumable_write_offs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "property_id" TEXT NOT NULL,
  "catalog_item_id" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "reason" VARCHAR(280) NOT NULL,
  "source" TEXT NOT NULL DEFAULT 'OWNER_INITIATED',
  "issue_report_id" TEXT,
  "recorded_by" TEXT NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consumable_write_offs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "linen_arrivals" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "property_id" TEXT NOT NULL,
  "catalog_item_id" TEXT NOT NULL,
  "qty_added" INTEGER NOT NULL,
  "reference" VARCHAR(120),
  "recorded_by" TEXT NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "linen_arrivals_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "linen_write_offs" (
  "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
  "property_id" TEXT NOT NULL,
  "catalog_item_id" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "reason" VARCHAR(280) NOT NULL,
  "source_location" TEXT NOT NULL DEFAULT 'STORAGE',
  "laundry_log_id" TEXT,
  "issue_report_id" TEXT,
  "recorded_by" TEXT NOT NULL,
  "recorded_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "linen_write_offs_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "inventory_restocks_property_id_catalog_item_id_recorded_at_idx"
  ON "inventory_restocks" ("property_id", "catalog_item_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "consumable_write_offs_property_id_catalog_item_id_recorded_at_idx"
  ON "consumable_write_offs" ("property_id", "catalog_item_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "consumable_write_offs_property_id_issue_report_id_idx"
  ON "consumable_write_offs" ("property_id", "issue_report_id");
CREATE INDEX IF NOT EXISTS "linen_arrivals_property_id_catalog_item_id_recorded_at_idx"
  ON "linen_arrivals" ("property_id", "catalog_item_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "linen_write_offs_property_id_catalog_item_id_recorded_at_idx"
  ON "linen_write_offs" ("property_id", "catalog_item_id", "recorded_at");
CREATE INDEX IF NOT EXISTS "linen_write_offs_property_id_issue_report_id_idx"
  ON "linen_write_offs" ("property_id", "issue_report_id");
CREATE INDEX IF NOT EXISTS "linen_write_offs_property_id_laundry_log_id_idx"
  ON "linen_write_offs" ("property_id", "laundry_log_id");

DO $$ BEGIN
  ALTER TABLE "inventory_restocks" ADD CONSTRAINT "inventory_restocks_qty_added_check" CHECK ("qty_added" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "consumable_write_offs" ADD CONSTRAINT "consumable_write_offs_qty_check" CHECK ("qty" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "consumable_write_offs" ADD CONSTRAINT "consumable_write_offs_source_check" CHECK ("source" IN ('OWNER_INITIATED', 'ISSUE_REPORT_APPROVAL'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "linen_arrivals" ADD CONSTRAINT "linen_arrivals_qty_added_check" CHECK ("qty_added" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "linen_write_offs" ADD CONSTRAINT "linen_write_offs_qty_check" CHECK ("qty" > 0);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "linen_write_offs" ADD CONSTRAINT "linen_write_offs_source_location_check" CHECK ("source_location" IN ('STORAGE', 'LAUNDRY_CYCLE'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
