-- PostgreSQL/Supabase migration 001. Run with a trusted backend database owner.

CREATE SCHEMA IF NOT EXISTS bouncebash;

SET search_path TO bouncebash, public;

CREATE TABLE IF NOT EXISTS customers (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      phone TEXT,
      city TEXT,
      address TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , email_verified INTEGER NOT NULL DEFAULT 0);

CREATE TABLE IF NOT EXISTS sessions (
      id BIGSERIAL PRIMARY KEY,
      customer_id INTEGER NOT NULL,
      token TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS packages (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      base_price REAL DEFAULT 0,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , base_price_cents INTEGER, rental_hours INTEGER, inclusions TEXT NOT NULL DEFAULT '[]');

CREATE TABLE IF NOT EXISTS add_ons (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , unit_price_cents INTEGER, max_quantity INTEGER NOT NULL DEFAULT 20);

CREATE TABLE IF NOT EXISTS bookings (
      id BIGSERIAL PRIMARY KEY,
      customer_id INTEGER,
      reference_code TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      contact_number TEXT NOT NULL,
      event_date TEXT NOT NULL,
      event_time TEXT NOT NULL,
      venue TEXT NOT NULL,
      package_name TEXT NOT NULL,
      children_count INTEGER NOT NULL,
      selected_style TEXT,
      add_ons TEXT NOT NULL DEFAULT '[]',
      notes TEXT,
      reservation_fee_accepted INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, email TEXT NOT NULL DEFAULT '', access_token_hash TEXT, expires_at TEXT, total_cents INTEGER, deposit_cents INTEGER, cancellation_reason TEXT NOT NULL DEFAULT '', model_id INTEGER, variant_id INTEGER, selection_json TEXT NOT NULL DEFAULT '{}', quote_json TEXT,
      FOREIGN KEY(customer_id) REFERENCES customers(id) ON DELETE SET NULL
    );

CREATE TABLE IF NOT EXISTS booking_add_ons (
      booking_id INTEGER NOT NULL,
      add_on_id INTEGER NOT NULL,
      PRIMARY KEY(booking_id, add_on_id),
      FOREIGN KEY(booking_id) REFERENCES bookings(id) ON DELETE CASCADE,
      FOREIGN KEY(add_on_id) REFERENCES add_ons(id) ON DELETE CASCADE
    );

CREATE TABLE IF NOT EXISTS reviews (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      event_type TEXT,
      package_name TEXT,
      rating INTEGER NOT NULL CHECK(rating BETWEEN 1 AND 5),
      message TEXT NOT NULL,
      can_feature INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , moderation_status TEXT NOT NULL DEFAULT 'pending');

CREATE TABLE IF NOT EXISTS newsletter_subscribers (
      id BIGSERIAL PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    , unsubscribe_hash TEXT);

CREATE INDEX IF NOT EXISTS idx_bookings_date ON bookings(event_date);

CREATE INDEX IF NOT EXISTS idx_bookings_customer ON bookings(customer_id);

CREATE INDEX IF NOT EXISTS idx_reviews_created ON reviews(created_at);

CREATE TABLE IF NOT EXISTS schema_migrations (version INTEGER PRIMARY KEY);

CREATE TABLE IF NOT EXISTS account_tokens (
      id BIGSERIAL PRIMARY KEY, customer_id INTEGER NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
      kind TEXT NOT NULL CHECK(kind IN ('reset','verify')), token_hash TEXT NOT NULL UNIQUE,
      expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS payments (
      id BIGSERIAL PRIMARY KEY, booking_id INTEGER NOT NULL REFERENCES bookings(id),
      amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
      reference TEXT NOT NULL UNIQUE, method TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','verified','rejected','refunded')),
      review_note TEXT NOT NULL DEFAULT '', created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE INDEX IF NOT EXISTS idx_payments_booking ON payments(booking_id);

CREATE TABLE IF NOT EXISTS notifications (
      id BIGSERIAL PRIMARY KEY, recipient TEXT NOT NULL, kind TEXT NOT NULL,
      payload TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'pending', attempts INTEGER NOT NULL DEFAULT 0,
      next_attempt_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      sent_at TEXT, last_error TEXT
    );

CREATE INDEX IF NOT EXISTS idx_notifications_pending ON notifications(status, next_attempt_at);

CREATE TABLE IF NOT EXISTS audit_events (
      id BIGSERIAL PRIMARY KEY, actor TEXT NOT NULL, action TEXT NOT NULL,
      entity TEXT NOT NULL, entity_id TEXT NOT NULL, detail TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

CREATE TABLE IF NOT EXISTS rate_limits (
      bucket TEXT PRIMARY KEY, count INTEGER NOT NULL, expires_at BIGINT NOT NULL
    );

CREATE TABLE IF NOT EXISTS rental_zones(id BIGSERIAL PRIMARY KEY, slug TEXT NOT NULL UNIQUE, name TEXT NOT NULL);

CREATE TABLE IF NOT EXISTS rental_models(id BIGSERIAL PRIMARY KEY, zone_id INTEGER NOT NULL REFERENCES rental_zones(id), name TEXT NOT NULL UNIQUE,
      description TEXT NOT NULL DEFAULT '', capacity INTEGER NOT NULL CHECK(capacity>0), image_url TEXT NOT NULL DEFAULT '', is_active INTEGER NOT NULL DEFAULT 1);

CREATE TABLE IF NOT EXISTS model_variants(id BIGSERIAL PRIMARY KEY, model_id INTEGER NOT NULL REFERENCES rental_models(id), name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1, UNIQUE(model_id,name));

CREATE TABLE IF NOT EXISTS package_models(package_id INTEGER NOT NULL REFERENCES packages(id),model_id INTEGER NOT NULL REFERENCES rental_models(id),PRIMARY KEY(package_id,model_id));

CREATE TABLE IF NOT EXISTS add_on_options(id BIGSERIAL PRIMARY KEY,add_on_id INTEGER NOT NULL REFERENCES add_ons(id),name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,UNIQUE(add_on_id,name));

CREATE TABLE IF NOT EXISTS inquiries(id BIGSERIAL PRIMARY KEY,customer_id INTEGER REFERENCES customers(id),name TEXT NOT NULL,email TEXT NOT NULL DEFAULT '',contact TEXT NOT NULL,
      details TEXT NOT NULL,status TEXT NOT NULL DEFAULT 'new' CHECK(status IN ('new','replied','converted')),
      reply TEXT NOT NULL DEFAULT '', booking_id INTEGER UNIQUE REFERENCES bookings(id),created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE TABLE IF NOT EXISTS date_blocks(event_date TEXT PRIMARY KEY,reason TEXT NOT NULL,created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP);

CREATE INDEX IF NOT EXISTS idx_inquiries_status ON inquiries(status);

ALTER TABLE customers ENABLE ROW LEVEL SECURITY;

ALTER TABLE sessions ENABLE ROW LEVEL SECURITY;

ALTER TABLE packages ENABLE ROW LEVEL SECURITY;

ALTER TABLE add_ons ENABLE ROW LEVEL SECURITY;

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

ALTER TABLE booking_add_ons ENABLE ROW LEVEL SECURITY;

ALTER TABLE reviews ENABLE ROW LEVEL SECURITY;

ALTER TABLE newsletter_subscribers ENABLE ROW LEVEL SECURITY;

ALTER TABLE schema_migrations ENABLE ROW LEVEL SECURITY;

ALTER TABLE account_tokens ENABLE ROW LEVEL SECURITY;

ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

ALTER TABLE audit_events ENABLE ROW LEVEL SECURITY;

ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

ALTER TABLE rental_zones ENABLE ROW LEVEL SECURITY;

ALTER TABLE rental_models ENABLE ROW LEVEL SECURITY;

ALTER TABLE model_variants ENABLE ROW LEVEL SECURITY;

ALTER TABLE package_models ENABLE ROW LEVEL SECURITY;

ALTER TABLE add_on_options ENABLE ROW LEVEL SECURITY;

ALTER TABLE inquiries ENABLE ROW LEVEL SECURITY;

ALTER TABLE date_blocks ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS idx_customer_email_lower ON customers(lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email_lower ON newsletter_subscribers(lower(email));

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_reference_lower ON payments(lower(reference));

CREATE OR REPLACE FUNCTION block_audit_mutation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Audit records cannot be edited or deleted'; END $$;

DROP TRIGGER IF EXISTS audit_immutable ON audit_events;

CREATE TRIGGER audit_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION block_audit_mutation();

INSERT INTO schema_migrations(version) VALUES(2) ON CONFLICT DO NOTHING;

ALTER TABLE bookings ADD CONSTRAINT fk_booking_model FOREIGN KEY(model_id) REFERENCES rental_models(id);
ALTER TABLE bookings ADD CONSTRAINT fk_booking_variant FOREIGN KEY(variant_id) REFERENCES model_variants(id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_active_booking_date ON bookings(event_date) WHERE status IN ('pending','confirmed','completed');
