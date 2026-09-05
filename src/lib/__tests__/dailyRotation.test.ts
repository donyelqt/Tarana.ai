import { rotateByDay } from "@/lib/utils/dailyRotation";

describe("rotateByDay", () => {
  const names = Array.from({ length: 20 }, (_, i) => `Place ${i}`);

  it("returns empty/singleton untouched", () => {
    expect(rotateByDay([], 5)).toEqual([]);
    expect(rotateByDay(["Only"], 5)).toEqual(["Only"]);
  });

  it("is deterministic for the same day", () => {
    expect(rotateByDay(names, 20341)).toEqual(rotateByDay(names, 20341));
  });

  it("rotates by exactly the day offset", () => {
    const base = rotateByDay(names, 0);
    expect(base).toEqual(names);
    const next = rotateByDay(names, 1);
    expect(next[0]).toBe("Place 1");
    expect(next).toHaveLength(20);
    expect(next[19]).toBe("Place 0");
  });

  it("always returns a permutation (no drops, no dupes)", () => {
    for (const day of [0, 1, 7, 19, 20, 21, 40933]) {
      expect([...rotateByDay(names, day)].sort()).toEqual([...names].sort());
    }
  });

  it("wraps around the list length", () => {
    expect(rotateByDay(names, 20)).toEqual(names);
    expect(rotateByDay(names, 22)[0]).toBe("Place 2");
  });

  it("Manila scenario: consecutive-day heads of 12 differ, both from the top band", () => {
    const dayA = 20341;
    const headA = rotateByDay(names, dayA).slice(0, 12);
    const headB = rotateByDay(names, dayA + 1).slice(0, 12);
    expect(headA[0]).not.toBe(headB[0]);
    expect(headA).toHaveLength(12);
    expect(headB).toHaveLength(12);
    for (const n of [...headA, ...headB]) {
      expect(names).toContain(n);
    }
  });
});
