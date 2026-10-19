-- Solo Tue/Thu/Sat plan: 10 min backward treadmill walk (knee rehab, slow,
-- holding the rails), then the three TRX suspension-strap shoulder moves.
-- The stationary bike is logged on its own, so it is not part of this plan.
INSERT OR IGNORE INTO workout_templates (id, name, created_by, exercises, created_at) VALUES ('preset-trx-treadmill', '5 - TRX + Treadmill', 'Diego', '[{"name":"Treadmill","sets":1,"reps":"10 min backward walk, slow, hold rails"},{"name":"TRX Row","sets":2,"reps":"12"},{"name":"TRX Y and T Raise","sets":2,"reps":"10 each"},{"name":"TRX Face Pull","sets":2,"reps":"12"}]', '2026-10-19T00:00:00.000Z');
