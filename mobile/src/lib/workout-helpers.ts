// Small pure helpers for the workout log (reordering, weight input, plan
// labels). Kept free of React and server imports so they can be unit tested.

/** Returns a copy of the list with the item at `index` shifted by `delta` (-1 up, +1 down). */
export function moveItem<T>(list: T[], index: number, delta: -1 | 1): T[] {
  const target = index + delta;
  if (index < 0 || index >= list.length || target < 0 || target >= list.length) return list;
  const next = [...list];
  [next[index], next[target]] = [next[target], next[index]];
  return next;
}

/**
 * While dragging the card at `index`, decides whether it should swap with a
 * neighbour: up once the pointer is above the previous card's middle, down
 * once it is below the next card's middle. Returns 0 to stay put.
 */
export function dragStepDelta(
  rects: { top: number; height: number }[],
  index: number,
  pointerY: number,
): -1 | 0 | 1 {
  if (index < 0 || index >= rects.length) return 0;
  const prev = rects[index - 1];
  if (prev && pointerY < prev.top + prev.height / 2) return -1;
  const next = rects[index + 1];
  if (next && pointerY > next.top + next.height / 2) return 1;
  return 0;
}

/**
 * Re-sorts a plan's exercises to follow `orderedNames` (the order used in the
 * workout in progress). Only the order changes: exercises are never added or
 * removed, and any the workout no longer contains keep their place at the end.
 */
export function applyOrderToPlan<T extends { name: string }>(
  planExercises: T[],
  orderedNames: string[],
): T[] {
  const remaining = [...planExercises];
  const ordered: T[] = [];
  for (const name of orderedNames) {
    const i = remaining.findIndex((ex) => ex.name === name);
    if (i >= 0) ordered.push(...remaining.splice(i, 1));
  }
  return [...ordered, ...remaining];
}

export function sameExerciseOrder(a: { name: string }[], b: { name: string }[]): boolean {
  return a.length === b.length && a.every((ex, i) => ex.name === b[i].name);
}

/**
 * Filters typing in a weight box. Accepts digits with at most one decimal
 * point ("22.5", "0.5", ".5", "135."); anything else — a minus sign, letters,
 * a second decimal point — is rejected by returning the previous value. A
 * comma is treated as the decimal point, since some phone keypads show one.
 */
export function sanitizeWeightInput(raw: string, previous: string): string {
  const value = raw.replace(",", ".");
  return /^\d*\.?\d*$/.test(value) ? value : previous;
}

/** Turns the text in a weight box into the number that gets stored (blank or invalid = 0). */
export function parseWeight(value: string): number {
  if (!/^\d*\.?\d*$/.test(value)) return 0;
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

/**
 * The plan label for a stored workout. Workouts logged from scratch, and older
 * ones saved before plans were tracked, have no link and get no label.
 */
export function templateLinkFromRow(
  templateId: string | null | undefined,
  templateName: string | null | undefined,
): { id: string; name: string } | null {
  return templateId && templateName ? { id: templateId, name: templateName } : null;
}
