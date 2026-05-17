-- AlterTable
ALTER TABLE "properties" ADD COLUMN     "cold_start_completed_at" TIMESTAMP(3),
ADD COLUMN     "cold_start_progress" JSONB;

-- Backfill (Story 12.2 AC7): existing properties with any rooms or any team
-- members are treated as "already onboarded" — stamp completion at created_at
-- so Phase 1 customers are never retroactively forced through the wizard.
UPDATE "properties" p
SET "cold_start_completed_at" = p."created_at"
WHERE p."cold_start_completed_at" IS NULL
  AND (
    EXISTS (SELECT 1 FROM "rooms" r WHERE r."property_id" = p."id")
    OR EXISTS (SELECT 1 FROM "property_access" pa WHERE pa."property_id" = p."id")
  );
