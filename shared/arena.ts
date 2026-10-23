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

export type ArenaColors = Record<ArenaShapeKind, string>;

export const ARENA_COLORS: ArenaColors = {
  row: "#7299d6",
  marker: "#9e9e9e",
  outline: "#9e9e9e",
};

/** The side of a row, where a map in perspective gives rows some height. */
export const ARENA_ROW_SIDE_COLOR = "#c5cdd9";

/** The lit top of a column, where a map in perspective stands markers up. */
export const ARENA_COLUMN_TOP_COLOR = "#cfcfcf";

/** The stage's side, where a map in perspective raises it. */
export const ARENA_STAGE_SIDE_COLOR = "#e2e2e2";

/** A tier's side, where a map in perspective raises the tiers. */
export const ARENA_TIER_SIDE_COLOR = "#d2d2d2";

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
