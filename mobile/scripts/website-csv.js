// Turns flexdaddies.com workouts (rows from its database) into a CSV file the
// store app can bring in: Settings > Bring in workouts from Hevy or Strong.
// Same column layout as Hevy's export and the store app's own "Export my
// workouts", one row per set. Exercise names stay as the website wrote them;
// the app matches them to its movements when it brings the file in.
// Plain JavaScript so it runs with node on its own (see export-website-log.js).

const HEADER = [
  'title',
  'start_time',
  'end_time',
  'description',
  'exercise_title',
  'superset_id',
  'exercise_notes',
  'set_index',
  'set_type',
  'weight_lbs',
  'reps',
  'distance_miles',
  'duration_seconds',
  'rpe',
];
// The website's exercise names, written the way the app's import reads them:
// "Movement (Equipment)" for one of the app's 75 movements. Drafted Nov. 26,
// 2026 from Diego's 58 website names and approved by him. Names not listed
// keep their website name and come in as his own (added) exercises.
const WEBSITE_NAMES = {
  'Ab Crunch Machine': 'Crunch (Machine)',
  'Assisted Pull-Up Machine': 'Pull Up (Machine)',
  'Back Extension (Roman Chair)': 'Back Extension (Machine)',
  'Bicep Curl Machine': 'Bicep Curl (Machine)',
  'Cable Bicep Curl': 'Bicep Curl (Cable)',
  'Cable Face Pull': 'Face Pull (Cable)',
  'Chest Press Machine': 'Bench Press (Machine)',
  'Dumbbell Bicep Curl': 'Bicep Curl (Dumbbell)',
  'Dumbbell Curl': 'Bicep Curl (Dumbbell)',
  'Dumbbell Fly': 'Chest Fly (Dumbbell)',
  'Dumbbell Kickback': 'Triceps Kickback (Dumbbell)',
  'Dumbbell Lateral Raise': 'Lateral Raise (Dumbbell)',
  'Dumbbell One-Arm Row': 'Bent Over Row (Dumbbell)',
  'Glute Kickback Machine': 'Glute Kickback (Machine)',
  'Hammer Curl': 'Hammer Curl (Dumbbell)',
  'Hip Abductor Machine': 'Hip Abduction (Machine)',
  'Hip Thrust Machine': 'Hip Thrust (Machine)',
  'ISO Lateral Decline Press': 'Decline Bench Press (Machine)',
  'ISO Lateral Incline Press': 'Incline Bench Press (Machine)',
  'ISO Lateral Shoulder Press': 'Shoulder Press (Machine)',
  'Incline Chest Press Machine': 'Incline Bench Press (Machine)',
  'Lat Pulldown Machine': 'Lat Pulldown (Machine)',
  'Lateral Raise Machine': 'Lateral Raise (Machine)',
  'Leg Extension Machine': 'Leg Extension (Machine)',
  'Leg Press Machine': 'Leg Press (Machine)',
  'MTS Chest Press': 'Bench Press (Machine)',
  'MTS DELINE PRESS': 'Decline Bench Press (Machine)',
  'MTS INCLINE PRESS': 'Incline Bench Press (Machine)',
  'MTS Kneeling Leg Curl': 'Leg Curl (Machine)',
  'Pec Deck Machine': 'Chest Fly (Machine)',
  'Pendulum Squat Machine': 'Squat (Machine)',
  'Preacher Curl Machine': 'Preacher Curl (Machine)',
  'Rear Delt Fly Machine': 'Rear Delt Fly (Machine)',
  'Seated Cable Row': 'Seated Row (Cable)',
  'Seated Leg Curl Machine': 'Leg Curl (Machine)',
  'Shoulder Press Machine': 'Shoulder Press (Machine)',
  'Smith Machine Bench Press': 'Bench Press (Smith)',
  'Standing Calf Raise Machine': 'Calf Raise (Machine)',
  'Stationary Bike': 'Bike',
  'Tricep pull down cable': 'Triceps Pushdown (Cable)',
  // Diego, Nov. 26: these keep their website names and come in as his own
  // exercises: Cable Flys Lower, Cable Flys Mid, Chest Flys Upper, Deadlift,
  // Dumbbell Zottman Curl, Front Pulldown, ISO Lateral Row, Iso-Lateral Row
  // Machine, ISO Lateral Wide Chest (wider than a normal bench press machine),
  // Overhead Tricep Extension, Reverse Pec Deck (Rear Delt), Tricep Extension
  // Machine, Chin/Dip Assist, Crunches, Smith Machine Row.
};

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const quote = (value) => {
  const s = String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/**
 * rows: workouts table rows ({ id, user, date, exercises (JSON text), notes,
 * logged_at, template_name }). user: whose workouts to keep ("Diego").
 * Returns { csv, workouts, sets, firstDate, lastDate, skipped }.
 */
function websiteToCsv(rows, user) {
  const lines = [HEADER.join(',')];
  const mine = rows
    .filter((r) => r.user === user)
    .sort(
      (a, b) =>
        a.date.localeCompare(b.date) || String(a.logged_at).localeCompare(String(b.logged_at)),
    );
  let workouts = 0;
  let sets = 0;
  let skipped = 0;
  for (const w of mine) {
    let exercises;
    try {
      exercises = JSON.parse(w.exercises);
    } catch {
      skipped++;
      continue;
    }
    const [y, m, d] = w.date.split('-').map(Number);
    const time = String(w.logged_at).match(/T(\d{2}:\d{2})/)?.[1] ?? '12:00';
    const when = `${d} ${MONTHS[m - 1]} ${y}, ${time}`;
    const before = sets;
    for (const ex of exercises) {
      (ex.sets ?? []).forEach((s, i) => {
        const reps = Number(s.reps) || 0;
        const weight = Number(s.weight) || 0;
        const minutes = Number(s.time) || 0;
        const intensity = Number(s.intensity) || 0;
        const cardio = reps === 0 && minutes > 0;
        if (!reps && !cardio) return; // an empty set: nothing was done
        sets++;
        lines.push(
          [
            w.template_name || 'Workout',
            when,
            when,
            '',
            WEBSITE_NAMES[ex.name] ?? ex.name,
            '',
            i === 0 ? (ex.notes ?? '').trim() : '',
            i,
            'normal',
            cardio || !weight ? '' : weight,
            cardio ? '' : reps,
            '',
            cardio ? minutes * 60 : '',
            cardio && intensity ? intensity : '',
          ]
            .map(quote)
            .join(','),
        );
      });
    }
    if (sets > before) workouts++;
    else skipped++;
  }
  return {
    csv: lines.join('\n') + '\n',
    workouts,
    sets,
    skipped,
    firstDate: mine[0]?.date ?? null,
    lastDate: mine[mine.length - 1]?.date ?? null,
  };
}

module.exports = { websiteToCsv, HEADER, WEBSITE_NAMES };
