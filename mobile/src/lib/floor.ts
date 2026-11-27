import type { ARENAS } from "@shared/api";
import { nearestSeat } from "@shared/arena";
import salen from "@shared/arenas/salen";
import salenLevels from "@shared/arenas/salen-levels";
import { type GridPosition, percentageToGrid } from "@shared/grid";
import { ARENA_DARK_PALETTE } from "@shared/arena";
import { sunPosition } from "@shared/sun";
import {
  groundHeight,
  heightIn,
  VENUE_DARK_PALETTE,
  type Venue,
} from "@shared/venue";
import type * as THREE from "three";
import { arenaHeights, ROW_HEIGHT } from "@/lib/arena";
import { arenaTriangles, buildArena } from "@/lib/arenaScene";
import type { Theme } from "@/lib/theme";
import { type FloorView, fit, standHeight, toFloor } from "@/lib/tilt";
import { buildVenue } from "@/lib/venueScene";

// The maps a pin goes on, each a floor seen as `tilt` sees it: salen's, with
// its stands and seats, and a venue's outside, with its buildings. What the
// map (`TouchMap`) and its scene (`ArenaScene`) need to know of each.

type Arena = (typeof ARENAS)[number];

/** A floor's scene, built for a map: its meshes, and how to colour them. */
export type FloorModel = {
  group: THREE.Group;
  paint(theme: Theme): void;
  /** The colour round it and under it. */
  background(theme: Theme): string;
  /** Darkens the building with `arena` in it while it's pressed; null, none. */
  press?(arena: Arena | null): void;
  /** Shows its buildings' labels, or hides them; it has none without. */
  showLabels?(shown: boolean): void;
  /** Sets what turns with the view, before the scene's matrices update. */
  place?(view: FloorView): void;
  /** Sets what's drawn by depth, seen by `camera`, after they do. */
  aim?(camera: THREE.Camera): void;
  /** Called as its colours change outside a redraw, to be drawn again. */
  onChange?: () => void;
  dispose(): void;
};

export type Floor = {
  /** Its name, to remember how it was last seen by. */
  id: string;
  /** How it's seen at first, and when it's reset; all of it, unturned, without. */
  start?: FloorView;
  /** Its width against its height. */
  aspect: number;
  /** How high what's built is at a point, as map percentages, in map heights. */
  heightAt: (percentageX: number, percentageY: number) => number;
  /** How far over that a pin stands, in map heights: on top of the seats. */
  over: number;
  /** How far in two fingers zoom it, against all of it. */
  maxZoom: number;
  /** How far out, the same way; all of it without. */
  minZoom?: number;
  /** How big its pins are against salen's: smaller on a map of more. */
  pinScale: number;
  /** Whether it turns as the phone does, end on, or stays north up. */
  compass: boolean;
  /** Kept from being slid past its edge, rather than half off the screen. */
  inside?: boolean;
  /** Builds its scene, for one map. */
  build(): FloorModel;
  /** Works out ahead what building its scene takes, to be quick when it is. */
  prepare?(): void;
  /** Where a pin let go of at `position` settles: on a seat, say. */
  settle?(position: GridPosition): GridPosition;
  /**
   * The arena whose building is under a point on screen (map percentages),
   * seen as `view`; null where none is.
   */
  arenaAt?(
    view: FloorView,
    percentageX: number,
    percentageY: number,
  ): Arena | null;
};

/** A point as map percentages, with where it falls on the grid. */
function position(percentageX: number, percentageY: number): GridPosition {
  return {
    percentageX,
    percentageY,
    ...percentageToGrid(percentageX, percentageY),
  };
}

/** Salen: its stands, a pin on the seat it's let go by. */
export const salenFloor: Floor = {
  id: "salen",
  aspect: salen.width / salen.height,
  heightAt: standHeight,
  over: ROW_HEIGHT / salen.height,
  maxZoom: 6,
  pinScale: 1,
  compass: true,
  inside: true,
  build() {
    const model = buildArena(salenLevels, salen);
    return {
      group: model.group,
      paint: (theme) => model.paint(theme.arena),
      background: (theme) => theme.background,
      dispose: () => model.dispose(),
    };
  },
  prepare() {
    arenaTriangles(salenLevels, salen);
  },
  settle(at) {
    const seat = nearestSeat(
      salenLevels.seats,
      (at.percentageX / 100) * salen.width,
      (at.percentageY / 100) * salen.height,
    );
    if (!seat) return at;
    return position(
      (seat.x / salen.width) * 100,
      (seat.y / salen.height) * 100,
    );
  },
};

// How many heights up a building is tried for being under a finger: its
// roof seen from above, its sides lower down.
const PICK_STEPS = 6;

// How often the sun over a venue is worked out again.
const MINUTE = 60_000;

/** A ring of x, y, … has the point in it. */
function inside(ring: number[], x: number, y: number) {
  let within = false;
  for (let i = 0, j = ring.length - 2; i < ring.length; j = i, i += 2) {
    const [x1, y1, x2, y2] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
    if (y1 > y !== y2 > y && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) {
      within = !within;
    }
  }
  return within;
}

// How far onto land a pin let go of in the water comes, in metres.
const ASHORE = 3;

/** In water on `venue`: in an outline of it, not in a hole (an island). */
function inWater(venue: Venue, x: number, y: number) {
  return venue.areas.some(
    ({ kind, rings: [outer, ...holes] }) =>
      kind === "water" &&
      inside(outer, x, y) &&
      !holes.some((hole) => inside(hole, x, y)),
  );
}

/**
 * The nearest point to `x`, `y` on land, ASHORE in from the water's edge;
 * null if that's in water too.
 */
function ashore(venue: Venue, x: number, y: number): [number, number] | null {
  let best: { distance: number; x: number; y: number } | null = null;
  for (const { kind, rings } of venue.areas) {
    if (kind !== "water") continue;
    for (const ring of rings) {
      for (let i = 0; i < ring.length; i += 2) {
        const j = (i + 2) % ring.length;
        const [x1, y1, x2, y2] = [ring[i], ring[i + 1], ring[j], ring[j + 1]];
        const [dx, dy] = [x2 - x1, y2 - y1];
        const t = Math.min(
          Math.max(
            ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1),
            0,
          ),
          1,
        );
        const [px, py] = [x1 + t * dx, y1 + t * dy];
        const distance = Math.hypot(px - x, py - y);
        if (!best || distance < best.distance)
          best = { distance, x: px, y: py };
      }
    }
  }
  if (!best) return null;
  // On past the edge, the way it came from the point.
  const away = best.distance || 1;
  const [lx, ly] = [
    best.x + ((best.x - x) / away) * ASHORE,
    best.y + ((best.y - y) / away) * ASHORE,
  ];
  return inWater(venue, lx, ly) ? null : [lx, ly];
}

/**
 * A venue's outside, called `id`, first seen as `start`: its buildings on the
 * ground, those with arenas opened, and no pin in its water.
 */
export function venueFloor(venue: Venue, id: string, start?: FloorView): Floor {
  const aspect = venue.width / venue.height;
  const arenas = venue.buildings.filter(({ arena }) => arena);
  // The buildings' roofs, highest first, which a pin stands on, as high as
  // each is there; the ground between them.
  const tallest = [...venue.buildings].sort(
    (a, b) => b.base + b.height - (a.base + a.height),
  );
  const onRoof = arenaHeights({ levels: tallest }).levelAt;
  const bases = tallest.map(({ base }) => base);
  const flatRoofs = tallest.map(({ height, roof }) => (roof ? -1 : height));
  // The roofs that aren't flat, their grids one after another, as
  // `heightIn` takes them; by building, which grid, or -1.
  const roofHeights: number[] = [];
  const roofPlaces: number[] = [];
  const roofOf = tallest.map(({ roof }) => {
    if (!roof) return -1;
    const { x, y, step, columns, heights } = roof;
    roofPlaces.push(x, y, step, columns, roofHeights.length, heights.length);
    roofHeights.push(...heights);
    return roofPlaces.length / 6 - 1;
  });
  const groundAt = groundHeight(venue);
  const [mapWidth, mapHeight] = [venue.width, venue.height];
  return {
    id,
    start,
    aspect,
    // On the roof of a building it's on, else on the ground.
    heightAt: (percentageX: number, percentageY: number) => {
      "worklet";
      const [x, y] = [
        (percentageX / 100) * mapWidth,
        (percentageY / 100) * mapHeight,
      ];
      const on = onRoof(x, y);
      if (on < 0) return groundAt(x, y) / mapHeight;
      const tall =
        roofOf[on] < 0
          ? flatRoofs[on]
          : heightIn(roofHeights, roofPlaces, roofOf[on], x, y);
      return (bases[on] + tall) / mapHeight;
    },
    over: 0,
    maxZoom: 12,
    // No further out than it's first seen: past that is only what's round it.
    minZoom: start && start.zoom * fit(start.turn, aspect),
    pinScale: 0.55,
    compass: false,
    inside: true,
    // Let go of in the water, on the nearest shore.
    settle(at) {
      const [x, y] = [
        (at.percentageX / 100) * mapWidth,
        (at.percentageY / 100) * mapHeight,
      ];
      if (!inWater(venue, x, y)) return at;
      const land = ashore(venue, x, y);
      if (!land) return at;
      return position((land[0] / mapWidth) * 100, (land[1] / mapHeight) * 100);
    },
    build() {
      const model = buildVenue(venue);
      // Lit by the sun over it as it is now, and again each minute; dark
      // once it's down, whatever the phone's appearance.
      const [latitude, longitude] = venue.centre;
      let night = false;
      let theme: Theme | null = null;
      const paint = () => {
        if (!theme) return;
        model.paint(
          night ? ARENA_DARK_PALETTE : theme.arena,
          night ? VENUE_DARK_PALETTE : theme.venue,
        );
      };
      const tick = () => {
        const sun = sunPosition(new Date(), latitude, longitude);
        model.sun(sun);
        night = sun.altitude < 0;
        paint();
        built.onChange?.();
      };
      const clock = setInterval(tick, MINUTE);
      const built: FloorModel = {
        group: model.group,
        paint: (colours) => {
          theme = colours;
          paint();
        },
        background: (colours) =>
          night ? VENUE_DARK_PALETTE.ground : colours.venue.ground,
        press: (arena) => {
          model.press(arena);
          built.onChange?.();
        },
        showLabels: (shown) => {
          model.showLabels(shown);
          built.onChange?.();
        },
        place: (view) => model.place(view),
        aim: (camera) => model.aim(camera),
        dispose: () => {
          clearInterval(clock);
          model.dispose();
        },
      };
      tick();
      return built;
    },
    arenaAt(view, percentageX, percentageY) {
      // Under the finger at each height from the roof down: a building's
      // there if the point at its own height is inside it.
      for (const { arena, ring, height, base } of arenas) {
        for (let step = PICK_STEPS; step >= 0; step--) {
          const up = (base + (height * step) / PICK_STEPS) / venue.height;
          const at = toFloor(view, percentageX, percentageY, up, aspect);
          const x = (at.percentageX / 100) * venue.width;
          const y = (at.percentageY / 100) * venue.height;
          if (inside(ring, x, y)) return arena as Arena;
        }
      }
      return null;
    },
  };
}

/**
 * Where a longitude and latitude are on a venue's map, as a position; null
 * off it.
 */
export function onVenue(
  venue: Venue,
  longitude: number,
  latitude: number,
): GridPosition | null {
  const [a, b, c, d, e, f] = venue.geo;
  const percentageX = ((a * longitude + b * latitude + c) / venue.width) * 100;
  const percentageY = ((d * longitude + e * latitude + f) / venue.height) * 100;
  const on = (value: number) => value >= 0 && value <= 100;
  return on(percentageX) && on(percentageY)
    ? position(percentageX, percentageY)
    : null;
}
