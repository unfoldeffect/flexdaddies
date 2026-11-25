import { buildSampleData } from '../data/sample-data';
import { describeBackup, isEmptyDb, mergeDb, planSync, type SyncMeta } from '../lib/backup';
import { EMPTY_DB, type Db } from '../lib/types';

const full = buildSampleData(new Date(2026, 10, 9));
const meta = (over: Partial<SyncMeta> = {}): SyncMeta => ({ accountId: 'a1', rev: 3, dirty: false, ...over });
const plan = (m: SyncMeta | null, local: Db, rev: number, data: Db | null, accountId = 'a1') =>
  planSync({ meta: m, accountId, local, server: { rev, data } });

describe('deciding what a phone does with the saved copy', () => {
  it('a brand new customer with nothing anywhere does nothing', () => {
    expect(plan(null, EMPTY_DB, 0, null)).toBe('none');
  });
  it('the first save sends the phone up', () => {
    expect(plan(null, full, 0, null)).toBe('push');
  });
  it('a new phone takes the saved copy', () => {
    expect(plan(null, EMPTY_DB, 4, full)).toBe('take');
  });
  it('a phone with its own entries joins them with the saved copy', () => {
    expect(plan(null, full, 4, full)).toBe('merge');
  });
  it('nothing changed anywhere: nothing to do', () => {
    expect(plan(meta(), full, 3, full)).toBe('none');
  });
  it('a change on this phone is sent up', () => {
    expect(plan(meta({ dirty: true }), full, 3, full)).toBe('push');
  });
  it('a change on another phone is taken', () => {
    expect(plan(meta(), full, 4, full)).toBe('take');
  });
  it('changes on both phones are joined', () => {
    expect(plan(meta({ dirty: true }), full, 4, full)).toBe('merge');
  });
  it("another account's data is never mixed in", () => {
    expect(plan(meta({ accountId: 'someone-else', dirty: true }), full, 2, full)).toBe('take');
    expect(plan(meta({ accountId: 'someone-else' }), full, 0, null)).toBe('clear');
  });
});

describe('joining two copies', () => {
  const one = (id: string, date: string) => ({ ...full.workouts[0], id, date });
  it('keeps every entry from both, once', () => {
    const mine = { ...EMPTY_DB, workouts: [one('a', '2026-11-01'), one('b', '2026-11-02')] };
    const theirs = { ...EMPTY_DB, workouts: [one('b', '2026-11-02'), one('c', '2026-11-03')], templates: full.templates };
    const joined = mergeDb(mine, theirs);
    expect(joined.workouts.map((w) => w.id)).toEqual(['a', 'b', 'c']);
    expect(joined.templates).toHaveLength(full.templates.length);
  });
  it("this phone's version wins where both changed the same entry", () => {
    const joined = mergeDb(
      { ...EMPTY_DB, workouts: [one('a', '2026-11-05')] },
      { ...EMPTY_DB, workouts: [one('a', '2026-11-01')] },
    );
    expect(joined.workouts).toHaveLength(1);
    expect(joined.workouts[0].date).toBe('2026-11-05');
  });
  it('joins the exercise list by name, whatever the capitals', () => {
    const joined = mergeDb(
      { ...EMPTY_DB, customExercises: [{ name: 'Sled Push', category: 'Legs' }] },
      { ...EMPTY_DB, customExercises: [{ name: 'sled push', category: 'Other' }, { name: 'Yoke Walk', category: 'Legs' }] },
    );
    expect(joined.customExercises.map((c) => c.name)).toEqual(['Sled Push', 'Yoke Walk']);
  });
  it('joining a copy with itself changes nothing', () => {
    expect(mergeDb(full, full)).toEqual(full);
    expect(isEmptyDb(mergeDb(EMPTY_DB, EMPTY_DB))).toBe(true);
  });
});

describe('the backup line in Settings', () => {
  it('says where things stand in plain words', () => {
    expect(describeBackup({ state: 'saved', at: 1000 }, 1000 + 20_000)).toBe('Saved to your account just now.');
    expect(describeBackup({ state: 'saved', at: 0 }, 5 * 60_000)).toBe('Saved to your account 5 min ago.');
    expect(describeBackup({ state: 'waiting' })).toMatch(/try again/);
  });
});
