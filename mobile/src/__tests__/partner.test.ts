import { addReceived, receiveSession, toShare } from '../lib/partner';
import { EMPTY_DB, type Workout } from '../lib/types';

const workout = (id: string, user: Workout['user'], weight: number): Workout => ({
  id,
  user,
  date: '2026-11-25',
  exercises: [{ name: 'Bench Press', equipment: 'Barbell', sets: [{ reps: 5, weight, time: 0, intensity: 0 }], notes: '' }],
  notes: '',
  loggedAt: '2026-11-25T18:00:00.000Z',
  template: { id: 't1', name: 'Upper A' },
});

describe('a session logged for both people', () => {
  const sent = toShare(workout('w-sam', 'me', 185), workout('w-kim', 'partner', 135));

  it('swaps places on the partner\'s phone: their sets are theirs, the sender is the partner', () => {
    const [mine, partners] = receiveSession(sent);
    expect([mine.id, mine.user, mine.exercises[0].sets[0].weight]).toEqual(['w-kim', 'me', 135]);
    expect([partners.id, partners.user, partners.exercises[0].sets[0].weight]).toEqual(['w-sam', 'partner', 185]);
    expect(mine.template).toBeNull();
  });

  it('is added once, however many times it arrives', () => {
    const once = addReceived(EMPTY_DB, [sent]);
    expect(once.workouts).toHaveLength(2);
    const twice = addReceived(once, [sent, sent]);
    expect(twice).toBe(once);
  });

  it('ignores anything that is not a session', () => {
    expect(receiveSession(null)).toEqual([]);
    expect(receiveSession({ id: 'x', mine: {}, theirs: {} })).toEqual([]);
    expect(addReceived(EMPTY_DB, ['junk', 42])).toBe(EMPTY_DB);
  });
});
