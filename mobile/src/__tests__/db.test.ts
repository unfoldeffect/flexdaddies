import * as ops from '../data/db';
import { EMPTY_DB, type Db, type Workout } from '../lib/types';

const workout = (id: string, user: 'me' | 'partner', names: string[]): Workout => ({
  id,
  user,
  date: '2026-11-01',
  exercises: names.map((name) => ({
    name,
    sets: [{ reps: 5, weight: 100, time: 0, intensity: 0 }],
    notes: '',
  })),
  notes: '',
  loggedAt: '2026-11-01T18:00:00.000Z',
  template: null,
});

const base: Db = {
  ...EMPTY_DB,
  workouts: [
    workout('w1', 'me', ['Deadlift', 'Pull-Ups']),
    workout('w2', 'partner', ['Deadlift']),
  ],
  templates: [
    { id: 't1', name: 'B Plan', createdBy: 'me', exercises: [{ name: 'Deadlift', sets: 3 }] },
  ],
  exerciseNotes: [
    {
      id: 'n1',
      user: 'me',
      exerciseName: 'Deadlift',
      text: 'brace',
      createdAt: 'x',
      updatedAt: 'x',
    },
  ],
  customExercises: [{ name: 'Yoke Walk', category: 'Other' }],
};

describe('workouts', () => {
  it('adds the newest first', () => {
    const next = ops.createWorkout(base, workout('w3', 'me', ['Pull-Ups']));
    expect(next.workouts.map((w) => w.id)).toEqual(['w3', 'w1', 'w2']);
    expect(base.workouts).toHaveLength(2);
  });

  it('only lets the person who logged a workout edit or delete it', () => {
    const edit = { id: 'w2', date: '2026-11-02', exercises: [], notes: '' };
    expect(ops.updateWorkout(base, { ...edit, user: 'me' }).workouts[1].date).toBe('2026-11-01');
    expect(ops.updateWorkout(base, { ...edit, user: 'partner' }).workouts[1].date).toBe('2026-11-02');
    expect(ops.deleteWorkout(base, { id: 'w2', user: 'me' }).workouts).toHaveLength(2);
    expect(ops.deleteWorkout(base, { id: 'w2', user: 'partner' }).workouts).toHaveLength(1);
  });

  it('editing keeps the plan label and the time it was logged', () => {
    const withPlan: Db = {
      ...base,
      workouts: [{ ...base.workouts[0], template: { id: 't1', name: 'B Plan' } }],
    };
    const next = ops.updateWorkout(withPlan, {
      id: 'w1',
      user: 'me',
      date: '2026-11-03',
      exercises: [],
      notes: '',
    });
    expect(next.workouts[0].template).toEqual({ id: 't1', name: 'B Plan' });
    expect(next.workouts[0].loggedAt).toBe('2026-11-01T18:00:00.000Z');
  });
});

describe('weigh-ins and measurements', () => {
  it('adds and deletes, owner only', () => {
    let db = ops.createWeighIn(base, {
      id: 'wi1',
      user: 'me',
      date: '2026-11-01',
      weight: 200,
      loggedAt: 'x',
    });
    db = ops.createBodyMeasurement(db, {
      id: 'm1',
      user: 'partner',
      date: '2026-11-01',
      part: 'waist',
      valueIn: 36,
      loggedAt: 'x',
    });
    expect(ops.deleteWeighIn(db, { id: 'wi1', user: 'partner' }).weighIns).toHaveLength(1);
    expect(ops.deleteWeighIn(db, { id: 'wi1', user: 'me' }).weighIns).toHaveLength(0);
    expect(ops.deleteBodyMeasurement(db, { id: 'm1', user: 'me' }).measurements).toHaveLength(1);
    expect(ops.deleteBodyMeasurement(db, { id: 'm1', user: 'partner' }).measurements).toHaveLength(0);
  });
});

describe('plans', () => {
  it('keeps plans in name order', () => {
    const next = ops.createTemplate(base, {
      id: 't2',
      name: 'A Plan',
      createdBy: 'partner',
      exercises: [{ name: 'Pull-Ups', sets: 2 }],
    });
    expect(next.templates.map((t) => t.name)).toEqual(['A Plan', 'B Plan']);
    const renamed = ops.updateTemplate(next, {
      id: 't2',
      name: 'C Plan',
      exercises: [{ name: 'Pull-Ups', sets: 2 }],
    });
    expect(renamed.templates.map((t) => t.name)).toEqual(['B Plan', 'C Plan']);
    expect(ops.deleteTemplate(renamed, { id: 't1' }).templates.map((t) => t.id)).toEqual(['t2']);
  });
});

describe('saved notes', () => {
  it('adds, edits and deletes', () => {
    let db = ops.addExerciseNote(base, {
      id: 'n2',
      user: 'partner',
      exerciseName: 'Pull-Ups',
      text: 'slow',
      createdAt: 'a',
      updatedAt: 'a',
    });
    expect(db.exerciseNotes.map((n) => n.id)).toEqual(['n2', 'n1']);
    db = ops.updateExerciseNote(db, { id: 'n2', text: 'slower', updatedAt: 'b' });
    expect(db.exerciseNotes[0]).toMatchObject({ text: 'slower', createdAt: 'a', updatedAt: 'b' });
    expect(ops.deleteExerciseNote(db, { id: 'n1' }).exerciseNotes.map((n) => n.id)).toEqual(['n2']);
  });
});

describe('the exercise list', () => {
  it('remembers a new exercise once', () => {
    const next = ops.addCustomExercise(base, { name: 'Log Press', category: 'Shoulders' });
    expect(next.customExercises).toContainEqual({ name: 'Log Press', category: 'Shoulders' });
    expect(ops.addCustomExercise(next, { name: 'Log Press', category: 'Arms' })).toBe(next);
  });

  it('an "Other" exercise takes a real category, but a real one is never overwritten', () => {
    const upgraded = ops.addCustomExercise(base, { name: 'Yoke Walk', category: 'Legs' });
    expect(upgraded.customExercises).toEqual([{ name: 'Yoke Walk', category: 'Legs' }]);
    expect(ops.addCustomExercise(upgraded, { name: 'Yoke Walk', category: 'Other' })).toBe(
      upgraded,
    );
  });

  it('renaming a custom exercise follows through to workouts, plans and notes', () => {
    const db = ops.updateExercise(
      {
        ...base,
        workouts: [workout('w1', 'me', ['Yoke Walk'])],
        templates: [
          { id: 't1', name: 'P', createdBy: 'me', exercises: [{ name: 'Yoke Walk', sets: 2 }] },
        ],
        exerciseNotes: [
          {
            id: 'n1',
            user: 'me',
            exerciseName: 'Yoke Walk',
            text: 't',
            createdAt: 'x',
            updatedAt: 'x',
          },
        ],
      },
      { currentName: 'Yoke Walk', newName: 'Yoke Carry', category: 'Legs' },
    );
    expect(db.customExercises).toEqual([{ name: 'Yoke Carry', category: 'Legs' }]);
    expect(db.workouts[0].exercises[0].name).toBe('Yoke Carry');
    expect(db.templates[0].exercises[0].name).toBe('Yoke Carry');
    expect(db.exerciseNotes[0].exerciseName).toBe('Yoke Carry');
  });

  it('renaming a built-in exercise is kept as an override and renames history', () => {
    const db = ops.updateExercise(base, {
      currentName: 'Deadlift',
      newName: 'Barbell Deadlift',
      category: 'Legs',
      builtinOriginal: 'Deadlift',
    });
    expect(db.exerciseOverrides).toEqual([
      { originalName: 'Deadlift', name: 'Barbell Deadlift', category: 'Legs', hidden: false },
    ]);
    expect(db.workouts.map((w) => w.exercises[0].name)).toEqual([
      'Barbell Deadlift',
      'Barbell Deadlift',
    ]);
    expect(db.workouts[0].exercises[1].name).toBe('Pull-Ups');
    expect(db.exerciseNotes[0].exerciseName).toBe('Barbell Deadlift');
    // A second rename replaces the first override rather than adding another.
    const again = ops.updateExercise(db, {
      currentName: 'Barbell Deadlift',
      newName: 'DL',
      category: 'Back',
      builtinOriginal: 'Deadlift',
    });
    expect(again.exerciseOverrides).toHaveLength(1);
    expect(again.workouts[1].exercises[0].name).toBe('DL');
  });

  it('removing never touches logged workouts, and built-ins can be restored', () => {
    const hidden = ops.removeExercise(base, {
      name: 'Deadlift',
      category: 'Back',
      builtinOriginal: 'Deadlift',
    });
    expect(hidden.exerciseOverrides[0]).toMatchObject({ originalName: 'Deadlift', hidden: true });
    expect(hidden.workouts).toBe(base.workouts);
    expect(
      ops.restoreExercise(hidden, { builtinOriginal: 'Deadlift' }).exerciseOverrides[0].hidden,
    ).toBe(false);
    // Hiding a renamed built-in keeps its new name.
    const renamed = ops.updateExercise(base, {
      currentName: 'Deadlift',
      newName: 'DL',
      category: 'Back',
      builtinOriginal: 'Deadlift',
    });
    expect(
      ops.removeExercise(renamed, { name: 'DL', category: 'Back', builtinOriginal: 'Deadlift' })
        .exerciseOverrides[0],
    ).toMatchObject({ name: 'DL', hidden: true });
    expect(
      ops.removeExercise(base, { name: 'Yoke Walk', category: 'Other' }).customExercises,
    ).toEqual([]);
  });

  it('renaming to the same name changes nothing', () => {
    expect(ops.renameEverywhere(base, 'Deadlift', 'Deadlift')).toBe(base);
  });
});
