-- Diego's solo Tue/Thu/Sat plan: add the 30 min stationary bike (the actual
-- cardio) first, keep the backward treadmill walk (knee rehab), raise the
-- three TRX shoulder moves to 3 sets, and rename the plan to match.
UPDATE workout_templates SET name = '5 - Cardio + Rehab', exercises = '[{"name":"Stationary Bike","sets":1,"reps":"30 min, 125-140 bpm"},{"name":"Treadmill","sets":1,"reps":"10 min backward walk, slow, hold rails"},{"name":"TRX Row","sets":3,"reps":"12"},{"name":"TRX Y and T Raise","sets":3,"reps":"10 each"},{"name":"TRX Face Pull","sets":3,"reps":"12"}]' WHERE id = 'preset-trx-treadmill';
