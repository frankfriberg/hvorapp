import {
  type Arena,
  type ArenaLevels,
  type ArenaSegment,
  pathSegments,
} from "@shared/arena";

// How tall the map's parts stand, in arena units, both drawn flat in
// perspective (`ArenaMap`) and built in 3D (`ArenaScene`).

// Rows, about 2 points on a phone.
export const ROW_HEIGHT = 10;
// The columns (the map's markers), about 9 points on a phone.
export const COLUMN_HEIGHT = 45;
// How much each step up to the stage rises (under 1 point on a phone): the
// stage stands a rise for each step and one more, and each step a rise lower
// than the one above it, so every step has room to stand on.
export const STEP_RISE = 3.75;
// A tier's side, about 1.5 points on a phone; twice that for the long edges
// of `tall-tiers`.
export const TIER_RISE = 7.5;

// Tier edges shorter than this, end to end, are the short ones at the ends
// of the rows.
const SHORT_TIER = 100;

/**
 * The edges of the tiers the seats stand on, joined end to end into the
 * lines they were drawn as: whether they're `tall-tiers`, and whether short.
 */
function joinedTierLines(arena: Arena) {
  const lines: { tall: boolean; segments: ArenaSegment[] }[] = [];
  for (const { d, part } of arena.shapes) {
    if (part !== "tiers" && part !== "tall-tiers") continue;
    for (const segment of pathSegments(d)) {
      const line = lines.at(-1);
      const last = line?.segments.at(-1);
      if (line && last && last[2] === segment[0] && last[3] === segment[1]) {
        line.segments.push(segment);
      } else lines.push({ tall: part === "tall-tiers", segments: [segment] });
    }
  }
  return lines.map(({ tall, segments }) => {
    const length = segments.reduce(
      (sum, [x1, y1, x2, y2]) => sum + Math.hypot(x2 - x1, y2 - y1),
      0,
    );
    return { tall, short: length < SHORT_TIER, segments };
  });
}

/**
 * The edges of the tiers the seats stand on, as drawn flat: each line with
 * how tall its side stands.
 */
export function tierLines(arena: Arena) {
  return joinedTierLines(arena).map(({ tall, short, segments }) => ({
    short,
    rise: TIER_RISE * (tall && !short ? 2 : 1),
    segments,
  }));
}

/**
 * How high the arena is under each point of the map, in arena units: the
 * top of the highest level there, or the floor's 0.
 */
export function arenaHeights({ levels }: ArenaLevels) {
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

  /** How high the arena is at a point, in arena units. */
  function heightAt(x: number, y: number) {
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
      if (inside) return heights[level];
    }
    return 0;
  }
  return { heightAt };
}
