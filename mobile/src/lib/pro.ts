// What the free version includes, and what Pro adds.

/** Saved plans in the free version. Pro has no limit. */
export const FREE_PLAN_LIMIT = 3;

export function canSavePlan(savedPlans: number, pro: boolean): boolean {
  return pro || savedPlans < FREE_PLAN_LIMIT;
}

export const PLAN_LIMIT_TITLE = `The free version keeps ${FREE_PLAN_LIMIT} saved routines`;
export const PLAN_LIMIT_MESSAGE =
  'Delete a routine to save a new one, or go Pro for as many routines as you want.';

/**
 * Pro prices (Diego, Nov. 26, 2026). The first month is $0.99 (an Apple
 * introductory offer on the monthly plan), then $2.99 a month; or $25.99 a
 * year. No lifetime option. Once in-app purchase is wired, the App Store's own
 * prices (in the buyer's currency) replace these on screen.
 */
export const PRO_PRICES = {
  introMonth: 0.99,
  monthly: 2.99,
  yearly: 25.99,
} as const;

export function money(amount: number): string {
  return `$${amount.toFixed(2)}`;
}

/** What a year costs per month, rounded to the cent. */
export function yearlyPerMonth(yearly = PRO_PRICES.yearly): number {
  return Math.round((yearly / 12) * 100) / 100;
}

/** How much the yearly plan saves against 12 monthly payments, rounded down to a whole percent. */
export function yearlySavingPercent(
  monthly: number = PRO_PRICES.monthly,
  yearly: number = PRO_PRICES.yearly,
): number {
  return Math.floor((1 - yearly / (monthly * 12)) * 100);
}

export type ProPlan = 'monthly' | 'yearly';

/** What Pro adds, in the order the Go Pro screen lists it. Free keeps everything else. */
export const PRO_FEATURES: { icon: string; title: string; detail: string }[] = [
  {
    icon: 'playlist-plus',
    title: 'Unlimited routines',
    detail: `Save as many routines as you want. Free keeps ${FREE_PLAN_LIMIT}.`,
  },
  {
    icon: 'chart-line',
    title: 'Your whole history on every chart',
    detail: '1 month, 1 year and all time. Free shows the last 3 months.',
  },
  {
    icon: 'arm-flex-outline',
    title: 'Estimated one-rep max',
    detail: 'Worked out from your sets and charted over time.',
  },
  {
    icon: 'chart-bar',
    title: 'Sets by body part',
    detail: 'Each week, next to your usual week.',
  },
  {
    icon: 'calendar-check-outline',
    title: 'Consistency',
    detail: 'Weeks in a row, workouts a week and your last 12 weeks.',
  },
  {
    icon: 'account-multiple-outline',
    title: 'Partner sync',
    detail: "A session you log together shows up on your partner's phone too.",
  },
];

export const FREE_SUMMARY = `Free: unlimited logging, your full history and ${FREE_PLAN_LIMIT} saved routines.`;

export const PRO_CHARTS_TITLE = 'Part of Pro';
export const PRO_RANGE_MESSAGE =
  'The free version shows the last 3 months. Pro shows 1 month, 1 year and your whole history.';
export const PRO_MAX_MESSAGE =
  'Pro works out your estimated one-rep max from your sets and charts it over time.';
