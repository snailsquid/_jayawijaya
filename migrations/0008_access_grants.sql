PRAGMA foreign_keys = ON;

-- Non-payment access belongs here. A grant can unlock premium access for one
-- account or for everyone, and is evaluated at request time so it expires
-- without a cron job or deployment.
CREATE TABLE IF NOT EXISTS access_grants (
  id TEXT PRIMARY KEY NOT NULL,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('global', 'user')),
  subject_id TEXT,
  tier TEXT NOT NULL CHECK (tier = 'pro'),
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  reason TEXT NOT NULL,
  created_at TEXT NOT NULL,
  CHECK (
    (subject_type = 'global' AND subject_id IS NULL) OR
    (subject_type = 'user' AND subject_id IS NOT NULL)
  ),
  CHECK (expires_at IS NULL OR expires_at > starts_at)
);

CREATE INDEX IF NOT EXISTS access_grants_lookup_idx
  ON access_grants(active, subject_type, subject_id, starts_at, expires_at);
