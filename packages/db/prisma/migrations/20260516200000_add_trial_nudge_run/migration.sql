-- Story 10.2e: TRIAL_NUDGE handler idempotency + run audit.
CREATE TABLE "trial_nudge_runs" (
  "id"                  TEXT PRIMARY KEY,
  "property_id"         TEXT NOT NULL,
  "touchpoint_type"     TEXT NOT NULL,
  "day_offset"          INTEGER NOT NULL,
  "status"              TEXT NOT NULL DEFAULT 'SUCCESS',
  "provider_message_id" TEXT,
  "error_reason"        TEXT,
  "ran_at"              TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX "trial_nudge_runs_property_type_offset_unique"
  ON "trial_nudge_runs" ("property_id", "touchpoint_type", "day_offset");

CREATE INDEX "trial_nudge_runs_property_ran_at_idx"
  ON "trial_nudge_runs" ("property_id", "ran_at");
