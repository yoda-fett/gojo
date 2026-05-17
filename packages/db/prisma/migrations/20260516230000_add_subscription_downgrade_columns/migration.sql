-- Story 10.4: Billing cadence + scheduled-downgrade columns on Subscription.
ALTER TABLE "subscriptions" ADD COLUMN "current_period_end" TIMESTAMP(3);
ALTER TABLE "subscriptions"
  ADD COLUMN "billing_cadence" VARCHAR(16) NOT NULL DEFAULT 'MONTHLY';
ALTER TABLE "subscriptions"
  ADD COLUMN "pending_downgrade_tier" VARCHAR(16);
ALTER TABLE "subscriptions" ADD COLUMN "pending_downgrade_at" TIMESTAMP(3);

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_billing_cadence_check"
  CHECK ("billing_cadence" IN ('MONTHLY', 'ANNUAL'));

ALTER TABLE "subscriptions"
  ADD CONSTRAINT "subscriptions_pending_tier_check"
  CHECK ("pending_downgrade_tier" IS NULL OR "pending_downgrade_tier" IN ('STARTER', 'GROWTH'));
