-- Extend Room state CHECK to add HELD and OUT_OF_ORDER (alongside existing HOLD/OOO).
ALTER TABLE "rooms" DROP CONSTRAINT IF EXISTS "room_state_check";
ALTER TABLE "rooms"
  ADD CONSTRAINT "room_state_check"
    CHECK (state IN ('AVAILABLE','HOLD','HELD','RESERVED','OCCUPIED','DIRTY','CLEAN','OOO','OUT_OF_ORDER','MAINTENANCE'));

-- RoomBlock
CREATE TABLE "room_blocks" (
  "id" TEXT PRIMARY KEY,
  "property_id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "block_type" TEXT NOT NULL,
  "start_date" DATE NOT NULL,
  "end_date" DATE NOT NULL,
  "reason" TEXT NOT NULL,
  "created_by" TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "deleted_by" TEXT,
  CONSTRAINT "room_blocks_block_type_check"
    CHECK ("block_type" IN ('OUT_OF_ORDER','MAINTENANCE'))
);

CREATE INDEX "room_blocks_room_id_start_end_idx"
  ON "room_blocks" ("room_id", "start_date", "end_date");
CREATE INDEX "room_blocks_property_id_deleted_at_idx"
  ON "room_blocks" ("property_id", "deleted_at");
