// What the free version includes, and what Pro adds.

/** Saved plans in the free version. Pro has no limit. */
export const FREE_PLAN_LIMIT = 3;

export function canSavePlan(savedPlans: number, pro: boolean): boolean {
  return pro || savedPlans < FREE_PLAN_LIMIT;
}

export const PLAN_LIMIT_TITLE = `The free version keeps ${FREE_PLAN_LIMIT} saved routines`;
export const PLAN_LIMIT_MESSAGE =
  'Delete a routine to save a new one, or go Pro for as many routines as you want.';

export const PRO_CHARTS_TITLE = 'Part of Pro';
export const PRO_RANGE_MESSAGE =
  'The free version shows the last 3 months. Pro shows 1 month, 1 year and your whole history.';
export const PRO_MAX_MESSAGE =
  'Pro works out your estimated one-rep max from your sets and charts it over time.';
