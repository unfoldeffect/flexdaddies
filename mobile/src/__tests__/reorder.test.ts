import { dropIndex, edgeScrollSpeed, insertionLineY, moveToIndex, type Rect } from '../lib/reorder';

// Three cards, 100 tall each (the height includes a 16-point gap underneath).
const rects: Rect[] = [
  { y: 0, height: 100 },
  { y: 100, height: 100 },
  { y: 200, height: 100 },
];

describe('moveToIndex', () => {
  const list = ['Bench', 'Row', 'Curl', 'Squat'];

  it('moves an item down or up to any position', () => {
    expect(moveToIndex(list, 0, 2)).toEqual(['Row', 'Curl', 'Bench', 'Squat']);
    expect(moveToIndex(list, 3, 0)).toEqual(['Squat', 'Bench', 'Row', 'Curl']);
  });

  it('leaves the list alone for a no-op or a bad index', () => {
    expect(moveToIndex(list, 1, 1)).toBe(list);
    expect(moveToIndex(list, -1, 2)).toBe(list);
    expect(moveToIndex(list, 1, 9)).toBe(list);
  });

  it('never changes the original list', () => {
    moveToIndex(list, 0, 3);
    expect(list).toEqual(['Bench', 'Row', 'Curl', 'Squat']);
  });
});

describe('dropIndex', () => {
  it('stays put until the finger crosses a neighbour’s middle', () => {
    expect(dropIndex(rects, 0, 30)).toBe(0);
    expect(dropIndex(rects, 0, 149)).toBe(0);
    expect(dropIndex(rects, 1, 60)).toBe(1);
  });

  it('moves down past each card whose middle is crossed', () => {
    expect(dropIndex(rects, 0, 151)).toBe(1);
    expect(dropIndex(rects, 0, 251)).toBe(2);
    expect(dropIndex(rects, 0, 9999)).toBe(2);
  });

  it('moves up past each card whose middle is crossed', () => {
    expect(dropIndex(rects, 2, 149)).toBe(1);
    expect(dropIndex(rects, 2, 49)).toBe(0);
    expect(dropIndex(rects, 2, -500)).toBe(0);
  });

  it('copes with a bad starting index', () => {
    expect(dropIndex(rects, 7, 50)).toBe(7);
  });
});

describe('insertionLineY', () => {
  it('sits in the gap below the target when moving down', () => {
    expect(insertionLineY(rects, 0, 1, 16)).toBe(192);
    expect(insertionLineY(rects, 0, 2, 16)).toBe(292);
  });

  it('sits in the gap above the target when moving up', () => {
    expect(insertionLineY(rects, 2, 1, 16)).toBe(92);
    expect(insertionLineY(rects, 2, 0, 16)).toBe(-8);
  });
});

describe('edgeScrollSpeed', () => {
  it('does nothing in the middle of the screen', () => {
    expect(edgeScrollSpeed(400, 100, 700)).toBe(0);
  });

  it('scrolls up near the top and down near the bottom, faster the closer to the edge', () => {
    expect(edgeScrollSpeed(170, 100, 700)).toBeLessThan(0);
    expect(edgeScrollSpeed(640, 100, 700)).toBeGreaterThan(0);
    expect(Math.abs(edgeScrollSpeed(105, 100, 700))).toBeGreaterThan(
      Math.abs(edgeScrollSpeed(170, 100, 700)),
    );
    expect(edgeScrollSpeed(900, 100, 700)).toBe(16);
  });
});
