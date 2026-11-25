-- One saved copy of each account's phone data (workouts, weigh-ins,
-- measurements, plans, notes, exercise list changes), squeezed with gzip.
-- "rev" goes up by one with every save, so two phones cannot overwrite each
-- other without noticing.
CREATE TABLE IF NOT EXISTS user_data (
  user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  rev INTEGER NOT NULL,
  data_gz TEXT NOT NULL,
  bytes INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
