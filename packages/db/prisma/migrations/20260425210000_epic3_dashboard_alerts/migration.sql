CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'ACTIVE',
  message TEXT NOT NULL,
  entity_id TEXT,
  entity_type TEXT,
  dismissed_by TEXT,
  dismissed_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS alerts_property_status_created_idx ON alerts(property_id, status, created_at);
CREATE INDEX IF NOT EXISTS alerts_property_entity_idx ON alerts(property_id, entity_id);

DO $$
BEGIN
  ALTER TABLE alerts ADD CONSTRAINT alerts_severity_check CHECK (severity IN ('HIGH', 'MEDIUM', 'LOW'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  ALTER TABLE alerts ADD CONSTRAINT alerts_status_check CHECK (status IN ('ACTIVE', 'DISMISSED', 'AUTO_RESOLVED'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
