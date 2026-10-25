/**
 * An arena's seating map as geometry, so both apps draw it themselves and own
 * its colours. Geometry is generated from `public/arena/<name>.svg` by
 * `npm run arena:build`; the colours live here.
 */

/**
 * - `row`: a row of seats.
 * - `marker`: a small dot on the map (entrances, aisles).
 * - `outline`: a stroked wall or floor edge.
 */
export type ArenaShapeKind = "row" | "marker" | "outline";

export type ArenaShape = {
  kind: ArenaShapeKind;
  /** SVG path data, in the arena's `width` × `height` coordinate space. */
  d: string;
  /**
   * An outline that a map in perspective raises: the stage, one of the steps
   * up to it (lowest step first), or the edges of the tiers the seats stand
   * on: `tall-tiers` those whose long edges stand twice as tall.
   */
  part?: "stage" | "stair" | "tiers" | "tall-tiers";
};

export type Arena = {
  width: number;
  height: number;
  shapes: ArenaShape[];
};

/**
 * A level of an arena built in 3D: a stand's step, the stage or a step up to
 * it, or the sound deck's box. Where levels overlap, the higher one is there.
 */
export type ArenaLevel = {
  part: "stair" | "stage" | "deck";
  /** How high its top is, in arena units. */
  height: number;
  /** Its outline as x, y, x, y, …, closed. */
  ring: number[];
};

/**
 * An arena's levels and seats, built in 3D from
 * `public/arena/<name>_3d-raw.svg` by `npm run arena:build`; in the same
 * coordinate space as its `Arena`, which they can run past the edge of.
 */
export type ArenaLevels = {
  width: number;
  height: number;
  /** Highest first. */
  levels: ArenaLevel[];
  /** Each seat as its centre x, y, width, height and turn in degrees. */
  seats: number[];
  /** Each column's outline as x, y, x, y, …, closed. */
  columns: number[][];
};

export type ArenaColors = Record<ArenaShapeKind, string>;

export const ARENA_COLORS: ArenaColors = {
  row: "#7299d6",
  marker: "#9e9e9e",
  outline: "#9e9e9e",
};

/**
 * Every colour a map in perspective needs: the shapes', the floor under them,
 * the top of the stage and its steps, and the sides it gives rows, columns
 * (lit top), the stage and the tiers; and the fronts of the stands' steps
 * built in 3D, in shadow, the tops of the steps, every other one shaded more,
 * both apart from the floor, the tops of every other step up to the stage,
 * and the sound deck's box and its sides.
 */
export type ArenaPalette = ArenaColors & {
  floor: string;
  stageTop: string;
  rowSide: string;
  columnTop: string;
  stageSide: string;
  tierSide: string;
  stepFront: string;
  stepTop: string;
  stairTop: string;
  stageStepTop: string;
  deck: string;
  deckSide: string;
};

export const ARENA_PALETTE: ArenaPalette = {
  ...ARENA_COLORS,
  floor: "#ffffff",
  stageTop: "#e6e7ea",
  rowSide: "#c5cdd9",
  columnTop: "#cfcfcf",
  stageSide: "#c4c7cd",
  tierSide: "#d2d2d2",
  stepFront: "#b4b9c2",
  stepTop: "#eceef2",
  stairTop: "#f6f7f9",
  stageStepTop: "#dcdee2",
  deck: "#55575c",
  deckSide: "#8d96a6",
};

/** The same in dark mode: a dark grey floor, dimmer rows, sides lighter than it. */
export const ARENA_DARK_PALETTE: ArenaPalette = {
  row: "#5b7fc0",
  marker: "#5c5c62",
  outline: "#5c5c62",
  floor: "#1c1c1e",
  stageTop: "#333336",
  rowSide: "#2f3f5c",
  columnTop: "#7a7a80",
  stageSide: "#46464b",
  tierSide: "#2c2c30",
  stepFront: "#0c0c0e",
  stepTop: "#252528",
  stairTop: "#212124",
  stageStepTop: "#3c3c40",
  deck: "#3c3d42",
  deckSide: "#5d6678",
};

/** Stroke width of `outline` shapes, in arena units. */
export const ARENA_OUTLINE_WIDTH = 2;

/** A straight line from (`x1`, `y1`) to (`x2`, `y2`), in arena units. */
export type ArenaSegment = [x1: number, y1: number, x2: number, y2: number];

/**
 * The straight lines of path data, each curve taken as the line between its
 * ends: the arena's curves only round off corners. Reads the commands the
 * arena SVGs use: M, L, H, V, C and Z, absolute or relative.
 */
export function pathSegments(d: string): ArenaSegment[] {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d*\.\d+|\d+)(?:e-?\d+)?/g) ?? [];
  const segments: ArenaSegment[] = [];
  let i = 0;
  let command = "M";
  let [x, y, startX, startY] = [0, 0, 0, 0];
  const next = () => Number(tokens[i++]);
  const lineTo = (toX: number, toY: number) => {
    segments.push([x, y, toX, toY]);
    [x, y] = [toX, toY];
  };

  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) command = tokens[i++];
    const relative = command === command.toLowerCase();
    const dx = relative ? x : 0;
    const dy = relative ? y : 0;
    switch (command.toLowerCase()) {
      case "m":
        x = next() + dx;
        y = next() + dy;
        [startX, startY] = [x, y];
        // Pairs after a move are lines.
        command = relative ? "l" : "L";
        break;
      case "l":
        lineTo(next() + dx, next() + dy);
        break;
      case "h":
        lineTo(next() + dx, y);
        break;
      case "v":
        lineTo(x, next() + dy);
        break;
      case "c":
        i += 4;
        lineTo(next() + dx, next() + dy);
        break;
      case "z":
        lineTo(startX, startY);
        break;
      default:
        throw new Error(`unsupported path command: ${command}`);
    }
  }
  return segments;
}

/**
 * The arena as a standalone SVG document, for renderers that only take an
 * image (the Open Graph image).
 */
export function arenaToSvg(
  arena: Arena,
  colors: ArenaColors = ARENA_COLORS,
): string {
  const paths = arena.shapes
    .map(({ kind, d }) =>
      kind === "outline"
        ? `<path d="${d}" fill="none" stroke="${colors.outline}" stroke-width="${ARENA_OUTLINE_WIDTH}" stroke-linecap="round" stroke-linejoin="round"/>`
        : `<path d="${d}" fill="${colors[kind]}" fill-rule="evenodd" clip-rule="evenodd"/>`,
    )
    .join("");

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${arena.width}" height="${arena.height}" viewBox="0 0 ${arena.width} ${arena.height}" fill="none">${paths}</svg>`;
}

/**
 * The centre of the seat nearest a point, or null when none is within a
 * seat's size of it: the stage and the aisles keep the point as it is.
 */
export function nearestSeat(
  seats: number[],
  x: number,
  y: number,
): { x: number; y: number } | null {
  let nearest: { x: number; y: number } | null = null;
  let best = Number.POSITIVE_INFINITY;
  for (let i = 0; i < seats.length; i += 5) {
    const distance = Math.hypot(seats[i] - x, seats[i + 1] - y);
    if (distance < best && distance <= Math.max(seats[i + 2], seats[i + 3])) {
      best = distance;
      nearest = { x: seats[i], y: seats[i + 1] };
    }
  }
  return nearest;
}
