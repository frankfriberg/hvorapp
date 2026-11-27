import type { ArenaPalette } from "@shared/arena";
import {
  gridHeight,
  groundHeight,
  type Venue,
  type VenueAreaKind,
  type VenueBuilding,
  type VenuePalette,
} from "@shared/venue";
import * as THREE from "three";
import { TextGeometry } from "three/addons/geometries/TextGeometry.js";
import { type FontData, FontLoader } from "three/addons/loaders/FontLoader.js";
import { atDepth } from "@/lib/pinScene";
import type { FloorView } from "@/lib/tilt";
// Inter Bold's digits (SIL Open Font License 1.1), as three's typeface JSON.
import digits from "./digits.typeface.json";

// A venue's outside map built in 3D: the ground as a map, its areas, roads
// and paths laid over its hills, and each building stood up from it as tall
// as it is,
// in flat colours as the arena is. Coordinates are map heights from the map's
// centre, x east, y north, z up, as `buildArena`'s.

/**
 * What each part is painted with: a colour of the venue's palette, or of the
 * arena's, for an arena's building.
 */
type Paint =
  | keyof Pick<VenuePalette, "roof" | "wall" | "roofAround" | "wallAround">
  | keyof Pick<ArenaPalette, "row" | "rowSide">;

/** Tops and sides: the venue's, what's round it (faded), and an arena's. */
const PAINTS: Record<"venue" | "around" | "arena", [Paint, Paint]> = {
  venue: ["roof", "wall"],
  around: ["roofAround", "wallAround"],
  arena: ["row", "rowSide"],
};

// The ground's parts, in the order they're drawn, each over the ones before
// and all under the buildings: the areas as `venue:build` orders them, then
// paths, then roads over their edges.
const GROUND: (VenueAreaKind | "path" | "roadEdge" | "road")[] = [
  "water",
  "field",
  "grass",
  "wood",
  "sand",
  "paved",
  "parking",
  "pitch",
  "path",
  "roadEdge",
  "road",
];
// How far a road's edge shows past it on each side, in metres.
const ROAD_EDGE = 1;
// The sides a road's rounded joins and ends are drawn with.
const JOIN_SIDES = 8;
// The longest the ground's triangles are, in metres, to follow its hills:
// twice as far as its heights are apart, few enough for a phone.
const DRAPE = 40;

// How much of its own depth a building keeps over where it stands: enough
// for its roof to cover its walls, not enough for a tall roof to cover a pin
// in front of the building, which it leans over.
const DEPTH_KEPT = 0.05;

// A crown's sides: as many as a ball has, near; fewer, round the venue. How
// much lighter its top is, and its side towards the sun, by day; how much
// trees differ from each other.
const CROWN_DETAIL = { venue: 1, around: 0 };
const CROWN_TOP = 0.12;
const CROWN_SUNLIT = 0.2;
const CROWN_SPREAD = 0.16;
// A crown's sides, laid as its shadow.
const CROWN_SHADOW_SIDES = 6;

// How much lighter a wall facing the sun is, and darker one facing away, by
// day; how dark the shadows on the ground are, with the sun high enough.
const SUNLIT = 0.14;
const SHADOW = 0.2;
// Shadows fall where the sun puts them but no longer than with it this high,
// in radians, nor than this many metres: a low winter sun would shade all of
// the map.
const SHADOW_SUN_LOWEST = (20 * Math.PI) / 180;
const SHADOW_LONGEST = 50;

/**
 * Where the sun is, for the buildings' shaders: towards it (x east, y north,
 * z up), and how much it's day (1) or night (0).
 */
type SunUniforms = {
  sunDir: { value: THREE.Vector3 };
  day: { value: number };
};

/**
 * Draws a building at the depth of the ground under each of its points (its
 * `ground` attribute, how high that is), and a little of its own: what
 * stands in front on the ground covers it, as a pin does, at the depth of the
 * point it stands on (`pinScene`). Its walls (`wall`: which way each faces,
 * x, y) lighter towards the sun and darker away.
 */
function byGround<M extends THREE.Material>(
  material: M,
  sun: SunUniforms,
) {
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sun);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      attribute float ground;
      attribute vec2 wall;
      uniform vec3 sunDir;
      uniform float day;
      varying float vShade;`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
      vec4 ground = projectionMatrix * modelViewMatrix * vec4(transformed.xy, ground, 1.0);
      float groundDepth = ground.z / ground.w;
      gl_Position.z = (groundDepth + (gl_Position.z / gl_Position.w - groundDepth) * ${DEPTH_KEPT.toFixed(3)}) * gl_Position.w;
      vec2 toSun = length(sunDir.xy) > 0.0 ? normalize(sunDir.xy) : vec2(0.0);
      vShade = 1.0 + day * ${SUNLIT.toFixed(3)} * dot(wall, toSun);`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying float vShade;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      diffuseColor.rgb *= vShade;`,
      );
  };
  return material;
}

/**
 * Draws trees, each a ball scaled into its crown (instanced), as buildings
 * are: at the depth of the ground under it (its `ground`), shaded lighter on
 * top and towards the sun.
 */
function crownMaterial(sun: SunUniforms) {
  const material = new THREE.MeshBasicMaterial();
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, sun);
    shader.vertexShader = shader.vertexShader
      .replace(
        "#include <common>",
        `#include <common>
      attribute float ground;
      uniform vec3 sunDir;
      uniform float day;
      varying float vShade;`,
      )
      .replace(
        "#include <project_vertex>",
        `#include <project_vertex>
      vec4 base = instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0);
      vec4 under = projectionMatrix * modelViewMatrix * vec4(base.xy, ground, 1.0);
      float groundDepth = under.z / under.w;
      gl_Position.z = (groundDepth + (gl_Position.z / gl_Position.w - groundDepth) * ${DEPTH_KEPT.toFixed(3)}) * gl_Position.w;
      vec3 facing = normalize(position);
      vShade = 1.0 + ${CROWN_TOP.toFixed(3)} * facing.z + day * ${CROWN_SUNLIT.toFixed(3)} * dot(facing, sunDir) - ${(CROWN_TOP / 2).toFixed(3)};`,
      );
    shader.fragmentShader = shader.fragmentShader
      .replace(
        "#include <common>",
        `#include <common>
      varying float vShade;`,
      )
      .replace(
        "#include <color_fragment>",
        `#include <color_fragment>
      diffuseColor.rgb *= vShade;`,
      );
  };
  return material;
}

// A building's number, painted on its roof: how far it stands up from it,
// in metres; and how far in front of the roof it's drawn, behind a pin
// standing there.
const LABEL_RAISED = 0.4;
const LABEL_NEARER = 0.004;
const FONT = new FontLoader().parse(digits as unknown as FontData);

// How much darker a building is while it's pressed.
const PRESSED = 0.8;

/** How a building is painted. */
function kind({ venue, arena }: VenueBuilding) {
  return arena ? "arena" : venue ? "venue" : "around";
}

/**
 * The venue as meshes: the buildings by how they're painted, and each one
 * with an arena on its own, to be tapped (`arenas`); and how to paint them.
 */
export function buildVenue(venue: Venue) {
  const at = (x: number, y: number, z: number) => [
    (x - venue.width / 2) / venue.height,
    (venue.height / 2 - y) / venue.height,
    z / venue.height,
  ];
  const groundAt = groundHeight(venue);

  /**
   * Triangles, as points, how high the ground is under each, and their wall:
   * which way it faces, none on a flat roof.
   */
  type Triangles = { points: number[]; ground: number[]; wall: number[] };
  /** Into `into`, a point of a building, `z` metres up, on `wall`. */
  const put = (
    into: Triangles,
    x: number,
    y: number,
    z: number,
    wall: number[] = [0, 0],
  ) => {
    into.points.push(...at(x, y, z));
    into.ground.push(groundAt(x, y) / venue.height);
    into.wall.push(...wall);
  };
  /**
   * A building's sides and top, into `top` and `sides`: its roof as high
   * over the ground under it as it is tall there, its walls down to the
   * ground at each corner. A roof that isn't flat is laid as its grid says,
   * in pieces no wider than its step, each shaded by which way it faces.
   */
  function prism(
    { ring: flat, height, base, roof }: VenueBuilding,
    top: Triangles,
    sides: Triangles,
  ) {
    const tall = roof ? gridHeight(roof) : () => height;
    const roofAt = (x: number, y: number) => base + tall(x, y);
    const step = roof?.step ?? Infinity;
    const ring: [number, number][] = [];
    for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]]);
    // Which way round it goes: clockwise on the map (y south), outwards is
    // to the left going round; the other way, to the right.
    let area = 0;
    ring.forEach(([x1, y1], j) => {
      const [x2, y2] = ring[(j + 1) % ring.length];
      area += x1 * y2 - x2 * y1;
    });
    const out = area > 0 ? 1 : -1;
    ring.forEach(([x1, y1], j) => {
      const [x2, y2] = ring[(j + 1) % ring.length];
      const length = Math.hypot(x2 - x1, y2 - y1) || 1;
      // Facing, x east and y north, as the scene has them.
      const [nx, ny] = [(out * (y2 - y1)) / length, (out * (x2 - x1)) / length];
      // In halves, as the roof's edge is split, to meet it.
      const pieces = 2 ** Math.max(0, Math.ceil(Math.log2(length / step)));
      for (let k = 0; k < pieces; k++) {
        const [xa, ya] = [
          x1 + ((x2 - x1) * k) / pieces,
          y1 + ((y2 - y1) * k) / pieces,
        ];
        const [xb, yb] = [
          x1 + ((x2 - x1) * (k + 1)) / pieces,
          y1 + ((y2 - y1) * (k + 1)) / pieces,
        ];
        const [ga, gb] = [groundAt(xa, ya), groundAt(xb, yb)];
        const [ra, rb] = [roofAt(xa, ya), roofAt(xb, yb)];
        for (const [x, y, z] of [
          [xa, ya, ga],
          [xb, yb, gb],
          [xb, yb, rb],
          [xa, ya, ga],
          [xb, yb, rb],
          [xa, ya, ra],
        ]) {
          put(sides, x, y, z, [nx, ny]);
        }
      }
    });
    const contour = ring.map(([x, y]) => new THREE.Vector2(x, y));
    const triangles = THREE.ShapeUtils.triangulateShape(contour, []).flatMap(
      (corners) => corners.flatMap((k) => ring[k]),
    );
    split(triangles, step, (t) => {
      const z = [0, 2, 4].map((k) => roofAt(t[k], t[k + 1]));
      // Which way it faces, x east and y north: none, flat.
      const [ux, uy, uz] = [t[2] - t[0], t[1] - t[3], z[1] - z[0]];
      const [vx, vy, vz] = [t[4] - t[0], t[1] - t[5], z[2] - z[0]];
      let [nx, ny, nz] = [
        uy * vz - uz * vy,
        uz * vx - ux * vz,
        ux * vy - uy * vx,
      ];
      if (nz < 0) [nx, ny, nz] = [-nx, -ny, -nz];
      const size = Math.hypot(nx, ny, nz) || 1;
      for (let k = 0; k < 3; k++) {
        put(top, t[2 * k], t[2 * k + 1], z[k], [nx / size, ny / size]);
      }
    });
  }

  /**
   * Flat triangles, as x, y, …, each to `done` as x, y, x, y, x, y: split,
   * the longest side in two, until none is longer than `longest`.
   */
  function split(
    flat: number[],
    longest: number,
    done: (triangle: number[]) => void,
  ) {
    const todo: number[][] = [];
    for (let i = 0; i < flat.length; i += 6) todo.push(flat.slice(i, i + 6));
    for (let t = todo.pop(); t; t = todo.pop()) {
      const [ax, ay, bx, by, cx, cy] = t;
      const sides = [
        Math.hypot(bx - ax, by - ay),
        Math.hypot(cx - bx, cy - by),
        Math.hypot(ax - cx, ay - cy),
      ];
      const most = sides.indexOf(Math.max(...sides));
      if (sides[most] <= longest) {
        done(t);
        continue;
      }
      // Its corners from the longest side's start round: p, q, r.
      const [p, q, r] = [0, 1, 2].map((k) => ((most + k) % 3) * 2);
      const [mx, my] = [(t[p] + t[q]) / 2, (t[p + 1] + t[q + 1]) / 2];
      todo.push(
        [t[p], t[p + 1], mx, my, t[r], t[r + 1]],
        [mx, my, t[q], t[q + 1], t[r], t[r + 1]],
      );
    }
  }

  /**
   * Flat triangles, as x, y, …, laid on the ground into `into`, as points:
   * split until no side is longer than DRAPE, each point as high as the
   * ground is there.
   */
  function drape(flat: number[], into: number[]) {
    split(flat, DRAPE, (t) => {
      for (let k = 0; k < 6; k += 2) {
        into.push(...at(t[k], t[k + 1], groundAt(t[k], t[k + 1])));
      }
    });
  }

  const sun: SunUniforms = {
    sunDir: { value: new THREE.Vector3(0, 0, 1) },
    day: { value: 1 },
  };

  // By paint, and an arena's building's apart, by arena and paint, so it
  // can darken alone as it's pressed.
  const materials = new Map<
    string,
    { paint: Paint; arena?: string; material: THREE.MeshBasicMaterial }
  >();
  const material = (paint: Paint, arena?: string) => {
    const key = `${arena ?? ""} ${paint}`;
    let entry = materials.get(key);
    if (!entry) {
      // Flat colours, both sides: what shows is set by depth alone, by
      // where it stands.
      const value = byGround(
        new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }),
        sun,
      );
      entry = { paint, arena, material: value };
      materials.set(key, entry);
    }
    return entry.material;
  };
  const mesh = (triangles: Triangles, paint: Paint, arena?: string) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(triangles.points, 3),
    );
    geometry.setAttribute(
      "ground",
      new THREE.Float32BufferAttribute(triangles.ground, 1),
    );
    geometry.setAttribute(
      "wall",
      new THREE.Float32BufferAttribute(triangles.wall, 2),
    );
    return new THREE.Mesh(geometry, material(paint, arena));
  };

  const group = new THREE.Group();

  // The ground: flat triangles, as x, y, …, laid on its hills as it's drawn,
  // first in order without depth, so the buildings standing on it cover it
  // from any side.
  const ground = Object.fromEntries(
    GROUND.map((part) => [part, [] as number[]]),
  ) as Record<(typeof GROUND)[number], number[]>;
  // Laid on the ground, as points, and water flat at its level.
  const laid = Object.fromEntries(
    GROUND.map((part) => [part, [] as number[]]),
  ) as Record<(typeof GROUND)[number], number[]>;
  const ring = (flat: number[]) => {
    const points: THREE.Vector2[] = [];
    for (let i = 0; i < flat.length; i += 2) {
      points.push(new THREE.Vector2(flat[i], flat[i + 1]));
    }
    return points;
  };
  for (const { kind: part, rings, level } of venue.areas) {
    const [outer, ...holes] = rings.map(ring);
    const all = [outer, ...holes].flat();
    for (const triangle of THREE.ShapeUtils.triangulateShape(outer, holes)) {
      for (const k of triangle) {
        if (level === undefined) ground[part].push(all[k].x, all[k].y);
        else laid[part].push(...at(all[k].x, all[k].y, level));
      }
    }
  }
  /** A line `width` across into `into`: a band along each piece, round at each point. */
  const band = (line: number[], width: number, into: number[]) => {
    const r = width / 2;
    for (let i = 0; i < line.length; i += 2) {
      const [x, y] = [line[i], line[i + 1]];
      for (let k = 0; k < JOIN_SIDES; k++) {
        const [a, b] = [k, k + 1].map((n) => (n / JOIN_SIDES) * 2 * Math.PI);
        into.push(
          x,
          y,
          x + r * Math.cos(a),
          y + r * Math.sin(a),
          x + r * Math.cos(b),
          y + r * Math.sin(b),
        );
      }
      if (i + 3 >= line.length) continue;
      const [nx, ny] = [line[i + 2], line[i + 3]];
      const length = Math.hypot(nx - x, ny - y) || 1;
      const [ox, oy] = [(-(ny - y) / length) * r, ((nx - x) / length) * r];
      const [p, q, s, t] = [
        [x + ox, y + oy],
        [nx + ox, ny + oy],
        [nx - ox, ny - oy],
        [x - ox, y - oy],
      ];
      into.push(...p, ...q, ...s, ...p, ...s, ...t);
    }
  };
  for (const { kind: part, width, line } of venue.ways) {
    if (part === "road") {
      band(line, width + 2 * ROAD_EDGE, ground.roadEdge);
      band(line, width, ground.road);
    } else band(line, width, ground.path);
  }
  const groundMaterials = {} as Record<
    (typeof GROUND)[number],
    THREE.MeshBasicMaterial
  >;
  GROUND.forEach((part, index) => {
    const material = new THREE.MeshBasicMaterial({
      side: THREE.DoubleSide,
      depthTest: false,
      depthWrite: false,
    });
    groundMaterials[part] = material;
    drape(ground[part], laid[part]);
    if (!laid[part].length) return;
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(laid[part], 3),
    );
    const flat = new THREE.Mesh(geometry, material);
    // Before the buildings, in order.
    flat.renderOrder = index - GROUND.length;
    group.add(flat);
  });
  // The rest merged by how they're painted: a few meshes for hundreds.
  const triangles = (): Triangles => ({ points: [], ground: [], wall: [] });
  const merged = {
    venue: { top: triangles(), sides: triangles() },
    around: { top: triangles(), sides: triangles() },
  };
  const arenas: THREE.Mesh[] = [];
  for (const building of venue.buildings) {
    const paints = PAINTS[kind(building)];
    if (building.arena) {
      const [top, sides] = [triangles(), triangles()];
      prism(building, top, sides);
      const shape = new THREE.Group();
      shape.add(
        mesh(top, paints[0], building.arena),
        mesh(sides, paints[1], building.arena),
      );
      for (const part of shape.children) {
        part.userData.arena = building.arena;
        arenas.push(part as THREE.Mesh);
      }
      group.add(shape);
    } else {
      const into = merged[building.venue ? "venue" : "around"];
      prism(building, into.top, into.sides);
    }
  }
  for (const [which, { top, sides }] of Object.entries(merged)) {
    const [topPaint, sidePaint] = PAINTS[which as keyof typeof merged];
    group.add(mesh(top, topPaint), mesh(sides, sidePaint));
  }

  // The trees: a ball each, scaled to its crown, its top as high as the tree
  // is; a few shades of the trees' colour.
  /** A crown's middle and radii, in metres, from x, y, height, radius. */
  const crownOf = (tall: number, radius: number) => {
    const deep = Math.min(radius * 1.1, tall / 2);
    return { middle: tall - deep, deep };
  };
  const crownMaterials = {
    venue: crownMaterial(sun),
    around: crownMaterial(sun),
  };
  const crown = new THREE.Object3D();
  const shadeOf = new THREE.Color();
  for (const which of ["venue", "around"] as const) {
    const list = venue.trees[which];
    const count = list.length / 4;
    if (!count) continue;
    const ball = new THREE.IcosahedronGeometry(1, CROWN_DETAIL[which]);
    const grounds = new Float32Array(count);
    const trees = new THREE.InstancedMesh(ball, crownMaterials[which], count);
    for (let i = 0; i < count; i++) {
      const [x, y, tall, radius] = list.slice(i * 4, i * 4 + 4);
      const under = groundAt(x, y);
      const { middle, deep } = crownOf(tall, radius);
      crown.position.set(
        ...(at(x, y, under + middle) as [number, number, number]),
      );
      crown.scale.set(radius, radius, deep).divideScalar(venue.height);
      crown.updateMatrix();
      trees.setMatrixAt(i, crown.matrix);
      grounds[i] = under / venue.height;
      // Between darker and lighter, the same each time it's built.
      const spread = (Math.sin(i * 12.9898) * 43758.5453) % 1;
      shadeOf.setScalar(1 - CROWN_SPREAD / 2 + CROWN_SPREAD * Math.abs(spread));
      trees.setColorAt(i, shadeOf);
    }
    ball.setAttribute("ground", new THREE.InstancedBufferAttribute(grounds, 1));
    // Its box is the ball's, not the trees': drawn wherever they are.
    trees.frustumCulled = false;
    group.add(trees);
  }

  // The buildings' shadows on the ground: each one's outline, and the
  // ground it shades, laid away from the sun as far as it's tall, worked out
  // again as the sun moves. Drawn with the ground, after the rest of it and
  // before the buildings, darkening it once where they overlap.
  const footprints = venue.buildings.map(({ ring: flat, height, roof }) => {
    const tallAt = roof ? gridHeight(roof) : () => height;
    const ring: [number, number][] = [];
    for (let i = 0; i < flat.length; i += 2) ring.push([flat[i], flat[i + 1]]);
    const contour = ring.map(([x, y]) => new THREE.Vector2(x, y));
    return {
      ring,
      // How tall at each corner.
      tall: ring.map(([x, y]) => tallAt(x, y)),
      triangles: THREE.ShapeUtils.triangulateShape(contour, []),
    };
  });
  const shadowMaterial = new THREE.MeshBasicMaterial({
    color: 0x000000,
    side: THREE.DoubleSide,
    depthTest: false,
    depthWrite: false,
    // Blended, but drawn in order with the ground, not after the buildings.
    blending: THREE.CustomBlending,
    blendSrc: THREE.SrcAlphaFactor,
    blendDst: THREE.OneMinusSrcAlphaFactor,
    // Where there's shadow already, no more.
    stencilWrite: true,
    stencilRef: 1,
    stencilFunc: THREE.NotEqualStencilFunc,
    stencilZPass: THREE.ReplaceStencilOp,
  });
  const shadows = new THREE.Mesh(new THREE.BufferGeometry(), shadowMaterial);
  shadows.renderOrder = -0.5;
  shadows.frustumCulled = false;
  group.add(shadows);
  /** Lays the shadows away from the sun, `reach` metres per metre tall. */
  function castShadows(azimuth: number, reach: number) {
    // Away from the sun, on the map: x east, y south.
    const [ax, ay] = [-Math.sin(azimuth), Math.cos(azimuth)];
    const points: number[] = [];
    const ground = (x: number, y: number) =>
      points.push(...at(x, y, groundAt(x, y)));
    for (const { ring, tall, triangles: inside } of footprints) {
      // Each corner moved as far as its roof's shadow falls.
      const moved = ring.map(([x, y], k) => {
        const length = Math.min(tall[k] * reach, SHADOW_LONGEST);
        return [x + ax * length, y + ay * length];
      });
      for (const triangle of inside) {
        for (const k of triangle) ground(moved[k][0], moved[k][1]);
      }
      // And what's between: each wall swept along.
      ring.forEach(([x1, y1], j) => {
        const next = (j + 1) % ring.length;
        const [x2, y2] = ring[next];
        const [[x3, y3], [x4, y4]] = [moved[next], moved[j]];
        ground(x1, y1);
        ground(x2, y2);
        ground(x3, y3);
        ground(x1, y1);
        ground(x3, y3);
        ground(x4, y4);
      });
    }
    // The venue's trees': each crown's outline, from where its bottom's
    // shadow falls to where its top's does.
    const sides = Array.from({ length: CROWN_SHADOW_SIDES }, (_, k) => {
      const angle = (k / CROWN_SHADOW_SIDES) * 2 * Math.PI;
      return [Math.cos(angle), Math.sin(angle)];
    });
    const list = venue.trees.venue;
    for (let i = 0; i < list.length; i += 4) {
      const [x, y, tall, radius] = list.slice(i, i + 4);
      const { middle, deep } = crownOf(tall, radius);
      const near = Math.min((middle - deep) * reach, SHADOW_LONGEST);
      const far = Math.min((middle + deep) * reach, SHADOW_LONGEST);
      const ring = (along: number) =>
        sides.map(([cx, cy]) => [
          x + ax * along + cx * radius,
          y + ay * along + cy * radius,
        ]);
      const [from, to] = [ring(near), ring(far)];
      for (const outline of [from, to]) {
        for (let k = 1; k < outline.length - 1; k++) {
          ground(outline[0][0], outline[0][1]);
          ground(outline[k][0], outline[k][1]);
          ground(outline[k + 1][0], outline[k + 1][1]);
        }
      }
      from.forEach(([x1, y1], k) => {
        const next = (k + 1) % from.length;
        const [x2, y2] = from[next];
        const [x3, y3] = to[next];
        const [x4, y4] = to[k];
        ground(x1, y1);
        ground(x2, y2);
        ground(x3, y3);
        ground(x1, y1);
        ground(x3, y3);
        ground(x4, y4);
      });
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute(
      "position",
      new THREE.Float32BufferAttribute(points, 3),
    );
    shadows.geometry.dispose();
    shadows.geometry = geometry;
  }

  // The buildings' numbers, painted on their roofs along the way each
  // block runs, as big as the roof is wide, and drawn at the depth of the
  // point they're on. Their faces and their sides, as TextGeometry groups
  // them.
  const labelMaterials: [THREE.MeshBasicMaterial, THREE.MeshBasicMaterial][] =
    [];
  const labels = venue.buildings.flatMap(({ label, base }) => {
    if (!label) return [];
    const geometry = new TextGeometry(label.text, {
      font: FONT,
      size: label.size / venue.height,
      depth: LABEL_RAISED / venue.height,
      curveSegments: 4,
    });
    geometry.computeBoundingBox();
    const box = geometry.boundingBox as THREE.Box3;
    // Centred on the point, standing on the roof.
    geometry.translate(
      -(box.min.x + box.max.x) / 2,
      -(box.min.y + box.max.y) / 2,
      0,
    );
    const depth = { value: 0 };
    const faces = atDepth(new THREE.MeshBasicMaterial(), depth, LABEL_NEARER);
    const sides = atDepth(new THREE.MeshBasicMaterial(), depth, LABEL_NEARER);
    labelMaterials.push([faces, sides]);
    const root = new THREE.Mesh(geometry, [faces, sides]);
    root.position.set(
      ...(at(label.x, label.y, base + label.roof) as [number, number, number]),
    );
    // Tipped up along the roof's slope, then turned: the map's angle is
    // clockwise, y south; the scene's, y north.
    root.rotation.order = "ZYX";
    return [{ root, depth, angle: -label.angle, tip: -Math.atan(label.slope) }];
  });
  const labelLayer = new THREE.Group();
  for (const { root } of labels) labelLayer.add(root);
  group.add(labelLayer);
  const seen = new THREE.Vector3();

  let palette: ArenaPalette | null = null;
  let groundPalette: VenuePalette | null = null;
  let pressed: string | null = null;
  function paint() {
    if (groundPalette) {
      for (const part of GROUND) {
        groundMaterials[part].color.set(groundPalette[part]);
      }
    }
    if (groundPalette) {
      crownMaterials.venue.color.set(groundPalette.tree);
      crownMaterials.around.color.set(groundPalette.treeAround);
      for (const [faces, sides] of labelMaterials) {
        faces.color.set(groundPalette.label);
        sides.color.set(groundPalette.labelSide);
      }
    }
    if (!palette || !groundPalette) return;
    for (const { paint: name, arena, material: value } of materials.values()) {
      value.color.set(
        name === "row" || name === "rowSide"
          ? palette[name]
          : groundPalette[name],
      );
      if (arena && arena === pressed) value.color.multiplyScalar(PRESSED);
    }
  }

  return {
    group,
    arenas,
    /** Paints its buildings in `colours`, the ground in `map`'s. */
    paint(colours: ArenaPalette, map: VenuePalette) {
      palette = colours;
      groundPalette = map;
      paint();
    },
    /** Shows the buildings' numbers, or hides them. */
    showLabels(shown: boolean) {
      labelLayer.visible = shown;
    },
    /**
     * Lights it by the sun, `azimuth` clockwise from north and `altitude`
     * over the horizon, in radians: its shadows and the walls facing it.
     */
    sun({ azimuth, altitude }: { azimuth: number; altitude: number }) {
      const towards = new THREE.Vector3(
        Math.sin(azimuth) * Math.cos(altitude),
        Math.cos(azimuth) * Math.cos(altitude),
        Math.sin(altitude),
      );
      sun.sunDir.value.copy(towards);
      // Day from just over the horizon, night from a little under it.
      const height = Math.sin(altitude);
      sun.day.value = THREE.MathUtils.smoothstep(height, -0.05, 0.05);
      // Shadows fade in as it clears the trees round the horizon.
      const shade = THREE.MathUtils.smoothstep(height, 0.01, 0.08);
      shadows.visible = shade > 0;
      shadowMaterial.opacity = SHADOW * shade;
      if (shade > 0) {
        castShadows(
          azimuth,
          1 / Math.tan(Math.max(altitude, SHADOW_SUN_LOWEST)),
        );
      }
    },
    /**
     * Turns the numbers end for end where the map's turn would have them
     * upside down, before the scene's updated.
     */
    place(view: FloorView) {
      const turn = (view.turn * Math.PI) / 180;
      for (const { root, angle, tip } of labels) {
        // End for end, its other end is the one that's up the slope.
        const flipped = Math.cos(angle - turn) < 0;
        root.rotation.z = flipped ? angle + Math.PI : angle;
        root.rotation.y = flipped ? -tip : tip;
      }
    },
    /** Sets each number's depth, seen by `camera`, once the scene's updated. */
    aim(camera: THREE.Camera) {
      if (!labelLayer.visible) return;
      for (const { root, depth } of labels) {
        root.getWorldPosition(seen);
        depth.value = seen.project(camera).z;
      }
    },
    /** Darkens the building with `arena` in it, while pressed; null for none. */
    press(arena: string | null) {
      pressed = arena;
      paint();
    },
    dispose() {
      group.traverse((child) => {
        if (child instanceof THREE.Mesh) child.geometry.dispose();
      });
      for (const { material: value } of materials.values()) value.dispose();
      for (const value of Object.values(groundMaterials)) value.dispose();
      for (const value of labelMaterials.flat()) value.dispose();
      shadowMaterial.dispose();
      crownMaterials.venue.dispose();
      crownMaterials.around.dispose();
    },
  };
}
