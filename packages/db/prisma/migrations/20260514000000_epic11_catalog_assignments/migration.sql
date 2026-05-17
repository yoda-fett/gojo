ALTER TABLE "properties"
  ADD COLUMN IF NOT EXISTS "laundry_vendor_name" VARCHAR(80),
  ADD COLUMN IF NOT EXISTS "laundry_vendor_contact" TEXT;

ALTER TABLE "users"
  ADD COLUMN IF NOT EXISTS "pin_hash" TEXT;

CREATE TABLE IF NOT EXISTS "catalog_items" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "item_type" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "unit" VARCHAR(32) NOT NULL,
  "room_type_id" TEXT,
  "expected_qty_per_stay" INTEGER,
  "restock_threshold" INTEGER,
  "linen_category" TEXT,
  "total_owned" INTEGER,
  "min_pool_size" INTEGER,
  "state_version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "deleted_by" TEXT,
  CONSTRAINT "catalog_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "room_assignments" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "staff_user_id" TEXT NOT NULL,
  "assigned_date" DATE NOT NULL,
  "assigned_by" TEXT NOT NULL,
  "task_types" TEXT[] NOT NULL,
  "state_version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "deleted_by" TEXT,
  CONSTRAINT "room_assignments_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "catalog_items_property_id_item_type_idx"
  ON "catalog_items" ("property_id", "item_type");

CREATE INDEX IF NOT EXISTS "catalog_items_property_id_room_type_id_idx"
  ON "catalog_items" ("property_id", "room_type_id");

CREATE UNIQUE INDEX IF NOT EXISTS "catalog_items_active_name_unique"
  ON "catalog_items" ("property_id", "item_type", COALESCE("room_type_id", ''), lower("name"))
  WHERE "deleted_at" IS NULL;

CREATE INDEX IF NOT EXISTS "room_assignments_property_id_assigned_date_idx"
  ON "room_assignments" ("property_id", "assigned_date");

CREATE INDEX IF NOT EXISTS "room_assignments_staff_user_id_assigned_date_idx"
  ON "room_assignments" ("staff_user_id", "assigned_date");

CREATE INDEX IF NOT EXISTS "room_assignments_property_id_room_id_assigned_date_idx"
  ON "room_assignments" ("property_id", "room_id", "assigned_date");

CREATE UNIQUE INDEX IF NOT EXISTS "room_assignments_active_unique"
  ON "room_assignments" ("room_id", "assigned_date")
  WHERE "deleted_at" IS NULL;

DO $$
BEGIN
  ALTER TABLE "catalog_items"
    ADD CONSTRAINT "catalog_items_item_type_check"
    CHECK ("item_type" IN ('AMENITY', 'LINEN'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "catalog_items"
    ADD CONSTRAINT "catalog_items_linen_category_check"
    CHECK ("linen_category" IS NULL OR "linen_category" IN ('ROUTINE', 'PERIODIC'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "catalog_items"
    ADD CONSTRAINT "catalog_items_non_negative_counts_check"
    CHECK (
      ("expected_qty_per_stay" IS NULL OR "expected_qty_per_stay" >= 0) AND
      ("restock_threshold" IS NULL OR "restock_threshold" >= 0) AND
      ("total_owned" IS NULL OR "total_owned" >= 0) AND
      ("min_pool_size" IS NULL OR "min_pool_size" >= 0)
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
