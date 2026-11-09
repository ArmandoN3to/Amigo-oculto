ALTER TABLE participants ADD COLUMN IF NOT EXISTS wishlist_revision integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS wishlist_photos (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 3145728),
  UNIQUE (participant_id, position) DEFERRABLE INITIALLY DEFERRED
);
INSERT INTO schema_migrations(version) VALUES (3) ON CONFLICT DO NOTHING;
