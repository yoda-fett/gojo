-- Story 10.1: Subscription tier + lifecycle timestamps.
ALTER TABLE "subscriptions" ADD COLUMN "tier" VARCHAR(16) NOT NULL DEFAULT 'TRIAL';
ALTER TABLE "subscriptions" ADD COLUMN "suspended_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "paused_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "cancelled_at" TIMESTAMP(3);
ALTER TABLE "subscriptions" ADD COLUMN "cancellation_reason" TEXT;

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_tier_check"
  CHECK ("tier" IN ('TRIAL', 'STARTER', 'GROWTH'));

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_status_check"
  CHECK ("status" IN ('TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED', 'CANCELLED', 'PAUSED'));
