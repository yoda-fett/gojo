CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  phone TEXT NOT NULL UNIQUE,
  name TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT
);

CREATE TABLE IF NOT EXISTS otp_sessions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  otp_hash TEXT,
  provider_request_id TEXT,
  invitation_property_id TEXT,
  invitation_role TEXT,
  expires_at TIMESTAMPTZ NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  max_attempts INTEGER NOT NULL DEFAULT 5,
  invalidated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS otp_sessions_phone_created_idx ON otp_sessions(phone, created_at);

ALTER TABLE reservations ADD COLUMN IF NOT EXISTS selected_cancellation_policy_id TEXT;

ALTER TABLE property_access ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE property_access ADD COLUMN IF NOT EXISTS invited_at TIMESTAMPTZ;
ALTER TABLE property_access ADD COLUMN IF NOT EXISTS invited_by TEXT;
ALTER TABLE property_access ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ;

DO $$
BEGIN
  ALTER TABLE property_access ADD CONSTRAINT property_access_status_check CHECK (status IN ('PENDING', 'ACTIVE'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS cancellation_policies (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  window_hours INTEGER NOT NULL,
  penalty_type TEXT NOT NULL,
  penalty_value NUMERIC(5, 2),
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  UNIQUE(property_id, name)
);

CREATE INDEX IF NOT EXISTS cancellation_policies_property_idx ON cancellation_policies(property_id);

DO $$
BEGIN
  ALTER TABLE cancellation_policies ADD CONSTRAINT cancellation_policies_penalty_type_check CHECK (penalty_type IN ('NONE', 'FIRST_NIGHT', 'PERCENTAGE', 'FULL'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS rate_plans (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  room_type_id TEXT NOT NULL,
  name TEXT NOT NULL,
  modifier_type TEXT NOT NULL,
  modifier_value NUMERIC(10, 2) NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  UNIQUE(property_id, room_type_id, name)
);

CREATE INDEX IF NOT EXISTS rate_plans_property_room_type_idx ON rate_plans(property_id, room_type_id);

DO $$
BEGIN
  ALTER TABLE rate_plans ADD CONSTRAINT rate_plans_modifier_type_check CHECK (modifier_type IN ('FLAT', 'PERCENTAGE'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;
