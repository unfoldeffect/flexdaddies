import { plural, possessive } from '../lib/words';

it('writes possessives the AP way', () => {
  expect(possessive('Mike')).toBe("Mike's");
  expect(possessive('Teters')).toBe("Teters'");
  expect(possessive('Chris')).toBe("Chris'");
});

it('says 1 exercise, not 1 exercises', () => {
  expect(plural(1, 'exercise')).toBe('1 exercise');
  expect(plural(3, 'exercise')).toBe('3 exercises');
  expect(plural(1, 'set')).toBe('1 set');
});
