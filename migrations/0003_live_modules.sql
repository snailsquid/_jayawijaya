PRAGMA foreign_keys = ON;

ALTER TABLE modules ADD COLUMN visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'live'));
ALTER TABLE modules ADD COLUMN share_token TEXT;
ALTER TABLE modules ADD COLUMN latest_version INTEGER NOT NULL DEFAULT 1;
ALTER TABLE modules ADD COLUMN deleted_at TEXT;

CREATE UNIQUE INDEX modules_share_token_idx ON modules(share_token) WHERE share_token IS NOT NULL;

CREATE TABLE module_versions (
  module_id TEXT NOT NULL REFERENCES modules(id),
  version INTEGER NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  content_hash TEXT NOT NULL,
  questions_json TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  question_count INTEGER NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (module_id, version)
);

CREATE TABLE module_library (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  module_id TEXT NOT NULL REFERENCES modules(id),
  current_version INTEGER NOT NULL,
  category_id TEXT,
  subscribed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, module_id),
  FOREIGN KEY (module_id, current_version) REFERENCES module_versions(module_id, version)
);
CREATE INDEX module_library_user_idx ON module_library(user_id);

INSERT INTO module_versions
  (module_id, version, title, description, content_hash, questions_json, byte_size, question_count, created_at)
SELECT id, 1, title, description, content_hash, questions_json, byte_size, question_count, created_at
FROM modules;

INSERT INTO module_library
  (user_id, module_id, current_version, category_id, subscribed, created_at, updated_at)
SELECT owner_id, id, 1, category_id, 0, created_at, updated_at
FROM modules;
