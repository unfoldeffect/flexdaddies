import { detectSource, exportCsv, importWorkouts, matchExercise, parseCsv, parseWhen } from '../lib/transfer';

const HEVY = `title,start_time,end_time,description,exercise_title,superset_id,exercise_notes,set_index,set_type,weight_lbs,reps,distance_miles,duration_seconds,rpe
"Push Day","20 Nov 2026, 18:05","20 Nov 2026, 19:01","","Bench Press (Barbell)",,"elbows in, ""slow"" down",0,"normal",135,8,,,
"Push Day","20 Nov 2026, 18:05","20 Nov 2026, 19:01","","Bench Press (Barbell)",,"",1,"normal",155,5,,,8
"Push Day","20 Nov 2026, 18:05","20 Nov 2026, 19:01","","Overhead Press (Dumbbell)",,"",0,"normal",40,10,,,
"Push Day","20 Nov 2026, 18:05","20 Nov 2026, 19:01","","Zercher Squat (Barbell)",,"",0,"normal",95,5,,,
"Push Day","20 Nov 2026, 18:05","20 Nov 2026, 19:01","","Treadmill",,"",0,"normal",,,1.2,900,6
"Legs","22 Nov 2026, 07:30","22 Nov 2026, 08:10","","Squat (Barbell)",,"",0,"warmup",45,10,,,
"Legs","22 Nov 2026, 07:30","22 Nov 2026, 08:10","","Squat (Barbell)",,"",1,"normal",185,5,,,
`;

const STRONG = `Date;Workout Name;Duration;Exercise Name;Set Order;Weight;Reps;Distance;Seconds;Notes;Workout Notes;RPE
2026-11-18 17:45:10;Upper;55m;Bench Press (Barbell);1;60;8;0;0;;;
2026-11-18 17:45:10;Upper;55m;Bench Press (Barbell);2;62,5;6;0;0;;;
2026-11-18 17:45:10;Upper;55m;Plank;1;0;0;0;90;;;
`;

describe('reading a CSV file', () => {
  it('handles quotes, doubled quotes and a line break inside a cell', () => {
    expect(parseCsv('a,b\n"x, y","say ""hi""\nthere"\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"\nthere'],
    ]);
  });
  it('handles semicolons and a byte-order mark', () => {
    expect(parseCsv('﻿a;b\r\n1;2\r\n')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
  });
  it('reads both date styles', () => {
    expect(parseWhen('20 Nov 2026, 18:05')).toEqual({ date: '2026-11-20', time: '18:05' });
    expect(parseWhen('2026-11-18 07:45:10')).toEqual({ date: '2026-11-18', time: '07:45' });
    expect(parseWhen('yesterday')).toBeNull();
  });
});

describe('matching their exercise names to ours', () => {
  it('lines up a movement and its equipment', () => {
    expect(matchExercise('Bench Press (Barbell)')).toEqual({ name: 'Bench Press', equipment: 'Barbell', matched: true });
    expect(matchExercise('Squat (Smith Machine)')).toEqual({ name: 'Squat', equipment: 'Smith', matched: true });
    expect(matchExercise('Overhead Press (Dumbbell)')).toEqual({ name: 'Shoulder Press', equipment: 'Dumbbell', matched: true });
    expect(matchExercise('Plank')).toEqual({ name: 'Plank', equipment: null, matched: true });
    expect(matchExercise('Leg Press')).toEqual({ name: 'Leg Press', equipment: 'Machine', matched: true });
  });
  it('keeps the name as it was rather than guess', () => {
    expect(matchExercise('Zercher Squat (Barbell)')).toEqual({ name: 'Zercher Squat (Barbell)', equipment: null, matched: false });
    expect(matchExercise('Bench Press (Kettlebell)').matched).toBe(false);
    expect(matchExercise('Bench Press').matched).toBe(false);
  });
});

describe('bringing in a Hevy file', () => {
  const result = importWorkouts(HEVY)!;
  it('knows the file', () => {
    expect(detectSource(parseCsv(HEVY)[0])).toBe('Hevy');
    expect(result.source).toBe('Hevy');
    expect(result.needsUnit).toBe(false);
  });
  it('builds one workout per session, oldest first', () => {
    expect(result.workouts.map((w) => [w.date, w.exercises.length])).toEqual([
      ['2026-11-20', 4],
      ['2026-11-22', 1],
    ]);
    expect([result.firstDate, result.lastDate]).toEqual(['2026-11-20', '2026-11-22']);
  });
  it('keeps sets, weights, notes and cardio time', () => {
    const [bench, press, zercher, treadmill] = result.workouts[0].exercises;
    expect(bench).toMatchObject({ name: 'Bench Press', equipment: 'Barbell', notes: 'elbows in, "slow" down' });
    expect(bench.sets).toEqual([
      { reps: 8, weight: 135, time: 0, intensity: 0 },
      { reps: 5, weight: 155, time: 0, intensity: 0 },
    ]);
    expect(press).toMatchObject({ name: 'Shoulder Press', equipment: 'Dumbbell' });
    expect(zercher.name).toBe('Zercher Squat (Barbell)');
    expect(treadmill.sets).toEqual([{ reps: 0, weight: 0, time: 15, intensity: 6 }]);
  });
  it('reports what matched and what kept its own name', () => {
    expect(result.keptNames).toEqual(['Zercher Squat (Barbell)']);
    expect(result.matchedCount).toBe(4);
  });
  it('gives the same workout the same id every time, so a second import adds nothing', () => {
    expect(importWorkouts(HEVY)!.workouts.map((w) => w.id)).toEqual(result.workouts.map((w) => w.id));
    expect(new Set(result.workouts.map((w) => w.id)).size).toBe(2);
  });
});

describe('bringing in a Strong file', () => {
  it('asks for the unit, and converts kilos to pounds', () => {
    const lbs = importWorkouts(STRONG, 'lbs')!;
    expect(lbs.source).toBe('Strong');
    expect(lbs.needsUnit).toBe(true);
    expect(lbs.workouts[0].exercises[0].sets.map((s) => s.weight)).toEqual([60, 62.5]);
    const kg = importWorkouts(STRONG, 'kg')!;
    expect(kg.workouts[0].exercises[0].sets.map((s) => s.weight)).toEqual([132.3, 137.8]);
    expect(kg.workouts[0].exercises[1]).toMatchObject({ name: 'Plank', sets: [{ reps: 0, time: 2 }] });
  });
});

describe('files that are not from Hevy or Strong', () => {
  it('are refused', () => {
    expect(importWorkouts('name,phone\nSam,555\n')).toBeNull();
    expect(importWorkouts('')).toBeNull();
    expect(importWorkouts(HEVY.split('\n')[0] + '\n')).toBeNull();
  });
});

describe('sending workouts out', () => {
  it('writes a file this app can read back with nothing changed', () => {
    const first = importWorkouts(HEVY)!.workouts;
    const again = importWorkouts(exportCsv(first))!.workouts;
    const plain = (ws: typeof first) =>
      ws.map((w) => ({ date: w.date, exercises: w.exercises.map((e) => ({ ...e, notes: e.notes })) }));
    expect(plain(again)).toEqual(plain(first));
  });
});
