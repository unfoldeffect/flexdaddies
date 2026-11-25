-- Store app accounts. This database belongs to the store app only;
-- flexdaddies.com has its own and is never touched from here.
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL DEFAULT '',
  weight_unit TEXT NOT NULL DEFAULT 'lbs',
  created_at INTEGER NOT NULL
);

-- One pending sign-in code per email address. Only a hash of the code is kept.
CREATE TABLE IF NOT EXISTS login_codes (
  email TEXT PRIMARY KEY,
  code_hash TEXT NOT NULL,
  expires_at INTEGER NOT NULL,
  attempts INTEGER NOT NULL DEFAULT 0,
  last_sent_at INTEGER NOT NULL,
  window_start INTEGER NOT NULL,
  sent_in_window INTEGER NOT NULL DEFAULT 1
);

-- A phone that is signed in. Only a hash of its token is kept.
CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  last_seen_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS sessions_user ON sessions(user_id);
