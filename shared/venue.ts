import type { ARENAS } from "./api";

/** A building on a venue's outside map. */
export type VenueBuilding = {
  /**
   * Its OpenStreetMap id: `w` and a way's number, or `r` and a relation's;
   * or `s` and a number, one only the laser scan has.
   */
  id: string;
  /** How tall it stands, in metres, from Kartverket's laser scan. */
  height: number;
  /** How high the ground under it is, in metres, as `terrain`'s. */
  base: number;
  /** Its outline as x, y, x, y, …, in metres from the map's top-left, y south. */
  ring: number[];
  /**
   * Where its roof isn't flat: how tall it stands over `base` all over it;
   * otherwise it's `height` all over.
   */
  roof?: VenueGrid;
  /** Part of the venue; otherwise only round it, drawn faded. */
  venue: boolean;
  /** The arena inside it, which tapping it opens. */
  arena?: (typeof ARENAS)[number];
  /**
   * Its number or name, as its sign has it, painted at x, y on its roof:
   * along `angle` (radians from east, clockwise, as the block runs), its
   * digits `size` metres tall; the roof there `roof` metres up, rising
   * `slope` a metre along it.
   */
  label?: {
    text: string;
    x: number;
    y: number;
    angle: number;
    size: number;
    roof: number;
    slope: number;
  };
};

/** What an area of the ground is, drawn in its colour of the palette. */
export type VenueAreaKind =
  | "water"
  | "sand"
  | "paved"
  | "wood"
  | "pitch"
  | "parking"
  | "field"
  | "grass";

/**
 * An area of the ground: its outline and the holes in it, as `ring`s; water
 * flat at `level` metres, as `terrain`'s.
 */
export type VenueArea = {
  kind: VenueAreaKind;
  rings: number[][];
  level?: number;
};

/**
 * Heights every `step` metres: `columns` across a row, rows down from `x`,
 * `y`, in metres from the map's top-left.
 */
export type VenueGrid = {
  x: number;
  y: number;
  step: number;
  columns: number;
  heights: number[];
};

/** A road or a path, `width` metres wide, along `line`'s x, y, x, y, …. */
export type VenueWay = { kind: "road" | "path"; width: number; line: number[] };

/**
 * A venue's outside map, `width` × `height` metres, north up, built by
 * `npm run venue:build` into `shared/venues/<name>.ts`.
 */
export type Venue = {
  width: number;
  height: number;
  /** Who the data is from, to be shown with it. */
  credit: string;
  /** Where it is, as [latitude, longitude]: the sun over it is worked out for it. */
  centre: [number, number];
  /**
   * Where a longitude and latitude are on it: x = a·lon + b·lat + c,
   * y = d·lon + e·lat + f, in metres from the top-left, as [a, b, c, d, e, f].
   */
  geo: number[];
  buildings: VenueBuilding[];
  /**
   * How high the ground is, in metres over the ground under the arenas'
   * building, past the map's edge.
   */
  terrain: VenueGrid;
  /** The ground under the buildings, as OpenStreetMap maps it: under first. */
  areas: VenueArea[];
  ways: VenueWay[];
  /**
   * Its trees, from the laser scan, as x, y, height, crown radius, …, in
   * metres: the venue's, and those past its edge or round it, faded.
   */
  trees: { venue: number[]; around: number[] };
};

/**
 * How high the ground is at a point, in metres from the map's top-left, y
 * south: between `terrain`'s, and level with its edge past it.
 */
export function groundHeight({ terrain }: Pick<Venue, "terrain">) {
  return gridHeight(terrain);
}

/**
 * How high a grid is at a point, in metres from the map's top-left, y south:
 * between its heights, and level with its edge past it.
 */
export function gridHeight(grid: VenueGrid) {
  const { x, y, step, columns, heights } = grid;
  const place = [x, y, step, columns, 0, heights.length];
  return (px: number, py: number) => {
    "worklet";
    return heightIn(heights, place, 0, px, py);
  };
}

/**
 * How high one of several grids is at a point, as `gridHeight`: its heights
 * among `heights`, from `places`' `k`th six (x, y, step, columns, where its
 * heights start, how many).
 */
export function heightIn(
  heights: number[],
  places: number[],
  k: number,
  x: number,
  y: number,
) {
  "worklet";
  const [x0, y0, step, columns, start, count] = places.slice(6 * k, 6 * k + 6);
  const rows = count / columns;
  const u = Math.min(Math.max((x - x0) / step, 0), columns - 1);
  const v = Math.min(Math.max((y - y0) / step, 0), rows - 1);
  const [i, j] = [
    Math.min(Math.floor(u), columns - 2),
    Math.min(Math.floor(v), rows - 2),
  ];
  const [fu, fv] = [u - i, v - j];
  const at = (column: number, row: number) =>
    heights[start + row * columns + column];
  // The cell's two triangles, split top-left to bottom-right, as the
  // ground is drawn.
  if (fu >= fv) {
    return (
      at(i, j) +
      fu * (at(i + 1, j) - at(i, j)) +
      fv * (at(i + 1, j + 1) - at(i + 1, j))
    );
  }
  return (
    at(i, j) +
    fv * (at(i, j + 1) - at(i, j)) +
    fu * (at(i + 1, j + 1) - at(i, j + 1))
  );
}

/** The ground's colours: its own, each area's, and the roads' and paths'. */
export type VenuePalette = Record<VenueAreaKind, string> & {
  ground: string;
  road: string;
  roadEdge: string;
  path: string;
  /** Trees' crowns: the venue's, and those round it. */
  tree: string;
  treeAround: string;
  /** Buildings' numbers, painted on their roofs: their faces and sides. */
  label: string;
  labelSide: string;
  /** Buildings' roofs and walls: the venue's, and those round it, faded. */
  roof: string;
  wall: string;
  roofAround: string;
  wallAround: string;
};

export const VENUE_PALETTE: VenuePalette = {
  // Grass: open ground here is lawn, unless OpenStreetMap says otherwise.
  ground: "#deeed2",
  water: "#c6dcf0",
  sand: "#f3ead2",
  paved: "#ebeae6",
  wood: "#d3e6c8",
  pitch: "#cfe8c4",
  parking: "#e7e7ec",
  field: "#eef0de",
  grass: "#deeed2",
  road: "#ffffff",
  roadEdge: "#d9d8d3",
  path: "#ffffff",
  tree: "#a3cf91",
  treeAround: "#c9e2bf",
  label: "#a3a7b0",
  labelSide: "#c8cbd2",
  roof: "#eceef2",
  wall: "#b4b9c2",
  roofAround: "#f6f7f9",
  wallAround: "#e6e7ea",
};

/** The same in dark mode, under the dark arena's grey. */
export const VENUE_DARK_PALETTE: VenuePalette = {
  ground: "#1f2b1d",
  water: "#17293a",
  sand: "#2c291f",
  paved: "#2c2c30",
  wood: "#1b2a1b",
  pitch: "#1e2e1c",
  parking: "#28282c",
  field: "#232619",
  grass: "#1f2b1d",
  road: "#3a3a3e",
  roadEdge: "#2a2a2e",
  path: "#333337",
  tree: "#2c4529",
  treeAround: "#243321",
  label: "#9a9aa3",
  labelSide: "#77777f",
  // Lighter than the roads, so the buildings stand out of the dark.
  roof: "#5c5c64",
  wall: "#3e3e45",
  roofAround: "#46464c",
  wallAround: "#35353a",
};
