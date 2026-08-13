-- Reusable workout plans/templates. Diego and Kevin can load one into the Log
-- tab (pre-filling exercises + set counts) so all that's left is reps/weight,
-- or save a completed workout as a new plan to reuse later.
CREATE TABLE IF NOT EXISTS workout_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_by TEXT NOT NULL,
  exercises TEXT NOT NULL,
  created_at TEXT NOT NULL
);

-- Seeded from Diego's Push/Pull/Legs/Upper PDF plan (Mon Legs, Wed Push,
-- Fri Pull, Sun Upper). INSERT OR IGNORE keyed by id keeps this idempotent.
INSERT OR IGNORE INTO workout_templates (id, name, created_by, exercises, created_at) VALUES
('preset-legs-monday', 'Legs', 'Diego',
 '[{"name":"Leg Press Machine","sets":4,"reps":"10-12"},{"name":"Leg Extension Machine","sets":3,"reps":"12-15"},{"name":"Seated Leg Curl Machine","sets":3,"reps":"12-15"},{"name":"Hip Abductor Machine","sets":3,"reps":"15-20"},{"name":"Romanian Deadlift","sets":3,"reps":"10-12"},{"name":"Standing Calf Raise Machine","sets":4,"reps":"15-20"},{"name":"Hip Thrust Machine","sets":3,"reps":"12-15"}]',
 '2026-08-13T00:00:00.000Z'),
('preset-push-wednesday', 'Push', 'Diego',
 '[{"name":"Chest Press Machine","sets":4,"reps":"8-10"},{"name":"Incline Dumbbell Press","sets":3,"reps":"10-12"},{"name":"Pec Deck Machine","sets":3,"reps":"12-15"},{"name":"Shoulder Press Machine","sets":3,"reps":"10-12"},{"name":"Lateral Raise Machine","sets":4,"reps":"15-20"},{"name":"Tricep Pushdown (Cable)","sets":3,"reps":"12-15"},{"name":"Overhead Tricep Extension","sets":3,"reps":"12-15"}]',
 '2026-08-13T00:00:00.000Z'),
('preset-pull-friday', 'Pull', 'Diego',
 '[{"name":"Seated Cable Row","sets":4,"reps":"8-10"},{"name":"Lat Pulldown Machine","sets":3,"reps":"10-12"},{"name":"Dumbbell One-Arm Row","sets":3,"reps":"10-12"},{"name":"Iso-Lateral Row Machine","sets":3,"reps":"12-15"},{"name":"Cable Face Pull","sets":4,"reps":"15-20"},{"name":"Dumbbell Curl","sets":3,"reps":"12-15"},{"name":"Hammer Curl","sets":3,"reps":"12-15"}]',
 '2026-08-13T00:00:00.000Z'),
('preset-upper-sunday', 'Upper', 'Diego',
 '[{"name":"Incline Chest Press Machine","sets":3,"reps":"12-15"},{"name":"Cable Fly / Crossover","sets":3,"reps":"15-20"},{"name":"Lat Pulldown Machine","sets":3,"reps":"12-15"},{"name":"Seated Cable Row","sets":3,"reps":"12-15"},{"name":"Dumbbell Lateral Raise","sets":3,"reps":"15-20"},{"name":"Rear Delt Fly Machine","sets":3,"reps":"15-20"},{"name":"Cable Bicep Curl","sets":3,"reps":"15-20"},{"name":"Tricep Pushdown (Cable)","sets":3,"reps":"15-20"}]',
 '2026-08-13T00:00:00.000Z');
