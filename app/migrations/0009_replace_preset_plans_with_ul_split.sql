-- Diego and Kevin moved off the old Legs/Push/Pull/Upper split (which trained
-- upper body 3x/week and legs only 1x/week) to a machine/dumbbell-focused
-- Upper/Lower A/B split that hits every muscle group twice a week and avoids
-- balance-heavy free-weight moves (e.g. Bulgarian split squats) that are
-- higher-risk for lifters over 50.
-- Numeric prefixes keep them sorted in weekly order (Sun -> Mon -> Wed -> Fri)
-- since the app lists plans alphabetically by name.

DELETE FROM workout_templates
WHERE id IN (
  'preset-legs-monday',
  'preset-push-wednesday',
  'preset-pull-friday',
  'preset-upper-sunday',
  'preset-push',
  'preset-pull'
);

INSERT OR IGNORE INTO workout_templates (id, name, created_by, exercises, created_at) VALUES
('preset-upper-a', '1 - Upper A (Sun)', 'Diego',
 '[{"name":"Chest Press Machine","sets":3,"reps":"8-10"},{"name":"Seated Cable Row","sets":3,"reps":"8-10"},{"name":"Shoulder Press Machine","sets":3,"reps":"10-12"},{"name":"Lat Pulldown Machine","sets":3,"reps":"10-12"},{"name":"Lateral Raise Machine","sets":3,"reps":"12-15"},{"name":"Tricep Pushdown (Cable)","sets":3,"reps":"10-12"},{"name":"Bicep Curl Machine","sets":3,"reps":"10-12"},{"name":"Ab Crunch Machine","sets":3,"reps":"12-15"}]',
 '2026-08-27T00:00:00.000Z'),
('preset-lower-a', '2 - Lower A (Mon)', 'Diego',
 '[{"name":"Leg Press Machine","sets":3,"reps":"8-10"},{"name":"Seated Leg Curl Machine","sets":3,"reps":"10-12"},{"name":"Leg Extension Machine","sets":3,"reps":"12-15"},{"name":"Hip Thrust Machine","sets":3,"reps":"10-12"},{"name":"Standing Calf Raise Machine","sets":3,"reps":"12-15"},{"name":"Cable Crunch","sets":3,"reps":"12-15"}]',
 '2026-08-27T00:00:00.000Z'),
('preset-upper-b', '3 - Upper B (Wed)', 'Diego',
 '[{"name":"Lat Pulldown Machine","sets":3,"reps":"8-10"},{"name":"Incline Dumbbell Press","sets":3,"reps":"8-10"},{"name":"T-Bar Row Machine","sets":3,"reps":"8-10"},{"name":"Pec Deck Machine","sets":3,"reps":"12-15"},{"name":"Reverse Pec Deck (Rear Delt)","sets":3,"reps":"12-15"},{"name":"Hammer Curl","sets":3,"reps":"10-12"},{"name":"Seated Dip Machine","sets":3,"reps":"10-12"},{"name":"Torso Rotation Machine","sets":3,"reps":"12-15"}]',
 '2026-08-27T00:00:00.000Z'),
('preset-lower-b', '4 - Lower B (Fri)', 'Diego',
 '[{"name":"Leg Press Machine","sets":3,"reps":"10-12 wide stance"},{"name":"Hip Thrust Machine","sets":3,"reps":"10-12"},{"name":"Hip Abductor Machine","sets":3,"reps":"15-20"},{"name":"Glute Kickback Machine","sets":3,"reps":"12-15"},{"name":"Lying Leg Curl Machine","sets":3,"reps":"10-12"},{"name":"Seated Calf Raise Machine","sets":3,"reps":"15-20"},{"name":"Cable Woodchopper","sets":3,"reps":"12/side"}]',
 '2026-08-27T00:00:00.000Z');
