-- Additive PostgreSQL migration: preserve historical bookings and attachments.
SET search_path TO bouncebash,public;
ALTER TABLE bookings ALTER COLUMN children_count DROP NOT NULL;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS city_id TEXT;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS extra_hours INTEGER NOT NULL DEFAULT 0;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS delivery_fee_cents INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS subtotal_cents INTEGER;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS pricing_state TEXT NOT NULL DEFAULT 'legacy';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS flow_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE rental_models ADD COLUMN IF NOT EXISTS booking_package_id INTEGER REFERENCES packages(id);
ALTER TABLE rental_models ADD COLUMN IF NOT EXISTS includes_balls INTEGER NOT NULL DEFAULT 0;
ALTER TABLE rental_models ADD COLUMN IF NOT EXISTS is_demo INTEGER NOT NULL DEFAULT 0;
INSERT INTO schema_migrations(version) VALUES(4) ON CONFLICT DO NOTHING;
