// The flexdaddies.com export (scripts/website-csv.js) must come back in
// through the app's own import exactly: same workouts, sets, weights, notes.
import { importWorkouts, matchExercise } from '../lib/transfer';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const { websiteToCsv, WEBSITE_NAMES } = require('../../scripts/website-csv');

const rows = [
  {
    id: 'w1',
    user: 'Diego',
    date: '2026-08-07',
    logged_at: '2026-08-07T14:22:05.000Z',
    notes: '',
    template_name: 'Upper A',
    exercises: JSON.stringify([
      {
        name: 'Bench Press',
        notes: 'Seat 4, "slow" down',
        sets: [
          { reps: 10, weight: 135, time: 0, intensity: 0 },
          { reps: 8, weight: 145.5, time: 0, intensity: 0 },
          { reps: 0, weight: 0, time: 0, intensity: 0 },
        ],
      },
      { name: 'Treadmill', notes: '', sets: [{ reps: 0, weight: 0, time: 20, intensity: 6 }] },
      { name: 'Push Up', notes: '', sets: [{ reps: 15, weight: 0, time: 0, intensity: 0 }] },
    ]),
  },
  {
    id: 'w2',
    user: 'Kevin',
    date: '2026-08-08',
    logged_at: '2026-08-08T13:00:00.000Z',
    notes: '',
    template_name: null,
    exercises: JSON.stringify([
      { name: 'Leg Press', notes: '', sets: [{ reps: 12, weight: 200, time: 0, intensity: 0 }] },
    ]),
  },
  {
    id: 'w3',
    user: 'Diego',
    date: '2026-08-09',
    logged_at: '2026-08-09T12:00:00.000Z',
    notes: '',
    template_name: null,
    exercises: JSON.stringify([
      { name: 'Bench Press', notes: '', sets: [{ reps: 0, weight: 0, time: 0, intensity: 0 }] },
    ]),
  },
];

describe('flexdaddies.com export', () => {
  const out = websiteToCsv(rows, 'Diego');

  it("keeps only the one person's workouts and skips empty ones", () => {
    expect(out.workouts).toBe(1);
    expect(out.sets).toBe(4);
    expect(out.skipped).toBe(1);
    expect(out.csv).not.toContain('Leg Press');
  });

  it("comes back in through the app's import as a Hevy file", () => {
    const r = importWorkouts(out.csv);
    expect(r?.source).toBe('Hevy');
    expect(r?.workouts).toHaveLength(1);
    const w = r!.workouts[0];
    expect(w.date).toBe('2026-08-07');
    expect(w.loggedAt).toBe('2026-08-07T14:22:00.000Z');
    const bench = w.exercises.find((e) => e.name === 'Bench Press')!;
    expect(bench.sets.map((s) => [s.reps, s.weight])).toEqual([
      [10, 135],
      [8, 145.5],
    ]);
    expect(bench.notes).toBe('Seat 4, "slow" down');
    const tread = w.exercises.find((e) => e.name === 'Treadmill')!;
    expect(tread.sets).toEqual([{ reps: 0, weight: 0, time: 20, intensity: 6 }]);
    expect(w.exercises.find((e) => e.name === 'Push Up')!.sets[0]).toMatchObject({
      reps: 15,
      weight: 0,
    });
  });

  it('brought in twice, adds nothing the second time (same ids)', () => {
    const a = importWorkouts(out.csv)!.workouts.map((w) => w.id);
    const b = importWorkouts(out.csv)!.workouts.map((w) => w.id);
    expect(b).toEqual(a);
  });

  it("writes every listed website name as one of the app's movements", () => {
    const misses = Object.entries(WEBSITE_NAMES as Record<string, string>).filter(
      ([, ours]) => !matchExercise(ours).matched,
    );
    expect(misses).toEqual([]);
  });

  it('turns website names into movements with equipment', () => {
    const r = importWorkouts(
      websiteToCsv(
        [
          {
            ...rows[0],
            exercises: JSON.stringify([
              {
                name: 'Leg Press Machine',
                notes: '',
                sets: [{ reps: 10, weight: 270, time: 0, intensity: 0 }],
              },
            ]),
          },
        ],
        'Diego',
      ).csv,
    )!;
    expect(r.workouts[0].exercises[0]).toMatchObject({ name: 'Leg Press', equipment: 'Machine' });
  });
});
