import type {
  ArenaLevel,
  ArenaLevels,
  ArenaPalette,
  ArenaSegment,
} from "@shared/arena";
import * as THREE from "three";
import { arenaHeights, COLUMN_HEIGHT, ROW_HEIGHT } from "@/lib/arena";

// The arena built in 3D from its levels alone (`<name>_3d-raw.svg`): the
// stands' steps, the stage and its steps and the sound deck stood up off the
// floor, seats and columns on them.
// Coordinates are map heights from the map's centre, x right, y up the map,
// z up off the floor, so the floor leans and turns as `tilt` says.

// How round the corners of seats and of levels are, in arena units, and
// the bends each corner is drawn with: few on seats, there are thousands.
const SEAT_ROUNDING = 3;
const SEAT_CORNER_STEPS = 2;
const LEVEL_ROUNDING = 6;
const LEVEL_CORNER_STEPS = 4;

type Ring = [number, number][];

/**
 * A ring with its corners rounded off: each cut back `radius` along its two
 * sides, or half of the shorter, and curved between in `steps` bends.
 */
function rounded(ring: Ring, radius: number, steps: number): Ring {
  const out: Ring = [];
  ring.forEach(([x, y], i) => {
    const [px, py] = ring[(i + ring.length - 1) % ring.length];
    const [nx, ny] = ring[(i + 1) % ring.length];
    const back = Math.hypot(px - x, py - y);
    const on = Math.hypot(nx - x, ny - y);
    const cut = Math.min(radius, back / 2, on / 2);
    if (cut === 0) {
      out.push([x, y]);
      return;
    }
    const [ax, ay] = [x + ((px - x) / back) * cut, y + ((py - y) / back) * cut];
    const [bx, by] = [x + ((nx - x) / on) * cut, y + ((ny - y) / on) * cut];
    // A curve from one cut to the other, pulled toward the corner.
    for (let k = 0; k <= steps; k++) {
      const t = k / steps;
      const u = 1 - t;
      out.push([
        u * u * ax + 2 * u * t * x + t * t * bx,
        u * u * ay + 2 * u * t * y + t * t * by,
      ]);
    }
  });
  return out;
}

/** What each part is painted with: a colour of the palette. */
type Paint = keyof Pick<
  ArenaPalette,
  | "row"
  | "rowSide"
  | "marker"
  | "columnTop"
  | "stageTop"
  | "stageSide"
  | "tierSide"
  | "floor"
  | "stepFront"
  | "stepTop"
  | "deck"
  | "deckFront"
>;
const PAINTS: Paint[] = [
  "row",
  "rowSide",
  "marker",
  "columnTop",
  "stageTop",
  "stageSide",
  "tierSide",
  "floor",
  "stepFront",
  "stepTop",
  "deck",
  "deckFront",
];

/** Each level's top and sides. */
const LEVEL_PAINTS: Record<ArenaLevel["part"], [top: Paint, side: Paint]> = {
  stair: ["floor", "stepFront"],
  stage: ["stageTop", "stageSide"],
  deck: ["deck", "deck"],
};

/** A level's flat x, y, x, y, … as a ring. */
function toRing({ ring: flat }: ArenaLevel): Ring {
  const ring: Ring = [];
  for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]]);
  return ring;
}

/** The middle of some points, by their average. */
function middleOf(points: Ring): [number, number] {
  return [
    points.reduce((sum, [x]) => sum + x, 0) / points.length,
    points.reduce((sum, [, y]) => sum + y, 0) / points.length,
  ];
}

/**
 * How the sound deck's sides are painted: its front, the sides facing the
 * stage (within 45°), apart from the rest, so it reads as a desk.
 */
function deckSides(ring: Ring, [stageX, stageY]: [number, number]) {
  const [mx, my] = middleOf(ring);
  const toStage = Math.atan2(stageY - my, stageX - mx);
  return ([x1, y1, x2, y2]: ArenaSegment): Paint => {
    // Across the side, turned away from the deck's middle.
    let [nx, ny] = [y2 - y1, x1 - x2];
    if (nx * ((x1 + x2) / 2 - mx) + ny * ((y1 + y2) / 2 - my) < 0) {
      [nx, ny] = [-nx, -ny];
    }
    let turn = Math.abs(Math.atan2(ny, nx) - toStage);
    if (turn > Math.PI) turn = 2 * Math.PI - turn;
    return turn < Math.PI / 4 ? "deckFront" : "deck";
  };
}

/**
 * Which levels' tops are shaded: every other step up from the floor, by
 * height, so the steps show from any side, not only where their fronts face
 * the eye.
 */
function stepShades(levels: ArenaLevel[]) {
  const heights = [
    ...new Set(
      levels.filter(({ part }) => part === "stair").map(({ height }) => height),
    ),
  ].sort((a, b) => a - b);
  return levels.map(
    ({ part, height }) => part === "stair" && heights.indexOf(height) % 2 === 0,
  );
}

/**
 * The arena as a group of meshes, one per colour, and how to paint them in
 * a palette; centred on `frame`, the map the pins are placed on, which the
 * levels share an origin with and can run past the edge of.
 */
export function buildArena(
  levels: ArenaLevels,
  frame: { width: number; height: number },
) {
  const triangles = Object.fromEntries(
    PAINTS.map((paint) => [paint, [] as number[]]),
  ) as Record<Paint, number[]>;
  const at = (x: number, y: number, z: number) => [
    (x - frame.width / 2) / frame.height,
    (frame.height / 2 - y) / frame.height,
    z / frame.height,
  ];
  const quad = (
    paint: Paint,
    a: number[],
    b: number[],
    c: number[],
    d: number[],
  ) => triangles[paint].push(...a, ...b, ...c, ...a, ...c, ...d);

  /** A ring stood up from `base` to `top`: its sides and its top. */
  const prism = (
    ring: Ring,
    base: number,
    top: number,
    topPaint: Paint,
    sidePaint: Paint | ((side: ArenaSegment) => Paint),
  ) => {
    ring.forEach(([x1, y1], j) => {
      const [x2, y2] = ring[(j + 1) % ring.length];
      quad(
        typeof sidePaint === "function"
          ? sidePaint([x1, y1, x2, y2])
          : sidePaint,
        at(x1, y1, base),
        at(x2, y2, base),
        at(x2, y2, top),
        at(x1, y1, top),
      );
    });
    const contour = ring.map(([x, y]) => new THREE.Vector2(x, y));
    for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(contour, [])) {
      for (const k of [a, b, c]) {
        triangles[topPaint].push(...at(ring[k][0], ring[k][1], top));
      }
    }
  };

  const { heightAt } = arenaHeights(levels);
  /** The height under a ring's middle, which it stands on. */
  const groundOf = (ring: Ring) =>
    heightAt(
      ring.reduce((sum, [x]) => sum + x, 0) / ring.length,
      ring.reduce((sum, [, y]) => sum + y, 0) / ring.length,
    );

  // Each column standing on the level under its middle.
  for (const flat of levels.columns) {
    const ring: Ring = [];
    for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]]);
    const ground = groundOf(ring);
    prism(ring, ground, ground + COLUMN_HEIGHT, "columnTop", "marker");
  }

  // Each level as a solid block from the floor up, its top and sides by
  // what it is: a step's edge is its front, not a line, and every other
  // step's top is shaded.
  const shaded = stepShades(levels.levels);
  const stageAt = middleOf(
    levels.levels.filter(({ part }) => part === "stage").flatMap(toRing),
  );
  levels.levels.forEach((level, index) => {
    const { part, height } = level;
    const ring = toRing(level);
    const [top, side] = LEVEL_PAINTS[part];
    const ringPaint = part === "deck" ? deckSides(ring, stageAt) : side;
    prism(
      rounded(ring, LEVEL_ROUNDING, LEVEL_CORNER_STEPS),
      0,
      height,
      shaded[index] ? "stepTop" : top,
      ringPaint,
    );
  });

  // Each seat a box on the level under its middle.
  const { seats } = levels;
  for (let i = 0; i < seats.length; i += 5) {
    const [x, y, width, depth, turn] = seats.slice(i, i + 5);
    const [cos, sin] = [
      Math.cos((turn * Math.PI) / 180),
      Math.sin((turn * Math.PI) / 180),
    ];
    const ring: Ring = [
      [-width / 2, -depth / 2],
      [width / 2, -depth / 2],
      [width / 2, depth / 2],
      [-width / 2, depth / 2],
    ].map(([u, v]) => [x + u * cos - v * sin, y + u * sin + v * cos]);
    const ground = heightAt(x, y);
    prism(
      rounded(ring, SEAT_ROUNDING, SEAT_CORNER_STEPS),
      ground,
      ground + ROW_HEIGHT,
      "row",
      "rowSide",
    );
  }

  const group = new THREE.Group();
  const materials = {} as Record<Paint, THREE.MeshBasicMaterial>;
  for (const paint of PAINTS) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(triangles[paint], 3),
    );
    // Flat colours, both sides: what shows is set by depth alone.
    materials[paint] = new THREE.MeshBasicMaterial({ side: THREE.DoubleSide });
    group.add(new THREE.Mesh(geometry, materials[paint]));
  }
  return {
    group,
    paint(palette: ArenaPalette) {
      for (const paint of PAINTS) materials[paint].color.set(palette[paint]);
    },
    dispose() {
      for (const child of group.children) {
        if (child instanceof THREE.Mesh) {
          child.geometry.dispose();
          child.material.dispose();
        }
      }
    },
  };
}
