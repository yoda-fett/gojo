-- Story 10.2d: Anchor column for trial conversion arc day-offset scheduling.
ALTER TABLE "subscriptions" ADD COLUMN "current_period_start" TIMESTAMP(3);

-- Backfill existing rows so the scheduler has a non-null anchor.
UPDATE "subscriptions"
SET "current_period_start" = COALESCE("trial_started_at", "created_at")
WHERE "current_period_start" IS NULL;
