import { describe, expect, it } from "vitest";
import { pathSegments } from "./arena";

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
