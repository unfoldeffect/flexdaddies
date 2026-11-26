-- Partner sync (Pro): two accounts link with a short invite code. After that,
-- a session one of them logs for both is handed to the other's phone. Nothing
-- else is shared: no solo workouts, no body weight, no measurements.

-- One partner per account. Stored once, with the two ids in a fixed order.
CREATE TABLE IF NOT EXISTS partner_links (
  user_a TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL UNIQUE REFERENCES users(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (user_a, user_b)
);

-- One pending invite per account. Only a hash of the code is kept.
CREATE TABLE IF NOT EXISTS partner_invites (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  code_hash TEXT NOT NULL UNIQUE,
  expires_at INTEGER NOT NULL
);

-- Wrong codes typed, to slow down guessing.
CREATE TABLE IF NOT EXISTS partner_tries (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  window_start INTEGER NOT NULL,
  tries INTEGER NOT NULL
);

-- Sessions waiting to be picked up by the partner's phone. Removed once received.
CREATE TABLE IF NOT EXISTS partner_sessions (
  id TEXT PRIMARY KEY,
  from_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  to_user TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  payload TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS partner_sessions_to ON partner_sessions(to_user, created_at);
