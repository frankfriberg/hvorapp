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

/** Stroke width of `outline` shapes, in arena units. */
export const ARENA_OUTLINE_WIDTH = 2;

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
