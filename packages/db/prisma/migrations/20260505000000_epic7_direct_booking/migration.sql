-- Property: direct booking columns
ALTER TABLE "properties"
  ADD COLUMN "direct_booking_enabled" BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN "booking_slug" TEXT,
  ADD COLUMN "average_ota_commission_rate" DOUBLE PRECISION NOT NULL DEFAULT 0.18;

CREATE UNIQUE INDEX "properties_booking_slug_key" ON "properties" ("booking_slug");

-- PendingPayment
CREATE TABLE "pending_payments" (
  "id" TEXT PRIMARY KEY,
  "property_id" TEXT NOT NULL,
  "gateway_order_id" TEXT NOT NULL,
  "hold_id" TEXT NOT NULL,
  "room_id" TEXT NOT NULL,
  "room_type_id" TEXT NOT NULL,
  "guest_name" TEXT NOT NULL,
  "guest_phone" TEXT NOT NULL,
  "guest_email" TEXT,
  "check_in" TIMESTAMP(3) NOT NULL,
  "check_out" TIMESTAMP(3) NOT NULL,
  "amount" DECIMAL(10, 2) NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'PENDING',
  "gateway_event_id" TEXT,
  "reservation_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "confirmed_at" TIMESTAMP(3),
  CONSTRAINT "pending_payments_status_check"
    CHECK ("status" IN ('PENDING','CONFIRMED','EXPIRED','FAILED'))
);

CREATE UNIQUE INDEX "pending_payments_gateway_order_id_key"
  ON "pending_payments" ("gateway_order_id");
CREATE UNIQUE INDEX "pending_payments_gateway_event_id_key"
  ON "pending_payments" ("gateway_event_id");
CREATE INDEX "pending_payments_property_id_status_idx"
  ON "pending_payments" ("property_id", "status");
CREATE INDEX "pending_payments_hold_id_idx"
  ON "pending_payments" ("hold_id");

-- NotificationLog
CREATE TABLE "notification_logs" (
  "id" TEXT PRIMARY KEY,
  "property_id" TEXT NOT NULL,
  "reservation_id" TEXT NOT NULL,
  "channel" TEXT NOT NULL,
  "status" TEXT NOT NULL,
  "attempt_count" INTEGER NOT NULL DEFAULT 0,
  "last_attempt_at" TIMESTAMP(3),
  "confirmed_at" TIMESTAMP(3),
  "error_reason" TEXT,
  "provider_message_id" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "notification_logs_channel_check"
    CHECK ("channel" IN ('WHATSAPP','EMAIL','SMS')),
  CONSTRAINT "notification_logs_status_check"
    CHECK ("status" IN ('PENDING','SENT','CONFIRMED','FAILED'))
);

CREATE UNIQUE INDEX "notification_logs_reservation_channel_key"
  ON "notification_logs" ("reservation_id", "channel");
CREATE INDEX "notification_logs_property_id_status_idx"
  ON "notification_logs" ("property_id", "status");

-- UpiSettlementReconciliation
CREATE TABLE "upi_settlement_reconciliations" (
  "id" TEXT PRIMARY KEY,
  "property_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "total_gateway_transactions" INTEGER NOT NULL,
  "total_ledger_transactions" INTEGER NOT NULL,
  "discrepancy_count" INTEGER NOT NULL DEFAULT 0,
  "status" TEXT NOT NULL,
  "error_reason" TEXT,
  "run_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lines" JSONB NOT NULL,
  CONSTRAINT "upi_settlement_reconciliations_status_check"
    CHECK ("status" IN ('CLEAN','DISCREPANCY','FAILED'))
);

CREATE UNIQUE INDEX "upi_settlement_reconciliations_date_property_key"
  ON "upi_settlement_reconciliations" ("date", "property_id");
CREATE INDEX "upi_settlement_reconciliations_property_id_date_idx"
  ON "upi_settlement_reconciliations" ("property_id", "date");

-- ReconciliationDiscrepancy
CREATE TABLE "reconciliation_discrepancies" (
  "id" TEXT PRIMARY KEY,
  "reconciliation_id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "date" DATE NOT NULL,
  "booking_ref" TEXT NOT NULL,
  "gateway_order_id" TEXT NOT NULL,
  "gateway_amount" DECIMAL(10, 2) NOT NULL,
  "ledger_amount" DECIMAL(10, 2) NOT NULL,
  "discrepancy_type" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'UNRESOLVED',
  "acknowledged_at" TIMESTAMP(3),
  "acknowledged_by" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "reconciliation_discrepancies_type_check"
    CHECK ("discrepancy_type" IN ('AMOUNT_MISMATCH','MISSING_IN_LEDGER','MISSING_IN_GATEWAY')),
  CONSTRAINT "reconciliation_discrepancies_status_check"
    CHECK ("status" IN ('UNRESOLVED','ACKNOWLEDGED'))
);

CREATE INDEX "reconciliation_discrepancies_property_id_status_idx"
  ON "reconciliation_discrepancies" ("property_id", "status");
CREATE INDEX "reconciliation_discrepancies_reconciliation_id_idx"
  ON "reconciliation_discrepancies" ("reconciliation_id");

-- Reservation source: ensure DIRECT_BOOKING accepted (existing CHECK already includes it)
