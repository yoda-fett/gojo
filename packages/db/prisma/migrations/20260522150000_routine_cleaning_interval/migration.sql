-- Story 15.6 — Routine cleaning interval (Property setting).
-- Per-property R3 cadence: how many days a vacant room may sit before it is
-- automatically flagged DIRTY for a routine clean. Consumed by Story 15.7.

-- NOT NULL DEFAULT 3 backfills every existing property row to 3 in one step.
ALTER TABLE "properties"
  ADD COLUMN "routine_cleaning_interval_days" INTEGER NOT NULL DEFAULT 3;
