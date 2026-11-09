import {
  computeLastPerformance,
  computeWorkoutStats,
  fmt1,
  fromISODate,
  isValidISODate,
  lostLabel,
  measurementTotals,
  measurementsByPersonPart,
  signed,
  sortWorkoutsNewestFirst,
  toISODate,
  toStoredInches,
  toStoredLbs,
  weighInsByUser,
  weightLoss,
  weightSummary,
  workoutTotals,
} from '../lib/stats';
import type { BodyMeasurement, WeighIn, Workout } from '../lib/types';

const w = (
  id: string,
  user: 'Diego' | 'Kevin',
  date: string,
  lifts: [string, number, number][],
  loggedAt = `${date}T18:00:00.000Z`,
): Workout => ({
  id,
  user,
  date,
  exercises: lifts.map(([name, reps, weight]) => ({
    name,
    sets: [{ reps, weight, time: 0, intensity: 0 }],
    notes: '',
  })),
  notes: '',
  loggedAt,
});

const workouts = [
  w('a', 'Diego', '2026-11-01', [['Deadlift', 5, 200]]),
  w('b', 'Diego', '2026-11-08', [
    ['Deadlift', 5, 225],
    ['Pull-Ups', 8, 0],
  ]),
  w('c', 'Kevin', '2026-11-08', [['Deadlift', 3, 245]]),
  w('d', 'Diego', '2026-11-08', [['Squat', 5, 135]], '2026-11-08T20:00:00.000Z'),
];

describe('workouts', () => {
  it('sorts newest first, then by when it was logged', () => {
    expect(sortWorkoutsNewestFirst(workouts).map((x) => x.id)).toEqual(['d', 'b', 'c', 'a']);
  });

  it('finds how each exercise went last time, per person', () => {
    const diego = computeLastPerformance(workouts, 'Diego');
    expect(diego['Deadlift'].sets[0].weight).toBe(225);
    expect(Object.keys(diego).sort()).toEqual(['Deadlift', 'Pull-Ups', 'Squat']);
    expect(computeLastPerformance(workouts, 'Kevin')['Deadlift'].sets[0].weight).toBe(245);
    expect(computeLastPerformance(workouts, null)).toEqual({});
  });

  it('totals sets and weight moved', () => {
    expect(workoutTotals(workouts[1])).toEqual({ sets: 2, volume: 1125 });
  });

  it('computes totals, the last 7 days, records and daily volume', () => {
    const stats = computeWorkoutStats(workouts, new Date(2026, 10, 9, 12));
    expect(stats.total).toBe(4);
    expect(stats.thisWeek).toBe(3);
    expect(stats.perUser.Diego).toEqual({ count: 3, volume: 1000 + 1125 + 675 });
    expect(stats.perUser.Kevin.count).toBe(1);
    // Records are the heaviest weight per exercise; bodyweight (0 lbs) is left out.
    expect(stats.prs.Diego.map((p) => [p.name, p.weight])).toEqual([
      ['Deadlift', 225],
      ['Squat', 135],
    ]);
    expect(stats.prs.Kevin[0]).toMatchObject({ name: 'Deadlift', weight: 245, date: '2026-11-08' });
    expect(stats.volumeSeries).toEqual([
      { date: '2026-11-01', total: 1000 },
      { date: '2026-11-08', total: 1125 + 735 + 675 },
    ]);
  });

  it('copes with no workouts', () => {
    const stats = computeWorkoutStats([]);
    expect(stats.total).toBe(0);
    expect(stats.prs.Diego).toEqual([]);
    expect(stats.volumeSeries).toEqual([]);
  });
});

describe('body weight', () => {
  const wi = (id: string, user: 'Diego' | 'Kevin', date: string, weight: number): WeighIn => ({
    id,
    user,
    date,
    weight,
    loggedAt: `${date}T08:00:00.000Z`,
  });
  const byUser = weighInsByUser([
    wi('1', 'Diego', '2026-10-01', 205),
    wi('3', 'Diego', '2026-11-01', 201.4),
    wi('2', 'Diego', '2026-10-15', 203),
    wi('4', 'Kevin', '2026-11-01', 190),
  ]);

  it('summarises the latest weigh-in and the changes', () => {
    const s = weightSummary(byUser.Diego);
    expect(s.latest?.weight).toBe(201.4);
    expect(s.delta).toBeCloseTo(-1.6);
    expect(s.total).toBeCloseTo(-3.6);
    expect(s.series).toEqual([205, 203, 201.4]);
    expect(weightLoss(byUser.Diego)).toBeCloseTo(3.6);
  });

  it('needs two weigh-ins before showing a change', () => {
    const s = weightSummary(byUser.Kevin);
    expect(s.delta).toBeNull();
    expect(s.total).toBeNull();
    expect(weightLoss(byUser.Kevin)).toBeNull();
    expect(weightSummary([]).latest).toBeUndefined();
  });

  it('converts typed kg to stored lbs', () => {
    expect(toStoredLbs(200, 'lbs')).toBe(200);
    expect(toStoredLbs(90, 'kg')).toBe(198.4);
  });
});

describe('body measurements', () => {
  const m = (
    id: string,
    part: BodyMeasurement['part'],
    date: string,
    valueIn: number,
  ): BodyMeasurement => ({
    id,
    user: 'Diego',
    part,
    date,
    valueIn,
    loggedAt: `${date}T08:00:00.000Z`,
  });
  const by = measurementsByPersonPart([
    m('1', 'waist', '2026-10-01', 38),
    m('2', 'waist', '2026-10-15', 37.5),
    m('3', 'waist', '2026-11-01', 37),
    m('4', 'arms', '2026-10-01', 14),
    m('5', 'arms', '2026-11-01', 14.25),
    m('6', 'neck', '2026-11-01', 16),
  ]);

  it('adds up the change across body parts', () => {
    expect(by.Diego.waist.map((x) => x.id)).toEqual(['3', '2', '1']);
    expect(measurementTotals(by.Diego)).toEqual({ sinceStart: -1 + 0.25, sinceLast: -0.5 + 0.25 });
    expect(measurementTotals(by.Kevin)).toBeNull();
  });

  it('words the change', () => {
    expect(lostLabel(-0.75, 'in')).toBe('0.8 in lost');
    expect(lostLabel(0.5, 'in')).toBe('0.5 in gained');
    expect(lostLabel(0, 'in')).toBe('0 in');
    expect(lostLabel(-1, 'cm')).toBe('2.5 cm lost');
  });

  it('converts typed cm to stored inches', () => {
    expect(toStoredInches(38, 'in')).toBe(38);
    expect(toStoredInches(100, 'cm')).toBe(39.37);
  });
});

describe('formatting', () => {
  it('shows one decimal without a trailing .0', () => {
    expect(fmt1(200)).toBe('200');
    expect(fmt1(199.44)).toBe('199.4');
    expect(signed(1.25)).toBe('+1.3');
    expect(signed(-0.5)).toBe('-0.5');
    expect(signed(0)).toBe('0');
  });

  it('converts dates without shifting the day', () => {
    expect(toISODate(new Date(2026, 0, 5, 23, 30))).toBe('2026-01-05');
    expect(toISODate(fromISODate('2026-03-08'))).toBe('2026-03-08');
    expect(isValidISODate('2026-02-28')).toBe(true);
    expect(isValidISODate('2026-02-30')).toBe(false);
    expect(isValidISODate('2026-2-3')).toBe(false);
  });
});
