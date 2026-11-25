import {
  EQUIPMENT,
  MOVEMENTS,
  MOVEMENT_GROUPS,
  defaultEquipment,
  exerciseKey,
  exerciseLabel,
  findMovement,
} from '../lib/movements';
import { buildFromDraft, emptyExercise, templateToDraft, workoutExercisesToDraft } from '../lib/draft';
import { computeLastPerformance, computeWorkoutStats } from '../lib/stats';
import { mergeExerciseGroups } from '../lib/workout-data';

describe('the 75 movements', () => {
  it('has exactly 75 movements with unique names', () => {
    expect(MOVEMENTS).toHaveLength(75);
    expect(new Set(MOVEMENTS.map((m) => m.name.toLowerCase())).size).toBe(75);
  });

  it('uses only the five kinds of equipment, each at most once per movement', () => {
    for (const m of MOVEMENTS) {
      for (const e of m.equipment) expect(EQUIPMENT).toContain(e);
      expect(new Set(m.equipment).size).toBe(m.equipment.length);
    }
  });

  it('gives bodyweight and cardio movements no equipment step', () => {
    for (const name of ['Push Up', 'Plank', 'Treadmill', 'Wall Sit', 'Yoga']) {
      expect(findMovement(name)?.equipment).toEqual([]);
    }
  });

  it('marks only the assisted-machine moves as optional', () => {
    const optional = MOVEMENTS.filter((m) => m.optionalEquipment).map((m) => m.name);
    expect(optional.sort()).toEqual(['Chest Dip', 'Pull Up', 'Triceps Dip']);
  });

  it('feeds the exercise picker with one group per body area', () => {
    const { groups } = mergeExerciseGroups([]);
    expect(groups.map((g) => g.label)).toEqual(MOVEMENT_GROUPS.map((g) => g.label));
    expect(groups.flatMap((g) => g.options)).toHaveLength(75);
  });
});

describe('picking equipment', () => {
  it('starts from last time when it still fits', () => {
    expect(defaultEquipment('Bench Press', 'Dumbbell')).toBe('Dumbbell');
    expect(defaultEquipment('Bench Press', 'Cable')).toBeNull();
  });

  it('picks the only choice by itself, except optional ones', () => {
    expect(defaultEquipment('Arnold Press')).toBe('Dumbbell');
    expect(defaultEquipment('Chest Dip')).toBeNull();
    expect(defaultEquipment('Chest Dip', 'Machine')).toBe('Machine');
  });

  it('leaves movements with several choices unpicked the first time', () => {
    expect(defaultEquipment('Bench Press')).toBeNull();
    expect(defaultEquipment('Push Up')).toBeNull();
    expect(defaultEquipment('My Own Exercise', 'Barbell')).toBeNull();
  });
});

describe('the key for movement + equipment', () => {
  it('joins the two, or is just the name with no equipment', () => {
    expect(exerciseKey('Bench Press', 'Dumbbell')).toBe('Bench Press|Dumbbell');
    expect(exerciseKey('Push Up', null)).toBe('Push Up');
    expect(exerciseKey('Push Up')).toBe('Push Up');
    expect(exerciseLabel('Bench Press', 'Smith')).toBe('Bench Press · Smith');
  });
});

describe('equipment through a workout', () => {
  const toCategory = mergeExerciseGroups([]).toCategory;

  it('is saved with the exercise and read back', () => {
    const ex = { ...emptyExercise(), name: 'Bench Press', equipment: 'Dumbbell' as const };
    ex.sets[0] = { ...ex.sets[0], reps: '10', weight: '40' };
    const built = buildFromDraft([ex], {
      toCategory,
      togetherMode: false,
      withSavedNotes: false,
      currentUser: 'Diego',
      otherUser: 'Kevin',
    });
    expect(built.exercises[0].equipment).toBe('Dumbbell');
    const back = workoutExercisesToDraft(built.exercises, toCategory);
    expect(back[0].equipment).toBe('Dumbbell');
  });

  it('comes from a plan', () => {
    const draft = templateToDraft([{ name: 'Leg Press', sets: 3, equipment: 'Machine' }], toCategory);
    expect(draft[0].equipment).toBe('Machine');
  });

  it('treats old workouts without equipment as none', () => {
    const back = workoutExercisesToDraft(
      [{ name: 'Bench Press', sets: [{ reps: 8, weight: 135, time: 0, intensity: 0 }], notes: '' }],
      toCategory,
    );
    expect(back[0].equipment).toBeNull();
  });
});

describe('progress per movement and equipment', () => {
  const set = (weight: number) => ({ reps: 8, weight, time: 0, intensity: 0 });
  const workouts = [
    {
      id: 'a',
      user: 'Diego' as const,
      date: '2026-11-01',
      loggedAt: '2026-11-01T10:00:00Z',
      notes: '',
      exercises: [{ name: 'Bench Press', equipment: 'Barbell' as const, sets: [set(135)], notes: '' }],
    },
    {
      id: 'b',
      user: 'Diego' as const,
      date: '2026-11-08',
      loggedAt: '2026-11-08T10:00:00Z',
      notes: '',
      exercises: [{ name: 'Bench Press', equipment: 'Dumbbell' as const, sets: [set(50)], notes: '' }],
    },
  ];

  it('keeps a separate "last time" for each kind of equipment', () => {
    const last = computeLastPerformance(workouts, 'Diego');
    expect(last['Bench Press|Barbell'].sets[0].weight).toBe(135);
    expect(last['Bench Press|Dumbbell'].sets[0].weight).toBe(50);
    // The plain name is the most recent of any kind: the Log form starts on it.
    expect(last['Bench Press'].equipment).toBe('Dumbbell');
  });

  it('keeps a separate record for each kind of equipment', () => {
    const prs = computeWorkoutStats(workouts, new Date('2026-11-09')).prs.Diego;
    expect(prs.map((p) => p.name)).toEqual(['Bench Press · Barbell', 'Bench Press · Dumbbell']);
    expect(prs[0].movement).toBe('Bench Press');
  });
});
