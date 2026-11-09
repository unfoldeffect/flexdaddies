import {
  blankDraftSets,
  buildFromDraft,
  canSaveDraft,
  clampSetsForCategory,
  cleanSets,
  draftHasContent,
  draftHasEntries,
  draftToTemplateExercises,
  emptyExercise,
  lastWorkoutSummary,
  makeSets,
  resolveCategory,
  sanitizeIntensityInput,
  sanitizeWholeNumberInput,
  templateToDraft,
  workoutExercisesToDraft,
  type DraftExercise,
} from '../lib/draft';
import { NUM_SETS, OTHER_VALUE, mergeExerciseGroups } from '../lib/workout-data';

const { toCategory } = mergeExerciseGroups([{ name: 'Sandbag Carry', category: 'Other' }]);
const opts = {
  toCategory,
  togetherMode: false,
  withSavedNotes: true,
  currentUser: 'Diego',
  otherUser: 'Kevin',
} as const;

function exercise(patch: Partial<DraftExercise>): DraftExercise {
  return { ...emptyExercise(), ...patch };
}
const set = (reps: string, weight: string) => ({ id: `${reps}-${weight}`, reps, weight, time: '', intensity: '' });

describe('sets', () => {
  it('makes between 1 and the usual number of blank sets', () => {
    expect(makeSets()).toHaveLength(NUM_SETS);
    expect(makeSets(0)).toHaveLength(1);
    expect(makeSets(9)).toHaveLength(NUM_SETS);
  });

  it('gives cardio one set and keeps what was typed', () => {
    const sets = [set('10', '50'), set('8', '50'), set('', '')];
    expect(clampSetsForCategory(sets, true)).toEqual([sets[0]]);
    expect(clampSetsForCategory([sets[0]], false)).toHaveLength(NUM_SETS);
    expect(clampSetsForCategory([sets[0]], false)[0]).toBe(sets[0]);
  });
});

describe('starting a workout', () => {
  it('builds a draft from a plan, with cardio as a single set', () => {
    const draft = templateToDraft(
      [
        { name: 'Stationary Bike', sets: 1, reps: '30 min' },
        { name: 'TRX Row', sets: 3, reps: '12' },
        { name: 'Made Up Move', sets: 2 },
      ],
      toCategory,
    );
    expect(draft.map((d) => d.sets.length)).toEqual([1, 3, 2]);
    expect(draft[0].targetReps).toBe('30 min');
    // An exercise no longer on the list becomes "type your own" with its name kept.
    expect(draft[2].name).toBe(OTHER_VALUE);
    expect(draft[2].customName).toBe('Made Up Move');
  });

  it('builds a draft from a logged workout and can blank it for Repeat', () => {
    const draft = workoutExercisesToDraft(
      [
        { name: 'Leg Press Machine', sets: [{ reps: 10, weight: 222.5, time: 0, intensity: 0 }], notes: 'deep' },
        { name: 'Treadmill', sets: [{ reps: 0, weight: 0, time: 10, intensity: 3 }], notes: '' },
      ],
      toCategory,
    );
    expect(draft[0].sets[0]).toMatchObject({ reps: '10', weight: '222.5' });
    expect(draft[0].sets).toHaveLength(NUM_SETS);
    expect(draft[1].sets).toHaveLength(1);
    expect(draft[1].sets[0]).toMatchObject({ time: '10', intensity: '3', reps: '' });

    const blank = blankDraftSets(draft);
    expect(blank[0].name).toBe('Leg Press Machine');
    expect(draftHasEntries(blank)).toBe(false);
    expect(blank[0].notes).toBe('');
  });

  it('an empty plan or workout still gives one blank card', () => {
    expect(templateToDraft([], toCategory)).toHaveLength(1);
    expect(workoutExercisesToDraft([], toCategory)).toHaveLength(1);
  });
});

describe('what counts as worth saving', () => {
  it('an untouched form has no content', () => {
    expect(draftHasContent([emptyExercise()])).toBe(false);
    expect(canSaveDraft([emptyExercise()], false)).toBe(false);
  });

  it('a picked exercise is content but not yet saveable', () => {
    const d = [exercise({ name: 'Deadlift' })];
    expect(draftHasContent(d)).toBe(true);
    expect(draftHasEntries(d)).toBe(false);
    expect(canSaveDraft(d, false)).toBe(false);
  });

  it('needs a name and a number; partner sets only count in Together Mode', () => {
    const mine = [exercise({ name: 'Deadlift', sets: [set('5', '225')] })];
    expect(canSaveDraft(mine, false)).toBe(true);
    const theirs = [exercise({ name: 'Deadlift', setsOther: [set('5', '225')] })];
    expect(canSaveDraft(theirs, false)).toBe(false);
    expect(canSaveDraft(theirs, true)).toBe(true);
    expect(canSaveDraft([exercise({ sets: [set('5', '225')] })], false)).toBe(false);
  });
});

describe('typing numbers', () => {
  it('reps accept digits only', () => {
    expect(sanitizeWholeNumberInput('12', '1')).toBe('12');
    expect(sanitizeWholeNumberInput('1.5', '1')).toBe('1');
    expect(sanitizeWholeNumberInput('-3', '')).toBe('');
    expect(sanitizeWholeNumberInput('', '9')).toBe('');
  });

  it('intensity stops at 10', () => {
    expect(sanitizeIntensityInput('10', '1')).toBe('10');
    expect(sanitizeIntensityInput('11', '1')).toBe('1');
    expect(sanitizeIntensityInput('x', '7')).toBe('7');
  });
});

describe('saving', () => {
  it('drops blank sets and keeps decimal weights exactly', () => {
    expect(cleanSets([set('10', '22.5'), set('', ''), set('8', '')], false)).toEqual([
      { reps: 10, weight: 22.5, time: 0, intensity: 0 },
      { reps: 8, weight: 0, time: 0, intensity: 0 },
    ]);
    expect(cleanSets([{ id: 'a', reps: '', weight: '', time: '30', intensity: '6' }], true)).toEqual([
      { reps: 0, weight: 0, time: 30, intensity: 6 },
    ]);
  });

  it('builds the workout, new exercises to remember, and notes to keep', () => {
    const built = buildFromDraft(
      [
        exercise({ name: 'Deadlift', sets: [set('5', '225')], notes: ' brace hard ', sessionNotes: ['belt on'] }),
        exercise({ name: OTHER_VALUE, customName: ' Log Press ', customCategory: 'Shoulders', sets: [set('3', '150')] }),
        exercise({ name: 'Pull-Ups' }),
        exercise({ sets: [set('9', '9')] }),
      ],
      opts,
    );
    expect(built.exercises.map((e) => e.name)).toEqual(['Deadlift', 'Log Press']);
    expect(built.exercises[0].notes).toBe('belt on\nbrace hard');
    expect(built.toRegister).toEqual([{ name: 'Log Press', category: 'Shoulders' }]);
    expect(built.notesToSave).toEqual([{ user: 'Diego', name: 'Deadlift', text: 'brace hard' }]);
    expect(built.exercisesOther).toEqual([]);
  });

  it('Together Mode builds a second workout for the partner', () => {
    const built = buildFromDraft(
      [exercise({ name: 'Deadlift', sets: [set('5', '225')], setsOther: [set('5', '245')], notes: 'felt easy' })],
      { ...opts, togetherMode: true },
    );
    expect(built.exercises[0].sets[0].weight).toBe(225);
    expect(built.exercisesOther[0].sets[0].weight).toBe(245);
    expect(built.notesToSave.map((n) => n.user)).toEqual(['Diego', 'Kevin']);
  });

  it('when editing an old workout, notes stay on the workout only', () => {
    const built = buildFromDraft(
      [exercise({ name: 'Deadlift', sets: [set('5', '225')], notes: 'grip slipped', sessionNotes: ['ignored'] })],
      { ...opts, withSavedNotes: false },
    );
    expect(built.exercises[0].notes).toBe('grip slipped');
    expect(built.notesToSave).toEqual([]);
  });

  it('a "type your own" exercise with no category is remembered as Other', () => {
    const built = buildFromDraft(
      [exercise({ name: OTHER_VALUE, customName: 'Yoke Walk', sets: [set('1', '300')] })],
      opts,
    );
    expect(built.toRegister).toEqual([{ name: 'Yoke Walk', category: 'Other' }]);
  });

  it('turns the plan editor back into plan exercises', () => {
    expect(
      draftToTemplateExercises([
        exercise({ name: 'Deadlift', sets: makeSets(3), targetReps: '5' }),
        exercise({}),
        exercise({ name: OTHER_VALUE, customName: 'Yoke Walk', sets: makeSets(2) }),
      ]),
    ).toEqual([
      { name: 'Deadlift', sets: 3, reps: '5' },
      { name: 'Yoke Walk', sets: 2, reps: undefined },
    ]);
  });
});

describe('labels', () => {
  it('colours an exercise by its category', () => {
    expect(resolveCategory(exercise({}), toCategory)).toBeNull();
    expect(resolveCategory(exercise({ name: 'Deadlift' }), toCategory)?.label).toBe('Back');
    expect(resolveCategory(exercise({ name: OTHER_VALUE }), toCategory)?.label).toBe('Other');
    expect(resolveCategory(exercise({ name: OTHER_VALUE, customCategory: 'Cardio' }), toCategory)?.label).toBe('Cardio');
    expect(resolveCategory(exercise({ name: 'Gone From List' }), toCategory)?.label).toBe('Other');
  });

  it('summarises the last workout', () => {
    expect(
      lastWorkoutSummary(
        { name: 'Deadlift', notes: '', sets: [{ reps: 5, weight: 225, time: 0, intensity: 0 }, { reps: 0, weight: 0, time: 0, intensity: 0 }] },
        false,
      ),
    ).toBe('5×225lbs');
    expect(
      lastWorkoutSummary({ name: 'Treadmill', notes: '', sets: [{ reps: 0, weight: 0, time: 10, intensity: 3 }] }, true),
    ).toBe('10min @ 3/10');
    expect(lastWorkoutSummary(undefined, false)).toBe('');
  });
});
