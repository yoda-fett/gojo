ALTER TABLE reservations
ADD COLUMN IF NOT EXISTS booking_reference TEXT;

CREATE INDEX IF NOT EXISTS reservations_property_booking_reference_idx
ON reservations(property_id, booking_reference);
