CREATE TABLE IF NOT EXISTS bouncebash.payment_proofs (
  id TEXT PRIMARY KEY,
  payment_id BIGINT NOT NULL UNIQUE REFERENCES bouncebash.payments(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK(media_type IN ('image/png','image/jpeg','image/webp')),
  image BYTEA NOT NULL CHECK(octet_length(image) BETWEEN 1 AND 5242880)
);

ALTER TABLE bouncebash.payment_proofs ENABLE ROW LEVEL SECURITY;
INSERT INTO bouncebash.schema_migrations(version) VALUES(3) ON CONFLICT DO NOTHING;
