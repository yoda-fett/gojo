-- Hotfix 2 Phase E: Property.active binary flag for junk/dormant suppression.
-- Workers short-circuit when active = false; sweep flips this based on
-- RefreshToken activity (no login in 60 days).

ALTER TABLE "properties"
  ADD COLUMN "active" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "dormant_at" TIMESTAMP(3);

CREATE INDEX "properties_active_idx" ON "properties" ("active");
