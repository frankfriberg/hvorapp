import {
  type Arena,
  type ArenaLevel,
  type ArenaLevels,
  type ArenaPalette,
  pathSegments,
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
  | "stairTop"
  | "stageStepTop"
  | "deck"
  | "deckSide"
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
  "stairTop",
  "stageStepTop",
  "deck",
  "deckSide",
];

/**
 * Each level's top and sides, and the top of every other one of its steps,
 * shaded so each step stands apart from the one next to it.
 */
const LEVEL_PAINTS: Record<
  ArenaLevel["part"],
  [top: Paint, side: Paint, shaded: Paint]
> = {
  stair: ["stairTop", "stepFront", "stepTop"],
  stage: ["stageTop", "stageSide", "stageStepTop"],
  deck: ["deck", "deckSide", "deck"],
};

/**
 * The hall's floor: round everything its walls on the map are drawn with,
 * its outline shapes; the hall has no wall that turns in.
 */
function hallFloor({ shapes }: Arena): Ring {
  const points = shapes
    .filter(({ kind }) => kind === "outline")
    .flatMap(({ d }) =>
      pathSegments(d).flatMap(
        ([x1, y1, x2, y2]): Ring => [
          [x1, y1],
          [x2, y2],
        ],
      ),
    )
    .sort(([ax, ay], [bx, by]) => ax - bx || ay - by);
  // Andrew's monotone chain: the lower side, then the upper.
  const cross = ([ox, oy]: number[], [ax, ay]: number[], [bx, by]: number[]) =>
    (ax - ox) * (by - oy) - (ay - oy) * (bx - ox);
  const side = (from: Ring) => {
    const out: Ring = [];
    for (const point of from) {
      while (
        out.length >= 2 &&
        cross(out[out.length - 2], out[out.length - 1], point) <= 0
      )
        out.pop();
      out.push(point);
    }
    out.pop();
    return out;
  };
  return [...side(points), ...side([...points].reverse())];
}

// How far past a side its far side is looked at, in map units.
const OUTER_PROBE = 2;

// How far under the stands a corner of the floor is tucked, in map units.
const FLOOR_TUCK = 6;

/**
 * The floor's corners pulled in toward its middle until each is under the
 * stands, so none of it shows past their outer walls; a corner with no stand
 * on the way in stays where it was.
 */
function underStands(
  ring: Ring,
  heightAt: (x: number, y: number) => number,
): Ring {
  const cx = ring.reduce((sum, [x]) => sum + x, 0) / ring.length;
  const cy = ring.reduce((sum, [, y]) => sum + y, 0) / ring.length;
  return ring.map(([x, y]) => {
    const length = Math.hypot(cx - x, cy - y);
    const [dx, dy] = [(cx - x) / length, (cy - y) / length];
    for (let d = 0; d < length; d += 1) {
      if (heightAt(x + dx * d, y + dy * d) > 0) {
        const tucked = Math.min(d + FLOOR_TUCK, length);
        return [x + dx * tucked, y + dy * tucked];
      }
    }
    return [x, y];
  });
}

/** Whether a point is inside a ring (even-odd). */
function insideRing(ring: Ring, x: number, y: number) {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** A level's flat x, y, x, y, … as a ring. */
function toRing({ ring: flat }: ArenaLevel): Ring {
  const ring: Ring = [];
  for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]]);
  return ring;
}

/**
 * Which levels' tops are shaded: every other step up from the floor, of the
 * stands or the stage, by height, so the steps show from any side, not only
 * where their fronts face the eye.
 */
function stepShades(levels: ArenaLevel[]) {
  const heights = (part: ArenaLevel["part"]) =>
    [
      ...new Set(
        levels
          .filter((level) => level.part === part)
          .map(({ height }) => height),
      ),
    ].sort((a, b) => a - b);
  const steps = { stair: heights("stair"), stage: heights("stage") };
  return levels.map(
    ({ part, height }) =>
      part !== "deck" && steps[part].indexOf(height) % 2 === 0,
  );
}

/**
 * The arena as a group of meshes, one per colour, and how to paint them in
 * a palette; centred on `frame`, the map the pins are placed on, which the
 * levels share an origin with and can run past the edge of.
 */
export function buildArena(levels: ArenaLevels, frame: Arena) {
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
    sidePaint:
      | Paint
      | ((x1: number, y1: number, x2: number, y2: number) => Paint),
  ) => {
    ring.forEach(([x1, y1], j) => {
      const [x2, y2] = ring[(j + 1) % ring.length];
      quad(
        typeof sidePaint === "function" ? sidePaint(x1, y1, x2, y2) : sidePaint,
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

  // The hall's floor, flat under it all, so it stands apart from round it.
  const { heightAt } = arenaHeights(levels);
  const hull = hallFloor(frame);
  const floor = underStands(hull, heightAt);
  const flat = floor.map(([x, y]) => new THREE.Vector2(x, y));
  for (const [a, b, c] of THREE.ShapeUtils.triangulateShape(flat, [])) {
    for (const k of [a, b, c]) {
      triangles.floor.push(...at(floor[k][0], floor[k][1], 0));
    }
  }

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
  // A side with no hall floor past it is the stands' outer wall, painted
  // apart from the steps' fronts so it doesn't read as floor.
  const outerWall = (
    side: Paint,
  ): ((x1: number, y1: number, x2: number, y2: number) => Paint) => {
    return (x1, y1, x2, y2) => {
      const length = Math.hypot(x2 - x1, y2 - y1) || 1;
      const [nx, ny] = [(y2 - y1) / length, (x1 - x2) / length];
      const [mx, my] = [(x1 + x2) / 2, (y1 + y2) / 2];
      const off = OUTER_PROBE;
      const outside =
        !insideRing(hull, mx + nx * off, my + ny * off) ||
        !insideRing(hull, mx - nx * off, my - ny * off);
      return outside ? "tierSide" : side;
    };
  };
  levels.levels.forEach((level, index) => {
    const { part, height } = level;
    const ring = toRing(level);
    const [top, side, shade] = LEVEL_PAINTS[part];
    prism(
      rounded(ring, LEVEL_ROUNDING, LEVEL_CORNER_STEPS),
      0,
      height,
      shaded[index] ? shade : top,
      part === "stair" ? outerWall(side) : side,
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
