-- WebhookSecret: rotation + channel link
ALTER TABLE "webhook_secrets"
  ADD COLUMN "channel_id" TEXT,
  ADD COLUMN "status" TEXT NOT NULL DEFAULT 'ACTIVE',
  ADD COLUMN "rotated_at" TIMESTAMP(3),
  ADD COLUMN "expired_at" TIMESTAMP(3),
  ADD COLUMN "rotation_window_hours" INTEGER NOT NULL DEFAULT 24;

ALTER TABLE "webhook_secrets"
  ADD CONSTRAINT "webhook_secrets_status_check"
    CHECK ("status" IN ('ACTIVE','ROTATING','EXPIRED'));

CREATE INDEX "webhook_secrets_channel_id_status_idx"
  ON "webhook_secrets" ("channel_id", "status");

-- Channel
CREATE TABLE "channels" (
  "id" TEXT PRIMARY KEY,
  "property_id" TEXT NOT NULL,
  "channel_type" TEXT NOT NULL,
  "channel_name" TEXT NOT NULL,
  "webhook_endpoint" TEXT NOT NULL,
  "connected_by" TEXT NOT NULL,
  "connected_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "deleted_at" TIMESTAMP(3),
  "deleted_by" TEXT,
  CONSTRAINT "channels_channel_type_check"
    CHECK ("channel_type" IN ('MMT','BOOKING_COM','AGODA','GOIBIBO','OTHER'))
);

CREATE UNIQUE INDEX "channels_property_id_channel_type_key"
  ON "channels" ("property_id", "channel_type");
CREATE INDEX "channels_property_id_idx" ON "channels" ("property_id");

-- WebhookEvent
CREATE TABLE "webhook_events" (
  "id" TEXT PRIMARY KEY,
  "channel_id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "provider_event_id" TEXT NOT NULL,
  "event_type" TEXT NOT NULL,
  "raw_payload" JSONB NOT NULL,
  "processing_status" TEXT NOT NULL,
  "error_reason" TEXT,
  "reservation_id" TEXT,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "received_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "processed_at" TIMESTAMP(3),
  CONSTRAINT "webhook_events_event_type_check"
    CHECK ("event_type" IN ('RESERVATION_INGEST','CANCELLATION_INGEST','PAYMENT_CONFIRMATION')),
  CONSTRAINT "webhook_events_processing_status_check"
    CHECK ("processing_status" IN ('QUEUED','PROCESSED','FAILED','FAILED_PERMANENT','SIGNATURE_INVALID'))
);

CREATE UNIQUE INDEX "webhook_events_channel_provider_event_key"
  ON "webhook_events" ("channel_id", "provider_event_id");
CREATE INDEX "webhook_events_channel_status_idx"
  ON "webhook_events" ("channel_id", "processing_status");
CREATE INDEX "webhook_events_property_received_idx"
  ON "webhook_events" ("property_id", "received_at");
