-- Story 15.3 — backfill open-ended RoomBlock rows for rooms that currently
-- carry OUT_OF_ORDER / MAINTENANCE only in the legacy `state` column and have
-- no live block of their own (legacy drift). Rooms blocked through the app
-- already have a RoomBlock row and are skipped.

INSERT INTO "room_blocks" (
  "id", "property_id", "room_id", "block_type",
  "start_date", "end_date", "reason", "created_by", "created_at"
)
SELECT
  gen_random_uuid()::text,
  r."property_id",
  r."id",
  r."state",
  CURRENT_DATE,
  NULL,
  'Migrated from room state',
  'SYSTEM',
  NOW()
FROM "rooms" r
WHERE r."state" IN ('OUT_OF_ORDER', 'MAINTENANCE')
  AND r."deleted_at" IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM "room_blocks" b
    WHERE b."room_id" = r."id" AND b."deleted_at" IS NULL
  );
