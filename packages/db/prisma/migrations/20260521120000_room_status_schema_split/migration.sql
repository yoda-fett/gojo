-- Story 15.1 — Room status schema split (additive).
-- Introduces the dedicated housekeeping axis; `state` is retained until Story 15.5.

-- 1. housekeepingStatus — the one stored cleanliness axis (CLEAN | DIRTY).
ALTER TABLE "rooms" ADD COLUMN "housekeeping_status" TEXT NOT NULL DEFAULT 'CLEAN';

-- 2. lastCadenceMarkedDate — Phase B cadence idempotency guard (unused until Story 15.7).
ALTER TABLE "rooms" ADD COLUMN "last_cadence_marked_date" DATE;

-- 3. Backfill housekeeping_status from the legacy `state` column (solution model §5).
--    CLEAN/AVAILABLE/OCCUPIED/RESERVED/HELD -> CLEAN ; DIRTY/OUT_OF_ORDER/MAINTENANCE -> DIRTY.
UPDATE "rooms" SET "housekeeping_status" =
  CASE
    WHEN "state" IN ('DIRTY', 'OUT_OF_ORDER', 'MAINTENANCE') THEN 'DIRTY'
    ELSE 'CLEAN'
  END;

-- 4. Index on the stored cleanliness axis.
CREATE INDEX "rooms_property_id_housekeeping_status_idx" ON "rooms"("property_id", "housekeeping_status");

-- 5. Open-ended room blocks — end_date becomes nullable.
ALTER TABLE "room_blocks" ALTER COLUMN "end_date" DROP NOT NULL;
