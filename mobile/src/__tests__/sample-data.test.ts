import {
  STARTER_PLANS,
  buildSampleData,
  hasSampleData,
  removeSampleData,
  withoutPartner,
} from '../data/sample-data';
import * as storage from '../data/storage';
import { DEFAULT_PREFS, normalizeDb, normalizePrefs } from '../data/storage';
import { EMPTY_DB } from '../lib/types';
import { EXERCISE_TO_CATEGORY } from '../lib/workout-data';

const today = new Date(2026, 10, 9, 15);

describe('sample data', () => {
  const db = buildSampleData(today);

  it('only uses exercises that are on the list', () => {
    for (const plan of STARTER_PLANS) {
      for (const ex of plan.exercises) expect(EXERCISE_TO_CATEGORY[ex.name]).toBeDefined();
    }
  });

  it('has workouts for both people, none in the future, all labelled with their plan', () => {
    expect(db.workouts.some((w) => w.user === 'me')).toBe(true);
    expect(db.workouts.some((w) => w.user === 'partner')).toBe(true);
    expect(db.workouts.every((w) => w.date <= '2026-11-09')).toBe(true);
    expect(db.workouts.every((w) => !!w.template && w.exercises.length > 0)).toBe(true);
    expect(new Set(db.workouts.map((w) => w.id)).size).toBe(db.workouts.length);
  });

  it('is the same every time for the same day', () => {
    expect(buildSampleData(today)).toEqual(db);
  });

  it('can be removed without touching plans or anything logged on the phone', () => {
    const mine = {
      id: 'real-1',
      user: 'me' as const,
      date: '2026-11-09',
      exercises: [],
      notes: '',
      loggedAt: 'x',
    };
    const cleared = removeSampleData({ ...db, workouts: [mine, ...db.workouts] });
    expect(hasSampleData(db)).toBe(true);
    expect(hasSampleData(cleared)).toBe(false);
    expect(cleared.workouts).toEqual([mine]);
    expect(cleared.weighIns).toEqual([]);
    expect(cleared.templates).toEqual(STARTER_PLANS);
  });
});

describe('reading saved data', () => {
  it('treats nothing saved as a first launch', () => {
    expect(normalizeDb(null)).toBeNull();
    expect(normalizeDb('nonsense')).toBeNull();
  });

  it('fills in lists missing from older saved data', () => {
    expect(normalizeDb({ workouts: [{ id: 'w' }] })).toEqual({
      ...EMPTY_DB,
      workouts: [{ id: 'w' }],
    });
    expect(normalizeDb({ workouts: 'broken' })).toEqual(EMPTY_DB);
  });

  it('falls back to safe settings for anything unexpected', () => {
    expect(normalizePrefs(null)).toEqual(DEFAULT_PREFS);
    expect(
      normalizePrefs({
        user: 'Someone Else',
        weightUnit: 'stone',
        restSeconds: 7,
        restSound: false,
      }),
    ).toEqual({
      ...DEFAULT_PREFS,
      restSound: false,
    });
    expect(
      normalizePrefs({ user: 'Kevin', partnerOn: true, partnerName: 'Kim', weightUnit: 'kg', lengthUnit: 'cm', restSeconds: 90 }),
    ).toEqual({
      user: 'me',
      partnerOn: true,
      partnerName: 'Kim',
      weightUnit: 'kg',
      lengthUnit: 'cm',
      restSeconds: 90,
      restSound: true,
      theme: 'dark',
    });
  });
});

describe('saving to the phone', () => {
  it('reads back exactly what was saved', async () => {
    const db = buildSampleData(today);
    expect(await storage.loadDb()).toBeNull();
    expect(await storage.saveDb(db)).toBe(true);
    expect(await storage.loadDb()).toEqual(db);

    await storage.savePrefs({ ...DEFAULT_PREFS, partnerOn: true, partnerName: 'Kim', restSeconds: 45 });
    expect(await storage.loadPrefs()).toMatchObject({ user: 'me', partnerOn: true, partnerName: 'Kim', restSeconds: 45 });
  });

  it('keeps a separate unfinished workout per person', async () => {
    const draft = {
      date: '2026-11-09',
      exercises: [
        {
          id: 'e1',
          name: 'Deadlift',
          customName: '',
          customCategory: '',
          sets: [],
          setsOther: [],
          notes: '',
        },
      ],
      togetherMode: false,
      savedAt: '2026-11-09T12:00:00.000Z',
      template: null,
    };
    await storage.saveDraft('me', draft);
    expect(await storage.loadDraft('me')).toEqual(draft);
    expect(await storage.loadDraft('partner')).toBeNull();
    await storage.clearDraft('me');
    expect(await storage.loadDraft('me')).toBeNull();
  });
});

describe('one lifter, with a partner as an option', () => {
  it('a new customer has no partner switched on', () => {
    expect(DEFAULT_PREFS).toMatchObject({ user: 'me', partnerOn: false, partnerName: '' });
  });

  it("leaves the partner's entries out when no partner is switched on", () => {
    const db = withoutPartner(buildSampleData(today));
    expect(db.workouts.length).toBeGreaterThan(0);
    for (const list of [db.workouts, db.weighIns, db.measurements, db.exerciseNotes]) {
      expect(list.every((x) => x.user === 'me')).toBe(true);
    }
    expect(db.templates).toHaveLength(buildSampleData(today).templates.length);
  });

  it('carries over entries saved under the two names earlier test builds used', () => {
    const old = JSON.parse(
      JSON.stringify(buildSampleData(today)).replace(/"user":"me"/g, '"user":"Diego"').replace(/"user":"partner"/g, '"user":"Kevin"'),
    );
    expect(old.workouts.some((w: { user: string }) => w.user === 'Kevin')).toBe(true);
    expect(normalizeDb(old)).toEqual(buildSampleData(today));
  });
});
