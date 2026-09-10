PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS entitlement_allocation_versions (
  user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  version INTEGER NOT NULL DEFAULT 0
);
