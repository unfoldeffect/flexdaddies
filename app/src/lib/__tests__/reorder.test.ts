import { describe, expect, it } from "vitest";

import { parseRestSeconds, restLabel } from "../prefs";
import { dropIndex, edgeScrollSpeed, insertionLineY } from "../reorder";

// Three cards 100 tall with a 10 gap: 0-100, 110-210, 220-320.
const rects = [0, 110, 220].map((y) => ({ y, height: 100 }));

describe("dropIndex", () => {
  it("stays put until the finger crosses a neighbour's middle", () => {
    expect(dropIndex(rects, 0, 50)).toBe(0);
    expect(dropIndex(rects, 0, 159)).toBe(0);
    expect(dropIndex(rects, 1, 60)).toBe(1);
  });
  it("moves down past one or several cards", () => {
    expect(dropIndex(rects, 0, 161)).toBe(1);
    expect(dropIndex(rects, 0, 300)).toBe(2);
  });
  it("moves up past one or several cards", () => {
    expect(dropIndex(rects, 2, 159)).toBe(1);
    expect(dropIndex(rects, 2, 10)).toBe(0);
  });
  it("ignores a bad index", () => {
    expect(dropIndex(rects, 5, 10)).toBe(5);
  });
});

describe("insertionLineY", () => {
  it("sits in the gap above the target when moving up, below when moving down", () => {
    expect(insertionLineY(rects, 2, 0, 10)).toBe(-5);
    expect(insertionLineY(rects, 2, 1, 10)).toBe(105);
    expect(insertionLineY(rects, 0, 1, 10)).toBe(215);
    expect(insertionLineY(rects, 0, 2, 10)).toBe(325);
  });
});

describe("edgeScrollSpeed", () => {
  it("scrolls only near the edges", () => {
    expect(edgeScrollSpeed(400, 0, 800)).toBe(0);
    expect(edgeScrollSpeed(10, 0, 800)).toBeLessThan(0);
    expect(edgeScrollSpeed(790, 0, 800)).toBeGreaterThan(0);
  });
});

describe("rest timer settings", () => {
  it("falls back to 60 seconds for anything that is not a choice", () => {
    expect(parseRestSeconds(null)).toBe(60);
    expect(parseRestSeconds("75")).toBe(60);
    expect(parseRestSeconds("abc")).toBe(60);
    expect(parseRestSeconds("90")).toBe(90);
  });
  it("labels the choices", () => {
    expect([30, 45, 60, 90, 120].map(restLabel)).toEqual(["30s", "45s", "1 min", "90s", "2 min"]);
  });
});
