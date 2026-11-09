// The arithmetic behind drag-to-reorder, kept free of any screen code so it
// can be tested on its own.

export type Rect = { y: number; height: number };

/** Returns a copy of the list with the item at `from` moved to position `to`. */
export function moveToIndex<T>(list: T[], from: number, to: number): T[] {
  if (from === to || from < 0 || to < 0 || from >= list.length || to >= list.length) {
    return list;
  }
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

/**
 * Where the card picked up at `from` would land for a finger at `pointerY`.
 * It passes a neighbour once the finger crosses that neighbour's middle (the
 * same rule as the website). `rects` are the cards' resting positions.
 */
export function dropIndex(rects: Rect[], from: number, pointerY: number): number {
  if (from < 0 || from >= rects.length) return from;
  let to = from;
  for (let j = from + 1; j < rects.length; j++) {
    if (pointerY > rects[j].y + rects[j].height / 2) to = j;
    else break;
  }
  if (to !== from) return to;
  for (let j = from - 1; j >= 0; j--) {
    if (pointerY < rects[j].y + rects[j].height / 2) to = j;
    else break;
  }
  return to;
}

/**
 * Where to draw the line that shows the landing spot, measured from the top
 * of the list. Each card's height here includes the `gap` beneath it.
 */
export function insertionLineY(rects: Rect[], from: number, to: number, gap: number): number {
  const target = rects[to];
  if (!target) return 0;
  // Moving up: the line sits above the target card. Moving down: below it.
  return to < from ? target.y - gap / 2 : target.y + target.height - gap / 2;
}

/** Speed (points per frame) to scroll while a dragged card is held near an edge; 0 otherwise. */
export function edgeScrollSpeed(
  pointerY: number,
  viewportTop: number,
  viewportBottom: number,
  edge = 80,
  maxSpeed = 16,
): number {
  if (pointerY < viewportTop + edge) {
    const depth = Math.min(1, (viewportTop + edge - pointerY) / edge);
    return -Math.max(4, maxSpeed * depth);
  }
  if (pointerY > viewportBottom - edge) {
    const depth = Math.min(1, (pointerY - (viewportBottom - edge)) / edge);
    return Math.max(4, maxSpeed * depth);
  }
  return 0;
}
