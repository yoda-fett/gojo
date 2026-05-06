CREATE TABLE IF NOT EXISTS properties (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  address TEXT NOT NULL,
  city TEXT NOT NULL,
  state TEXT NOT NULL,
  pincode TEXT NOT NULL,
  gstin TEXT,
  invoice_sequence INTEGER NOT NULL DEFAULT 0,
  invoice_sequence_year INTEGER NOT NULL DEFAULT 0,
  conversion_arc_config JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT
);

CREATE TABLE IF NOT EXISTS room_types (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  max_occupancy INTEGER NOT NULL,
  base_rate NUMERIC(10, 2) NOT NULL,
  floor_rate NUMERIC(10, 2) NOT NULL,
  ceiling_rate NUMERIC(10, 2),
  gst_slab TEXT NOT NULL,
  amenities TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  state_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  UNIQUE(property_id, name)
);

CREATE TABLE IF NOT EXISTS rooms (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  room_type_id TEXT NOT NULL,
  number TEXT NOT NULL,
  floor INTEGER,
  state TEXT NOT NULL,
  hold_expires_at TIMESTAMPTZ,
  hold_ref TEXT,
  state_version INTEGER NOT NULL DEFAULT 0,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  UNIQUE(property_id, number),
  CONSTRAINT room_state_check CHECK (state IN ('AVAILABLE', 'HOLD', 'RESERVED', 'OCCUPIED', 'DIRTY', 'CLEAN', 'OOO', 'MAINTENANCE'))
);

CREATE INDEX IF NOT EXISTS rooms_property_state_idx ON rooms(property_id, state);
CREATE INDEX IF NOT EXISTS rooms_property_hold_expires_idx ON rooms(property_id, hold_expires_at);

CREATE TABLE IF NOT EXISTS reservations (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  room_id TEXT NOT NULL,
  room_type_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  check_in TIMESTAMPTZ NOT NULL,
  check_out TIMESTAMPTZ NOT NULL,
  status TEXT NOT NULL,
  source TEXT NOT NULL,
  ota_ref TEXT,
  rate_snapshot JSONB NOT NULL,
  state_version INTEGER NOT NULL DEFAULT 0,
  cancelled_at TIMESTAMPTZ,
  cancel_reason TEXT,
  no_show_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  CONSTRAINT reservation_dates_check CHECK (check_out > check_in),
  CONSTRAINT reservation_status_check CHECK (status IN ('PENDING', 'CONFIRMED', 'CHECKED_IN', 'CHECKED_OUT', 'CANCELLED', 'NO_SHOW')),
  CONSTRAINT reservation_source_check CHECK (source IN ('WALK_IN', 'DIRECT_BOOKING', 'OTA'))
);

CREATE INDEX IF NOT EXISTS reservations_property_status_idx ON reservations(property_id, status);
CREATE INDEX IF NOT EXISTS reservations_property_check_in_idx ON reservations(property_id, check_in);
CREATE INDEX IF NOT EXISTS reservations_property_check_out_idx ON reservations(property_id, check_out);

CREATE TABLE IF NOT EXISTS folios (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  reservation_id TEXT NOT NULL,
  guest_id TEXT NOT NULL,
  parent_folio_id TEXT,
  invoice_number TEXT NOT NULL,
  status TEXT NOT NULL,
  state_version INTEGER NOT NULL DEFAULT 0,
  settled_at TIMESTAMPTZ,
  closed_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  UNIQUE(property_id, invoice_number),
  CONSTRAINT folio_status_check CHECK (status IN ('OPEN', 'CLOSED', 'TRANSFERRED'))
);

CREATE INDEX IF NOT EXISTS folios_property_status_idx ON folios(property_id, status);

CREATE TABLE IF NOT EXISTS folio_lines (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  folio_id TEXT NOT NULL,
  charge_type TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10, 2) NOT NULL,
  tax_amount NUMERIC(10, 2) NOT NULL,
  gst_slab TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  reversal_of TEXT,
  reversed_by TEXT,
  reversed_at TIMESTAMPTZ,
  posted_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT folio_line_charge_type_check CHECK (charge_type IN ('ROOM_CHARGE', 'EXTRA_CHARGE', 'DISCOUNT', 'PAYMENT', 'REFUND', 'TAX_ADJUSTMENT'))
);

CREATE INDEX IF NOT EXISTS folio_lines_folio_posted_idx ON folio_lines(folio_id, posted_at);
CREATE INDEX IF NOT EXISTS folio_lines_folio_gst_idx ON folio_lines(folio_id, gst_slab);

CREATE TABLE IF NOT EXISTS guests (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  global_guest_id TEXT,
  guest_code TEXT NOT NULL,
  full_name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  id_type TEXT,
  id_number TEXT,
  consent_given_at TIMESTAMPTZ NOT NULL,
  state_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  UNIQUE(property_id, guest_code)
);

CREATE INDEX IF NOT EXISTS guests_property_phone_idx ON guests(property_id, phone);

CREATE TABLE IF NOT EXISTS subscriptions (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL UNIQUE,
  plan_key TEXT NOT NULL,
  status TEXT NOT NULL,
  trial_started_at TIMESTAMPTZ,
  trial_ends_at TIMESTAMPTZ,
  grace_period_days INTEGER NOT NULL DEFAULT 7,
  state_version INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  CONSTRAINT subscription_status_check CHECK (status IN ('TRIAL', 'ACTIVE', 'GRACE_PERIOD', 'SUSPENDED'))
);

CREATE INDEX IF NOT EXISTS subscriptions_property_status_idx ON subscriptions(property_id, status);

CREATE TABLE IF NOT EXISTS property_access (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at TIMESTAMPTZ,
  deleted_by TEXT,
  UNIQUE(property_id, user_id)
);

CREATE INDEX IF NOT EXISTS property_access_property_role_idx ON property_access(property_id, role);

CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  action TEXT NOT NULL,
  from_state TEXT,
  to_state TEXT,
  actor_id TEXT NOT NULL,
  actor_role TEXT NOT NULL,
  trace_id TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS audit_logs_property_created_idx ON audit_logs(property_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_entity_idx ON audit_logs(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  id TEXT PRIMARY KEY,
  key TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL,
  response JSONB,
  error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT idempotency_status_check CHECK (status IN ('PENDING', 'COMPLETE', 'FAILED'))
);

CREATE INDEX IF NOT EXISTS idempotency_keys_status_updated_idx ON idempotency_keys(status, updated_at);

CREATE TABLE IF NOT EXISTS webhook_secrets (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  secret TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  active_from TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  active_until TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS webhook_secrets_property_provider_active_idx ON webhook_secrets(property_id, provider, is_active);

CREATE TABLE IF NOT EXISTS refresh_tokens (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  revoked_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS refresh_tokens_property_user_idx ON refresh_tokens(property_id, user_id);

CREATE TABLE IF NOT EXISTS state_divergence_events (
  id TEXT PRIMARY KEY,
  property_id TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  server_version INTEGER NOT NULL,
  client_version INTEGER NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS state_divergence_events_property_created_idx ON state_divergence_events(property_id, created_at);
