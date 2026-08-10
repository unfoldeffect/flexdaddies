-- Body-weight log: one row per weigh-in.
CREATE TABLE IF NOT EXISTS weigh_ins (
  id TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  date TEXT NOT NULL,
  weight REAL NOT NULL,
  logged_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_weigh_ins_date ON weigh_ins(date);
CREATE INDEX IF NOT EXISTS idx_weigh_ins_user ON weigh_ins(user);
