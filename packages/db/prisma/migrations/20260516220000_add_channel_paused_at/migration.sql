-- Story 10.3: Channel pause state for trial-expiry graceful pause.
ALTER TABLE "channels" ADD COLUMN "paused_at" TIMESTAMP(3);
ALTER TABLE "channels" ADD COLUMN "paused_reason" TEXT;

CREATE INDEX "channels_property_paused_idx" ON "channels" ("property_id", "paused_at");
