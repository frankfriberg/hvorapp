import { describe, expect, it } from "vitest";
import { ARENAS } from "./api";
import { gridHeight, heightIn } from "./venue";
import brunstad from "./venues/brunstad";

describe("brunstad", () => {
  it("has a building for each arena, inside the venue", () => {
    for (const arena of ARENAS) {
      const buildings = brunstad.buildings.filter((b) => b.arena === arena);
      expect(buildings).toHaveLength(1);
      expect(buildings[0].venue).toBe(true);
    }
  });

  it("keeps the venue's buildings on the map by their middle, as x, y pairs", () => {
    for (const { ring, height, venue } of brunstad.buildings) {
      expect(ring.length % 2).toBe(0);
      expect(ring.length).toBeGreaterThanOrEqual(6);
      expect(height).toBeGreaterThan(0);
      if (!venue) continue;
      const xs = ring.filter((_, i) => i % 2 === 0);
      const ys = ring.filter((_, i) => i % 2 === 1);
      const x = xs.reduce((sum, v) => sum + v, 0) / xs.length;
      const y = ys.reduce((sum, v) => sum + v, 0) / ys.length;
      expect(x).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(brunstad.width);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(y).toBeLessThanOrEqual(brunstad.height);
    }
  });
});

describe("heightIn", () => {
  it("reads a grid among others as gridHeight reads it alone", () => {
    const grid = {
      x: 10,
      y: 20,
      step: 3,
      columns: 3,
      heights: [1, 2, 3, 4, 5, 6, 7, 8, 9],
    };
    const alone = gridHeight(grid);
    const heights = [0, 0, ...grid.heights];
    const places = [5, 5, 1, 1, 0, 2, 10, 20, 3, 3, 2, 9];
    for (const [x, y] of [
      [11, 21],
      [14, 25],
      [0, 0],
      [20, 40],
    ]) {
      expect(heightIn(heights, places, 1, x, y)).toBeCloseTo(alone(x, y));
    }
    expect(alone(13, 20)).toBe(2);
  });
});
