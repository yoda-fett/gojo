-- Hotfix-8 Phase D: per-staff shift window on PropertyAccess.
-- Default 08:00–17:00 for every role (owner/co-owner carry the columns for
-- parity but the dashboard never surfaces the values for those roles).

ALTER TABLE "property_access"
  ADD COLUMN "shift_start" TEXT NOT NULL DEFAULT '08:00',
  ADD COLUMN "shift_end"   TEXT NOT NULL DEFAULT '17:00';
