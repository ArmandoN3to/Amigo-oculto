// Shared by the application and the migration CLI; all SQL is PostgreSQL.
export const INITIAL_SCHEMA = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version integer PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS events (
  id text PRIMARY KEY,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  event_date date NOT NULL,
  gift_limit numeric(12,2) CHECK (gift_limit IS NULL OR gift_limit >= 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','drawn')),
  draw_version integer NOT NULL DEFAULT 0 CHECK (draw_version >= 0),
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS participants (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  name text NOT NULL CHECK (char_length(name) BETWEEN 1 AND 120),
  email text NOT NULL CHECK (email = lower(email)),
  wishlist_text text NOT NULL DEFAULT '' CHECK (char_length(wishlist_text) <= 5000),
  token_nonce text NOT NULL,
  access_token_hash text NOT NULL UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, email), UNIQUE(event_id, id)
);
CREATE TABLE IF NOT EXISTS exclusions (
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  giver_id text NOT NULL,
  receiver_id text NOT NULL,
  PRIMARY KEY(event_id, giver_id, receiver_id),
  FOREIGN KEY(event_id, giver_id) REFERENCES participants(event_id,id) ON DELETE CASCADE,
  FOREIGN KEY(event_id, receiver_id) REFERENCES participants(event_id,id) ON DELETE CASCADE,
  CHECK (giver_id <> receiver_id)
);
CREATE TABLE IF NOT EXISTS draws (
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  giver_id text NOT NULL,
  receiver_id text NOT NULL,
  draw_version integer NOT NULL CHECK (draw_version > 0),
  PRIMARY KEY(event_id, giver_id), UNIQUE(event_id, receiver_id),
  FOREIGN KEY(event_id, giver_id) REFERENCES participants(event_id,id) ON DELETE CASCADE,
  FOREIGN KEY(event_id, receiver_id) REFERENCES participants(event_id,id) ON DELETE CASCADE,
  CHECK (giver_id <> receiver_id)
);
CREATE TABLE IF NOT EXISTS email_deliveries (
  id text PRIMARY KEY,
  event_id text NOT NULL REFERENCES events(id) ON DELETE CASCADE,
  participant_id text NOT NULL,
  type text NOT NULL CHECK (type IN ('invitation','result')),
  draw_version integer NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','sent','failed')),
  attempts integer NOT NULL DEFAULT 0,
  last_error text,
  provider_id text,
  sent_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY(event_id,participant_id) REFERENCES participants(event_id,id) ON DELETE CASCADE,
  UNIQUE(participant_id,type,draw_version)
);
CREATE TABLE IF NOT EXISTS admin_sessions (
  token_hash text PRIMARY KEY,
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket_key text PRIMARY KEY,
  window_started timestamptz NOT NULL,
  attempts integer NOT NULL
);
CREATE INDEX IF NOT EXISTS email_deliveries_event_status ON email_deliveries(event_id,status);
CREATE INDEX IF NOT EXISTS participants_event ON participants(event_id);
INSERT INTO schema_migrations(version) VALUES (1) ON CONFLICT DO NOTHING;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '' CHECK (char_length(emoji) <= 32);
INSERT INTO schema_migrations(version) VALUES (2) ON CONFLICT DO NOTHING;
ALTER TABLE participants ADD COLUMN IF NOT EXISTS wishlist_revision integer NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS wishlist_photos (
  id text PRIMARY KEY,
  participant_id text NOT NULL REFERENCES participants(id) ON DELETE CASCADE,
  position integer NOT NULL CHECK (position >= 0),
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 3145728),
  UNIQUE (participant_id, position) DEFERRABLE INITIALLY DEFERRED
);
INSERT INTO schema_migrations(version) VALUES (3) ON CONFLICT DO NOTHING;
`;
