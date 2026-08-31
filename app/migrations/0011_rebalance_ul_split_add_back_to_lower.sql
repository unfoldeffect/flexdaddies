-- Redesign: Upper days were duplicating general back work already covered
-- by rows, and carried two shoulder exercises; Lower days had no back work
-- at all. Narrow Upper to chest/lats/biceps/triceps + exactly one shoulder
-- exercise each (a different angle per day), and add a back row to each
-- Lower day so every major muscle group still lands twice a week.

UPDATE workout_templates SET exercises =
 '[{"name":"Chest Press Machine","sets":3,"reps":"8-10"},{"name":"Incline Dumbbell Press","sets":3,"reps":"8-10"},{"name":"Lat Pulldown Machine","sets":3,"reps":"10-12"},{"name":"Shoulder Press Machine","sets":3,"reps":"10-12"},{"name":"Tricep Pushdown (Cable)","sets":3,"reps":"10-12"},{"name":"Bicep Curl Machine","sets":3,"reps":"10-12"},{"name":"Ab Crunch Machine","sets":3,"reps":"12-15"}]'
WHERE id = 'preset-upper-a';

UPDATE workout_templates SET exercises =
 '[{"name":"Pec Deck Machine","sets":3,"reps":"12-15"},{"name":"Incline Chest Press Machine","sets":3,"reps":"8-10"},{"name":"Straight-Arm Pulldown","sets":3,"reps":"10-12"},{"name":"Rear Delt Fly Machine","sets":3,"reps":"12-15"},{"name":"Tricep Extension Machine","sets":3,"reps":"10-12"},{"name":"Hammer Curl","sets":3,"reps":"10-12"},{"name":"Torso Rotation Machine","sets":3,"reps":"12-15"}]'
WHERE id = 'preset-upper-b';

UPDATE workout_templates SET exercises =
 '[{"name":"Leg Press Machine","sets":3,"reps":"8-10"},{"name":"Leg Extension Machine","sets":3,"reps":"12-15"},{"name":"Seated Leg Curl Machine","sets":3,"reps":"10-12"},{"name":"Hip Thrust Machine","sets":3,"reps":"10-12"},{"name":"Seated Cable Row","sets":3,"reps":"8-10"},{"name":"Iso-Lateral Row Machine","sets":3,"reps":"10-12"},{"name":"Standing Calf Raise Machine","sets":3,"reps":"12-15"},{"name":"Cable Crunch","sets":3,"reps":"12-15"}]'
WHERE id = 'preset-lower-a';

UPDATE workout_templates SET exercises =
 '[{"name":"Hack Squat Machine","sets":3,"reps":"8-10"},{"name":"Lying Leg Curl Machine","sets":3,"reps":"10-12"},{"name":"Hip Abductor Machine","sets":3,"reps":"15-20"},{"name":"Glute Kickback Machine","sets":3,"reps":"12-15"},{"name":"T-Bar Row Machine","sets":3,"reps":"8-10"},{"name":"Seated Calf Raise Machine","sets":3,"reps":"15-20"},{"name":"Cable Woodchopper","sets":3,"reps":"12/side"}]'
WHERE id = 'preset-lower-b';
