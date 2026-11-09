import { describe, expect, it } from "vitest";

import {
  applyOrderToPlan,
  dragStepDelta,
  moveItem,
  parseWeight,
  sameExerciseOrder,
  sanitizeWeightInput,
  templateLinkFromRow,
} from "../workout-helpers";

describe("reordering exercises", () => {
  const list = ["Bench", "Row", "Curl"];

  it("moves an item up or down by one", () => {
    expect(moveItem(list, 2, -1)).toEqual(["Bench", "Curl", "Row"]);
    expect(moveItem(list, 0, 1)).toEqual(["Row", "Bench", "Curl"]);
  });

  it("leaves the list alone at the ends and for bad indexes", () => {
    expect(moveItem(list, 0, -1)).toBe(list);
    expect(moveItem(list, 2, 1)).toBe(list);
    expect(moveItem(list, -1, 1)).toBe(list);
  });

  it("never changes the original list", () => {
    moveItem(list, 1, 1);
    expect(list).toEqual(["Bench", "Row", "Curl"]);
  });

  describe("dragStepDelta", () => {
    // Three stacked cards: 0-100, 100-300, 300-400.
    const rects = [
      { top: 0, height: 100 },
      { top: 100, height: 200 },
      { top: 300, height: 100 },
    ];

    it("stays put while the pointer is between the neighbours' middles", () => {
      expect(dragStepDelta(rects, 1, 60)).toBe(0);
      expect(dragStepDelta(rects, 1, 340)).toBe(0);
    });

    it("moves up past the middle of the card above", () => {
      expect(dragStepDelta(rects, 1, 40)).toBe(-1);
    });

    it("moves down past the middle of the card below", () => {
      expect(dragStepDelta(rects, 1, 360)).toBe(1);
    });

    it("cannot move past the first or last position", () => {
      expect(dragStepDelta(rects, 0, -500)).toBe(0);
      expect(dragStepDelta(rects, 2, 5000)).toBe(0);
    });
  });

  describe("saving a workout's order to its plan", () => {
    const plan = [
      { name: "Bench", sets: 3, reps: "8-10" },
      { name: "Row", sets: 3 },
      { name: "Curl", sets: 2 },
    ];

    it("re-sorts the plan and keeps each exercise's sets and reps", () => {
      expect(applyOrderToPlan(plan, ["Curl", "Bench", "Row"])).toEqual([
        { name: "Curl", sets: 2 },
        { name: "Bench", sets: 3, reps: "8-10" },
        { name: "Row", sets: 3 },
      ]);
    });

    it("does not add exercises that were only added to the workout", () => {
      const result = applyOrderToPlan(plan, ["Row", "Squat", "Bench", "Curl"]);
      expect(result.map((e) => e.name)).toEqual(["Row", "Bench", "Curl"]);
    });

    it("keeps exercises that were removed from the workout", () => {
      const result = applyOrderToPlan(plan, ["Curl", "Bench"]);
      expect(result.map((e) => e.name)).toEqual(["Curl", "Bench", "Row"]);
    });

    it("handles the same exercise appearing twice", () => {
      const doubled = [
        { name: "Bench", sets: 3 },
        { name: "Row", sets: 3 },
        { name: "Bench", sets: 1 },
      ];
      expect(applyOrderToPlan(doubled, ["Row", "Bench", "Bench"])).toEqual([
        { name: "Row", sets: 3 },
        { name: "Bench", sets: 3 },
        { name: "Bench", sets: 1 },
      ]);
    });

    it("does not change the saved plan itself", () => {
      const before = JSON.stringify(plan);
      applyOrderToPlan(plan, ["Curl", "Row", "Bench"]);
      expect(JSON.stringify(plan)).toBe(before);
    });

    it("detects whether the order changed", () => {
      expect(sameExerciseOrder(plan, applyOrderToPlan(plan, ["Bench", "Row", "Curl"]))).toBe(true);
      expect(sameExerciseOrder(plan, applyOrderToPlan(plan, ["Row", "Bench", "Curl"]))).toBe(false);
    });
  });
});

describe("plan label on history entries", () => {
  it("returns the plan id and the name saved with the workout", () => {
    expect(templateLinkFromRow("preset-upper-a", "1 - Upper A")).toEqual({
      id: "preset-upper-a",
      name: "1 - Upper A",
    });
  });

  it("gives no label to workouts logged from scratch or before plans were tracked", () => {
    expect(templateLinkFromRow(null, null)).toBeNull();
    expect(templateLinkFromRow(undefined, undefined)).toBeNull();
  });

  it("does not guess when only half of the link is stored", () => {
    expect(templateLinkFromRow("preset-upper-a", null)).toBeNull();
    expect(templateLinkFromRow(null, "Upper A")).toBeNull();
    expect(templateLinkFromRow("", "")).toBeNull();
  });
});

describe("decimal weights", () => {
  it("accepts whole and decimal numbers as typed", () => {
    for (const v of ["22.5", "135.25", "0.5", "135", "0", ".5", "45.", ""]) {
      expect(sanitizeWeightInput(v, "")).toBe(v);
    }
  });

  it("rejects a second decimal point by keeping the previous value", () => {
    expect(sanitizeWeightInput("22.5.", "22.5")).toBe("22.5");
    expect(sanitizeWeightInput("1..2", "1.")).toBe("1.");
  });

  it("rejects negative numbers, letters and symbols", () => {
    expect(sanitizeWeightInput("-", "")).toBe("");
    expect(sanitizeWeightInput("-22.5", "22.5")).toBe("22.5");
    expect(sanitizeWeightInput("22a", "22")).toBe("22");
    expect(sanitizeWeightInput("1e3", "1")).toBe("1");
    expect(sanitizeWeightInput("2 2", "2")).toBe("2");
  });

  it("treats a comma from a phone keypad as the decimal point", () => {
    expect(sanitizeWeightInput("22,5", "22")).toBe("22.5");
    expect(sanitizeWeightInput("22.5,", "22.5")).toBe("22.5");
  });

  it("parses the stored number without rounding", () => {
    expect(parseWeight("22.5")).toBe(22.5);
    expect(parseWeight("135.25")).toBe(135.25);
    expect(parseWeight("0.5")).toBe(0.5);
    expect(parseWeight(".5")).toBe(0.5);
    expect(parseWeight("45.")).toBe(45);
  });

  it("still handles whole numbers", () => {
    expect(parseWeight("135")).toBe(135);
    expect(parseWeight("0")).toBe(0);
  });

  it("never stores a negative or invalid weight", () => {
    expect(parseWeight("")).toBe(0);
    expect(parseWeight(".")).toBe(0);
    expect(parseWeight("-5")).toBe(0);
    expect(parseWeight("abc")).toBe(0);
    expect(parseWeight("1.2.3")).toBe(0);
  });

  it("shows saved weights the same way after loading them back", () => {
    for (const n of [22.5, 135.25, 0.5, 135]) {
      expect(parseWeight(sanitizeWeightInput(String(n), ""))).toBe(n);
      expect(String(n)).not.toMatch(/e|,/);
    }
  });
});
