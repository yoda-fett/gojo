CREATE TABLE IF NOT EXISTS "room_consumable_states" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "catalog_item_id" TEXT NOT NULL,
  "current_qty" INTEGER NOT NULL DEFAULT 0,
  "last_refill_at" TIMESTAMP(3),
  "state_version" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "deleted_by" TEXT,
  CONSTRAINT "room_consumable_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "consumption_logs" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "reservation_id" TEXT,
  "assignment_id" TEXT,
  "catalog_item_id" TEXT NOT NULL,
  "qty_added_to_reach_par" INTEGER NOT NULL,
  "qty_used" INTEGER NOT NULL,
  "created_by" TEXT NOT NULL,
  "evidence" JSONB,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "consumption_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "room_linen_states" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "catalog_item_id" TEXT NOT NULL,
  "qty" INTEGER NOT NULL DEFAULT 0,
  "state_version" INTEGER NOT NULL DEFAULT 0,
  "last_observed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "deleted_by" TEXT,
  CONSTRAINT "room_linen_states_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "laundry_logs" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "room_id" TEXT,
  "assignment_id" TEXT,
  "state" TEXT NOT NULL,
  "created_by_role" TEXT NOT NULL,
  "created_by_user_id" TEXT NOT NULL,
  "linen_category" TEXT,
  "cycle_date" DATE NOT NULL,
  "evidence" JSONB,
  "closed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "deleted_by" TEXT,
  CONSTRAINT "laundry_logs_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "laundry_log_items" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "laundry_log_id" TEXT NOT NULL,
  "source_laundry_log_item_id" TEXT,
  "catalog_item_id" TEXT NOT NULL,
  "state" TEXT NOT NULL,
  "qty" INTEGER NOT NULL,
  "remaining_qty" INTEGER NOT NULL DEFAULT 0,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "laundry_log_items_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "pending_reviews" (
  "id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "review_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "room_id" TEXT,
  "catalog_item_id" TEXT,
  "laundry_log_item_id" TEXT,
  "qty" INTEGER,
  "reason" TEXT,
  "metadata" JSONB,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "resolved_at" TIMESTAMP(3),
  "resolved_by" TEXT,
  CONSTRAINT "pending_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "room_consumable_states_property_id_room_id_catalog_item_id_key"
  ON "room_consumable_states" ("property_id", "room_id", "catalog_item_id");
CREATE INDEX IF NOT EXISTS "room_consumable_states_property_id_room_id_idx"
  ON "room_consumable_states" ("property_id", "room_id");
CREATE INDEX IF NOT EXISTS "consumption_logs_property_id_room_id_created_at_idx"
  ON "consumption_logs" ("property_id", "room_id", "created_at");
CREATE INDEX IF NOT EXISTS "consumption_logs_property_id_catalog_item_id_created_at_idx"
  ON "consumption_logs" ("property_id", "catalog_item_id", "created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "room_linen_states_property_id_room_id_catalog_item_id_key"
  ON "room_linen_states" ("property_id", "room_id", "catalog_item_id");
CREATE INDEX IF NOT EXISTS "room_linen_states_property_id_room_id_idx"
  ON "room_linen_states" ("property_id", "room_id");
CREATE INDEX IF NOT EXISTS "laundry_logs_property_id_state_cycle_date_idx"
  ON "laundry_logs" ("property_id", "state", "cycle_date");
CREATE INDEX IF NOT EXISTS "laundry_logs_property_id_room_id_state_idx"
  ON "laundry_logs" ("property_id", "room_id", "state");
CREATE INDEX IF NOT EXISTS "laundry_log_items_property_id_catalog_item_id_state_idx"
  ON "laundry_log_items" ("property_id", "catalog_item_id", "state");
CREATE INDEX IF NOT EXISTS "laundry_log_items_property_id_laundry_log_id_idx"
  ON "laundry_log_items" ("property_id", "laundry_log_id");
CREATE INDEX IF NOT EXISTS "laundry_log_items_source_laundry_log_item_id_idx"
  ON "laundry_log_items" ("source_laundry_log_item_id");
CREATE INDEX IF NOT EXISTS "pending_reviews_property_id_status_created_at_idx"
  ON "pending_reviews" ("property_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "pending_reviews_property_id_review_type_status_idx"
  ON "pending_reviews" ("property_id", "review_type", "status");

DO $$
BEGIN
  ALTER TABLE "laundry_logs"
    ADD CONSTRAINT "laundry_logs_state_check"
    CHECK ("state" IN ('ITEMS_OUT','ITEMS_IN','CLOSED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "laundry_log_items"
    ADD CONSTRAINT "laundry_log_items_state_check"
    CHECK ("state" IN ('ITEMS_OUT','ITEMS_IN'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE "pending_reviews"
    ADD CONSTRAINT "pending_reviews_status_check"
    CHECK ("status" IN ('PENDING','APPROVED','REJECTED'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
