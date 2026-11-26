// What the free version includes, and what Pro adds.

/** Saved plans in the free version. Pro has no limit. */
export const FREE_PLAN_LIMIT = 3;

export function canSavePlan(savedPlans: number, pro: boolean): boolean {
  return pro || savedPlans < FREE_PLAN_LIMIT;
}

export const PLAN_LIMIT_TITLE = `The free version keeps ${FREE_PLAN_LIMIT} saved routines`;
export const PLAN_LIMIT_MESSAGE =
  'Delete a routine to save a new one, or go Pro for as many routines as you want.';
