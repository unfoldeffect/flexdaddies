import { isTestBuild } from '../lib/build';
import {
  FREE_PLAN_LIMIT,
  PRO_FEATURES,
  PRO_PRICES,
  canSavePlan,
  money,
  yearlyPerMonth,
  yearlySavingPercent,
} from '../lib/pro';

describe('Pro prices', () => {
  it('match what Diego set on Nov. 26, 2026', () => {
    expect(PRO_PRICES).toEqual({ introMonth: 0.99, monthly: 2.99, yearly: 25.99 });
    expect(PRO_PRICES).not.toHaveProperty('lifetime');
  });

  it('show as dollars and cents', () => {
    expect(money(0.99)).toBe('$0.99');
    expect(money(25.99)).toBe('$25.99');
  });

  it('work out the yearly plan per month and the saving', () => {
    expect(yearlyPerMonth()).toBe(2.17); // 25.99 / 12 = 2.1658
    expect(yearlySavingPercent()).toBe(27); // 1 - 25.99 / 35.88 = 27.6%, rounded down
  });
});

describe('free and Pro', () => {
  it('keeps 3 routines free', () => {
    expect(FREE_PLAN_LIMIT).toBe(3);
    expect(canSavePlan(2, false)).toBe(true);
    expect(canSavePlan(3, false)).toBe(false);
    expect(canSavePlan(50, true)).toBe(true);
  });

  it('lists the six things Pro adds', () => {
    expect(PRO_FEATURES.map((f) => f.title)).toEqual([
      'Unlimited routines',
      'Your whole history on every chart',
      'Estimated one-rep max',
      'Sets by body part',
      'Consistency',
      'Partner sync',
    ]);
  });
});

describe('test tools', () => {
  it('show while developing or in a build marked as a test build', () => {
    expect(isTestBuild(true, undefined)).toBe(true);
    expect(isTestBuild(false, '1')).toBe(true);
  });

  it('are hidden in the App Store build', () => {
    expect(isTestBuild(false, undefined)).toBe(false);
    expect(isTestBuild(false, '')).toBe(false);
    expect(isTestBuild(false, '0')).toBe(false);
  });
});
