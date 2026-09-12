PRAGMA foreign_keys = ON;

CREATE TABLE live_categories (
  id TEXT PRIMARY KEY,
  owner_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  visibility TEXT NOT NULL DEFAULT 'private' CHECK (visibility IN ('private', 'live')),
  share_token TEXT,
  share_code TEXT,
  latest_version INTEGER NOT NULL DEFAULT 1,
  client_mutation_id TEXT,
  deleted_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);
CREATE UNIQUE INDEX live_categories_share_token_idx ON live_categories(share_token) WHERE share_token IS NOT NULL;
CREATE UNIQUE INDEX live_categories_share_code_idx ON live_categories(share_code) WHERE share_code IS NOT NULL;
CREATE UNIQUE INDEX live_categories_mutation_idx ON live_categories(owner_id, client_mutation_id)
  WHERE client_mutation_id IS NOT NULL;

CREATE TABLE live_category_versions (
  category_id TEXT NOT NULL REFERENCES live_categories(id),
  version INTEGER NOT NULL,
  name TEXT NOT NULL,
  created_at TEXT NOT NULL,
  PRIMARY KEY (category_id, version)
);

-- Membership is versioned alongside the category. A module_version snapshot means
-- an unshared/deleted source module never destroys a subscriber's copy.
CREATE TABLE live_category_members (
  category_id TEXT NOT NULL,
  category_version INTEGER NOT NULL,
  position INTEGER NOT NULL,
  module_id TEXT NOT NULL,
  module_version INTEGER NOT NULL,
  PRIMARY KEY (category_id, category_version, position),
  UNIQUE (category_id, category_version, module_id),
  FOREIGN KEY (category_id, category_version) REFERENCES live_category_versions(category_id, version),
  FOREIGN KEY (module_id, module_version) REFERENCES module_versions(module_id, version)
);

CREATE TABLE live_category_library (
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES live_categories(id),
  current_version INTEGER NOT NULL,
  local_category_id TEXT NOT NULL,
  subscribed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, category_id),
  FOREIGN KEY (category_id, current_version) REFERENCES live_category_versions(category_id, version)
);

-- Tracks why a module is in a subscriber's library. It lets category sync remove
-- stale membership without removing owned/directly-subscribed modules.
CREATE TABLE live_category_library_modules (
  user_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  module_id TEXT NOT NULL,
  PRIMARY KEY (user_id, category_id, module_id),
  FOREIGN KEY (user_id, category_id) REFERENCES live_category_library(user_id, category_id) ON DELETE CASCADE,
  FOREIGN KEY (user_id, module_id) REFERENCES module_library(user_id, module_id) ON DELETE CASCADE
);
