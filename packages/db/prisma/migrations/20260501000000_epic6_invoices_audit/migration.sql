-- Property: credit-note sequence columns
ALTER TABLE "properties"
  ADD COLUMN "credit_note_sequence" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "credit_note_sequence_year" INTEGER NOT NULL DEFAULT 0;

-- AuditLog: rich before/after JSON + composite indexes
ALTER TABLE "audit_logs"
  ADD COLUMN "before" JSONB,
  ADD COLUMN "after" JSONB;

CREATE INDEX "audit_logs_property_id_action_created_at_idx"
  ON "audit_logs" ("property_id", "action", "created_at");
CREATE INDEX "audit_logs_property_id_actor_id_created_at_idx"
  ON "audit_logs" ("property_id", "actor_id", "created_at");

-- Invoice + InvoiceLine
CREATE TABLE "invoices" (
  "id" TEXT PRIMARY KEY,
  "property_id" TEXT NOT NULL,
  "folio_id" TEXT NOT NULL,
  "guest_id" TEXT NOT NULL,
  "invoice_number" TEXT NOT NULL,
  "type" TEXT NOT NULL DEFAULT 'INVOICE',
  "status" TEXT NOT NULL DEFAULT 'ISSUED',
  "parent_invoice_id" TEXT,
  "supplier_gstin" TEXT NOT NULL,
  "supplier_name" TEXT NOT NULL,
  "supplier_address" TEXT NOT NULL,
  "recipient_name" TEXT NOT NULL,
  "recipient_gstin" TEXT,
  "hsn_code" TEXT NOT NULL DEFAULT '9963',
  "check_in" TIMESTAMP(3) NOT NULL,
  "check_out" TIMESTAMP(3) NOT NULL,
  "total_nights" INTEGER NOT NULL,
  "taxable_value" DECIMAL(12,2) NOT NULL,
  "cgst_amount" DECIMAL(12,2) NOT NULL,
  "sgst_amount" DECIMAL(12,2) NOT NULL,
  "total_amount" DECIMAL(12,2) NOT NULL,
  "discount_applied" DECIMAL(12,2),
  "invoice_rate_snapshot" JSONB NOT NULL,
  "credit_note_reason" TEXT,
  "adjusted_lines" JSONB,
  "invoice_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "invoices_property_id_invoice_number_key"
  ON "invoices" ("property_id", "invoice_number");
CREATE UNIQUE INDEX "invoices_folio_id_type_key"
  ON "invoices" ("folio_id", "type");
CREATE INDEX "invoices_property_id_invoice_date_idx"
  ON "invoices" ("property_id", "invoice_date");
CREATE INDEX "invoices_property_id_parent_invoice_id_idx"
  ON "invoices" ("property_id", "parent_invoice_id");

CREATE TABLE "invoice_lines" (
  "id" TEXT PRIMARY KEY,
  "invoice_id" TEXT NOT NULL,
  "property_id" TEXT NOT NULL,
  "description" TEXT NOT NULL,
  "rate_per_night" DECIMAL(12,2) NOT NULL,
  "discount_amount" DECIMAL(12,2) NOT NULL DEFAULT 0,
  "post_discount_amount" DECIMAL(12,2) NOT NULL,
  "gst_slab" TEXT NOT NULL,
  "cgst_amount" DECIMAL(12,2) NOT NULL,
  "sgst_amount" DECIMAL(12,2) NOT NULL,
  "line_total" DECIMAL(12,2) NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "invoice_lines_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "invoice_lines_invoice_id_idx" ON "invoice_lines" ("invoice_id");
