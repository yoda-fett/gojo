-- Story 12.6: First-Shift Reconciliation watcher completion timestamp.
ALTER TABLE "properties" ADD COLUMN "first_shift_reconciled_at" TIMESTAMP(3);
