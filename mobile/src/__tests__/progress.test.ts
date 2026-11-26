import {
  consistency,
  estimateOneRepMax,
  exerciseProgress,
  inRange,
  setsByBodyPart,
  trackedExercises,
} from '../lib/progress';
import type { Workout } from '../lib/types';

const now = new Date(2026, 10, 25, 9); // Nov. 25, 2026
const set = (weight: number, reps: number) => ({ weight, reps, time: 0, intensity: 0 });
let n = 0;
const workout = (date: string, exercises: Workout['exercises'], user: Workout['user'] = 'me'): Workout => ({
  id: `w${n++}`,
  user,
  date,
  exercises,
  notes: '',
  loggedAt: `${date}T12:00:00.000Z`,
});
const bench = (sets: ReturnType<typeof set>[], equipment: 'Barbell' | 'Dumbbell' = 'Barbell') => ({
  name: 'Bench Press',
  equipment,
  sets,
  notes: '',
});

const log: Workout[] = [
  workout('2026-11-20', [bench([set(135, 8), set(155, 5), set(155, 6)])]),
  workout('2026-11-01', [bench([set(135, 8), set(145, 6)])]),
  workout('2026-11-20', [bench([set(60, 10)], 'Dumbbell')]),
  workout('2026-06-01', [bench([set(115, 10)])]),
  workout('2026-11-20', [{ name: 'Plank', sets: [{ weight: 0, reps: 0, time: 2, intensity: 5 }], notes: '' }]),
  workout('2026-11-21', [bench([set(225, 5)])], 'partner'),
];

describe('estimated one-rep max', () => {
  it('one rep is the weight itself', () => expect(estimateOneRepMax(200, 1)).toBe(200));
  it('uses the Epley formula', () => expect(estimateOneRepMax(150, 6)).toBe(180));
  it('does not guess from light, long sets or nothing', () => {
    expect(estimateOneRepMax(50, 20)).toBeNull();
    expect(estimateOneRepMax(0, 5)).toBeNull();
  });
});

describe('one exercise over time', () => {
  it('lists what has been lifted, most-logged first, each kind of equipment apart', () => {
    expect(trackedExercises(log, 'me')).toEqual([
      { key: 'Bench Press|Barbell', label: 'Bench Press · Barbell', name: 'Bench Press', sessions: 3 },
      { key: 'Bench Press|Dumbbell', label: 'Bench Press · Dumbbell', name: 'Bench Press', sessions: 1 },
    ]);
  });

  it('gives one point per day, oldest first, with the heaviest set and best estimate', () => {
    expect(exerciseProgress(log, 'me', 'Bench Press|Barbell')).toEqual([
      { date: '2026-06-01', topWeight: 115, topReps: 10, oneRepMax: 153 },
      { date: '2026-11-01', topWeight: 145, topReps: 6, oneRepMax: 174 },
      { date: '2026-11-20', topWeight: 155, topReps: 6, oneRepMax: 186 },
    ]);
  });

  it("never mixes in the partner's lifts", () => {
    expect(exerciseProgress(log, 'me', 'Bench Press|Barbell').some((p) => p.topWeight === 225)).toBe(false);
    expect(exerciseProgress(log, 'partner', 'Bench Press|Barbell')).toHaveLength(1);
  });

  it('the free 3-month view leaves out older days; all time keeps them', () => {
    const points = exerciseProgress(log, 'me', 'Bench Press|Barbell');
    expect(inRange(points, '3M', now).map((p) => p.date)).toEqual(['2026-11-01', '2026-11-20']);
    expect(inRange(points, '1M', now).map((p) => p.date)).toEqual(['2026-11-01', '2026-11-20']);
    expect(inRange(points, '1Y', now)).toHaveLength(3);
    expect(inRange(points, 'All', now)).toHaveLength(3);
  });
});

describe('sets by body part', () => {
  const categoryOf = (name: string) =>
    name === 'Plank' ? { label: 'Core', color: '#0f0' } : { label: 'Chest', color: '#f00' };
  it('compares the last 7 days with the 4 weeks before', () => {
    expect(setsByBodyPart(log, 'me', categoryOf, now)).toEqual([
      { label: 'Chest', color: '#f00', thisWeek: 4, usual: 0.5 },
      { label: 'Core', color: '#0f0', thisWeek: 1, usual: 0 },
    ]);
  });
});

describe('consistency', () => {
  it('counts workout days per week and the run of weeks in a row', () => {
    const steady = ['2026-11-24', '2026-11-22', '2026-11-16', '2026-11-10', '2026-10-20'].map((d) =>
      workout(d, [bench([set(100, 5)])]),
    );
    const c = consistency(steady, 'me', now);
    expect(c.weeks).toHaveLength(12);
    expect(c.weeks.slice(-3)).toEqual([1, 1, 2]);
    expect(c.streak).toBe(3);
    expect(c.perWeek).toBe(0.4);
  });
  it('a quiet current week does not break the streak yet', () => {
    const lastWeek = [workout('2026-11-16', [bench([set(100, 5)])]), workout('2026-11-09', [bench([set(100, 5)])])];
    expect(consistency(lastWeek, 'me', now).streak).toBe(2);
    expect(consistency([], 'me', now)).toEqual({ weeks: Array(12).fill(0), streak: 0, perWeek: 0 });
  });
});
