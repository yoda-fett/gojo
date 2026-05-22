-- Story 15.5 AC-4 — drop the legacy conflated `state` column.
-- Occupancy is now derived from reservations, housekeeping lives in
-- `housekeeping_status`, and out-of-service is modelled as room_blocks.
-- Every reader has been migrated off `state`.

DROP INDEX IF EXISTS "rooms_property_id_state_idx";
ALTER TABLE "rooms" DROP COLUMN "state";
