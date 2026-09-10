PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS entitlements (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  payment_id TEXT NOT NULL UNIQUE REFERENCES payments(id) ON DELETE CASCADE,
  product_code TEXT NOT NULL,
  plan TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  expires_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS entitlements_user_active_idx
  ON entitlements(user_id, active, expires_at);
