import type { ArenaLevels } from "@shared/arena";

// How tall the map's parts stand, in arena units, built in 3D (`ArenaScene`).

// Rows, about 2 points on a phone.
export const ROW_HEIGHT = 10;
// The columns (the map's markers), about 9 points on a phone.
export const COLUMN_HEIGHT = 45;
/**
 * How high the arena is under each point of the map, in arena units: the
 * top of the highest level there, or the floor's 0.
 */
export function arenaHeights({
  levels,
}: {
  levels: Pick<ArenaLevels["levels"][number], "height" | "ring">[];
}) {
  // Flat, for the UI thread: each level's height, where its ring starts and
  // ends in `points`, and its bounds as left, top, right, bottom.
  const heights: number[] = [];
  const starts: number[] = [];
  const points: number[] = [];
  const bounds: number[] = [];
  for (const { height, ring } of levels) {
    heights.push(height);
    starts.push(points.length);
    points.push(...ring);
    const xs = ring.filter((_, i) => i % 2 === 0);
    const ys = ring.filter((_, i) => i % 2 === 1);
    bounds.push(
      Math.min(...xs),
      Math.min(...ys),
      Math.max(...xs),
      Math.max(...ys),
    );
  }
  starts.push(points.length);

  /** Which of `levels` a point is on, the first it's in; -1 for none. */
  function levelAt(x: number, y: number) {
    "worklet";
    // Levels are highest first: the first one the point is in.
    for (let level = 0; level < heights.length; level++) {
      const b = level * 4;
      if (
        x < bounds[b] ||
        y < bounds[b + 1] ||
        x > bounds[b + 2] ||
        y > bounds[b + 3]
      ) {
        continue;
      }
      // In it if a line from it to the right crosses its ring an odd
      // number of times.
      const [start, end] = [starts[level], starts[level + 1]];
      let inside = false;
      for (let i = start, j = end - 2; i < end; j = i, i += 2) {
        const [x1, y1, x2, y2] = [
          points[i],
          points[i + 1],
          points[j],
          points[j + 1],
        ];
        if (y1 > y !== y2 > y && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) {
          inside = !inside;
        }
      }
      if (inside) return level;
    }
    return -1;
  }
  // After levelAt: the worklet plugin makes each a const, not hoisted.
  /** How high the arena is at a point, in arena units. */
  function heightAt(x: number, y: number) {
    "worklet";
    const level = levelAt(x, y);
    return level < 0 ? 0 : heights[level];
  }

  return { heightAt, levelAt };
}
