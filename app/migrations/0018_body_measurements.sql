-- Body measurements: one row per body part per check-in.
-- Values are always stored in inches. The app converts to cm for display.
CREATE TABLE IF NOT EXISTS body_measurements (
  id TEXT PRIMARY KEY,
  user TEXT NOT NULL,
  date TEXT NOT NULL,
  part TEXT NOT NULL,
  value_in REAL NOT NULL,
  logged_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_body_measurements_user ON body_measurements(user);
CREATE INDEX IF NOT EXISTS idx_body_measurements_date ON body_measurements(date);
