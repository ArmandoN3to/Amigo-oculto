ALTER TABLE participants ADD COLUMN IF NOT EXISTS emoji text NOT NULL DEFAULT '' CHECK (char_length(emoji) <= 32);
INSERT INTO schema_migrations(version) VALUES (2) ON CONFLICT DO NOTHING;
