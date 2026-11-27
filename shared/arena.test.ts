import { describe, expect, it } from "vitest";
import { nearestSeat, pathSegments } from "./arena";

describe("pathSegments", () => {
  it("reads lines, relative and absolute, and closes subpaths", () => {
    expect(pathSegments("m10 20h5v5M0 0l2 2 3 0z")).toEqual([
      [10, 20, 15, 20],
      [15, 20, 15, 25],
      [0, 0, 2, 2],
      [2, 2, 5, 2],
      [5, 2, 0, 0],
    ]);
  });

  it("takes a curve as the line between its ends", () => {
    expect(pathSegments("m0 0c1 0 2 1 2 2")).toEqual([[0, 0, 2, 2]]);
  });
});

describe("nearestSeat", () => {
  // Two seats in a row, 14 × 16, 17 apart.
  const seats = [100, 200, 14, 16, 0, 117, 200, 14, 16, 0];

  it("takes the centre of the nearest seat", () => {
    expect(nearestSeat(seats, 104, 203)).toEqual({ x: 100, y: 200 });
    expect(nearestSeat(seats, 110, 195)).toEqual({ x: 117, y: 200 });
  });

  it("leaves a point more than a seat away from any", () => {
    expect(nearestSeat(seats, 100, 220)).toBeNull();
    expect(nearestSeat([], 100, 200)).toBeNull();
  });
});
