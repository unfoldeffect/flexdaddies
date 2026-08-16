-- Diego rebuilt Legs/Upper himself; add Push and Pull back as presets.
INSERT OR IGNORE INTO workout_templates (id, name, created_by, exercises, created_at) VALUES
('preset-push', 'Push', 'Diego',
 '[{"name":"Chest Press Machine","sets":4,"reps":"8-10"},{"name":"Incline Dumbbell Press","sets":3,"reps":"10-12"},{"name":"Pec Deck Machine","sets":3,"reps":"12-15"},{"name":"Shoulder Press Machine","sets":3,"reps":"10-12"},{"name":"Lateral Raise Machine","sets":4,"reps":"15-20"},{"name":"Tricep Pushdown (Cable)","sets":3,"reps":"12-15"},{"name":"Overhead Tricep Extension","sets":3,"reps":"12-15"}]',
 '2026-08-16T00:00:00.000Z'),
('preset-pull', 'Pull', 'Diego',
 '[{"name":"Seated Cable Row","sets":4,"reps":"8-10"},{"name":"Lat Pulldown Machine","sets":3,"reps":"10-12"},{"name":"Dumbbell One-Arm Row","sets":3,"reps":"10-12"},{"name":"Iso-Lateral Row Machine","sets":3,"reps":"12-15"},{"name":"Cable Face Pull","sets":4,"reps":"15-20"},{"name":"Dumbbell Curl","sets":3,"reps":"12-15"},{"name":"Hammer Curl","sets":3,"reps":"12-15"}]',
 '2026-08-16T00:00:00.000Z');
