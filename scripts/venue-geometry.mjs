// Builds a venue's outside map, `shared/venues/<name>.ts`, from open data:
//
//   npm run venue:build -- brunstad
//
// Building outlines come from OpenStreetMap (Overpass API), their heights
// from Kartverket's laser-scanned height models: the surface (DOM, roofs and
// all) less the bare ground (DTM), measured inside each outline. Downloads
// are kept in `.cache/venues/<name>/`; delete it to fetch them again.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fromArrayBuffer } from "geotiff";
import proj4 from "proj4";

/**
 * Each venue: the point it's around and how far, in metres, to fetch; its
 * map's edge, its north-west and south-east corners as [lat, lon]; the
 * outline, as [lat, lon], of what's around it but not part of it, drawn but
 * faded; the buildings that open an arena, by OpenStreetMap id; and the
 * labels on buildings, by the same, as their signs have them.
 */
const VENUES = {
  brunstad: {
    // Oslofjord Convention Center, as OpenStreetMap has it.
    centre: [59.2266, 10.3632],
    radius: 1200,
    bounds: [
      [59.232602, 10.353987],
      [59.224115, 10.373131],
    ],
    around: [
      [59.227132, 10.353525],
      [59.227028, 10.354742],
      [59.226961, 10.355366],
      [59.227492, 10.356904],
      [59.228235, 10.357892],
      [59.228807, 10.358373],
      [59.229511, 10.358439],
      [59.230084, 10.358443],
      [59.230424, 10.359282],
      [59.230456, 10.35988],
      [59.229506, 10.361226],
      [59.229645, 10.360797],
      [59.228549, 10.359486],
      [59.22783, 10.360287],
      [59.227515, 10.362103],
      [59.226726, 10.361714],
      [59.225533, 10.361924],
      [59.224806, 10.362753],
      [59.224255, 10.36371],
      [59.223943, 10.365277],
      [59.223713, 10.366479],
      [59.223317, 10.366901],
      [59.222523, 10.366893],
      [59.221464, 10.36835],
      [59.220111, 10.364433],
    ],
    // The convention centre's main building, which salen is in.
    arenas: { w661149968: "salen" },
    // Where OpenStreetMap's outline takes in more than the building: cut
    // straight across, from one corner of it to another, [lat, lon]. Salen's
    // takes in the terrace at its south-west end, only steps up from the
    // ground in the scan.
    cuts: {
      w661149968: [
        [59.2278089, 10.3642661],
        [59.2277229, 10.3648306],
      ],
    },
    // The hotel's blocks, odd numbers east of the road down the middle.
    labels: {
      w954080798: "1",
      w871753078: "2",
      w954080797: "3",
      w954081641: "4",
      w954080796: "5",
      w954081642: "6",
      w954080795: "7",
      w954081643: "8",
      w871753017: "10",
      w871753077: "12",
      w954081655: "14",
      w871753076: "16",
      w871753075: "18",
      w871753074: "20",
      w871753073: "22",
      w871753072: "24",
    },
  },
};

// Kartverket's height models are in UTM zone 33 (EPSG:25833), in metres.
const UTM = "+proj=utm +zone=33 +ellps=GRS80 +units=m +no_defs";
// How far in from an outline's edge heights are measured, in metres: the
// edge itself falls half on the ground.
const INSET = 1;
// The lowest a building stands, in metres: sheds the scan barely sees.
const MIN_HEIGHT = 2;
// A roof that isn't flat, as the hotel's blocks down the hill and Salen's
// aren't: how far round a point its height is read, in metres; how far
// apart it's read, over a grid; and how much it has to rise from its lowest
// to its highest to be anything but flat.
const ROOF_NEAR = 3;
const ROOF_STEP = 3;
const ROOF_SLOPED = 2.5;
// How far apart the ground's height is given, in metres.
const TERRAIN_STEP = 20;
// How far water lies under the ground at its edge, in metres.
const WATER_BELOW = 2;
// Trees, from the laser scan: what stands at least TREE_LOWEST metres over
// the ground clear of the buildings, a tree at the top of each crown, no two
// closer than TREE_APART; how far past the map's edge they're found, and the
// least a crown's radius is to be a tree and the most it's taken to be, in
// metres.
// A block's number, painted on its roof: how far round the label its outline
// is taken for which way it runs, in metres; what share of the roof's width
// (and length) the digits take; and a digit's width, in its heights.
const LABEL_NEAR = 12;
const LABEL_SHARE = 0.6;
const LABEL_EM = 0.62;

// A building the scan has and OpenStreetMap hasn't: how high it stands at
// least, in metres; how far its roof can bend over a metre (up a metre on
// one side and down one on the other is 2); how big it is at least, in
// square metres; and how far its outline can be off straight.
const UNMAPPED_LOWEST = 3;
const UNMAPPED_BEND = 1;
const UNMAPPED_AREA = 300;
const UNMAPPED_STRAIGHT = 1.5;

const TREE_LOWEST = 2.5;
const TREE_APART = 3;
const TREE_PAST = 100;
const CROWN = [1.5, 7];
const CREDIT = "© OpenStreetMap contributors (ODbL), © Kartverket (CC BY 4.0)";

/** Whether a point is inside a ring of [x, y]. */
function inside([x, y], ring) {
  let within = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[i];
    const [x2, y2] = ring[j];
    if (y1 > y !== y2 > y && x < x1 + ((y - y1) * (x2 - x1)) / (y2 - y1)) {
      within = !within;
    }
  }
  return within;
}

/** How far a point is from a ring's nearest edge. */
function toEdge([x, y], ring) {
  let nearest = Infinity;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [x1, y1] = ring[j];
    const [x2, y2] = ring[i];
    const [dx, dy] = [x2 - x1, y2 - y1];
    const t = Math.max(
      0,
      Math.min(1, ((x - x1) * dx + (y - y1) * dy) / (dx * dx + dy * dy || 1)),
    );
    nearest = Math.min(nearest, Math.hypot(x - x1 - t * dx, y - y1 - t * dy));
  }
  return nearest;
}

/**
 * A ring cut straight across between its corners nearest the two points of
 * `across`: the bigger side kept, and the other, cut away; the ring as it
 * is without them.
 */
function cut(ring, across) {
  if (!across) return { kept: ring, away: null };
  // Without its closing corner, the same as its first.
  const open = ring.slice(0, -1);
  const [i, j] = across
    .map(([x, y]) =>
      open.reduce(
        (best, [cx, cy], k) =>
          Math.hypot(cx - x, cy - y) <
          Math.hypot(open[best][0] - x, open[best][1] - y)
            ? k
            : best,
        0,
      ),
    )
    .sort((a, b) => a - b);
  const area = (points) =>
    Math.abs(
      points.reduce((sum, [x1, y1], k) => {
        const [x2, y2] = points[(k + 1) % points.length];
        return sum + x1 * y2 - x2 * y1;
      }, 0),
    );
  const inner = open.slice(i, j + 1);
  const outer = [...open.slice(j), ...open.slice(0, i + 1)];
  const [kept, away] =
    area(inner) > area(outer) ? [inner, outer] : [outer, inner];
  return { kept: [...kept, kept[0]], away: [...away, away[0]] };
}

/** The value `share` of the way up some numbers. */
function percentile(values, share) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.floor(share * sorted.length))];
}

/** A file, downloaded once into `cache`. */
async function cached(cache, file, url, init) {
  const path = join(cache, file);
  if (!existsSync(path)) {
    const response = await fetch(url, {
      ...init,
      headers: { "User-Agent": "hvor venue:build" },
    });
    if (!response.ok) throw new Error(`${url}: ${response.status}`);
    writeFileSync(path, Buffer.from(await response.arrayBuffer()));
  }
  return readFileSync(path);
}

/** The buildings round a point, as OpenStreetMap has them. */
async function outlines(cache, [lat, lon], radius) {
  const query = `[out:json][timeout:100];(way["building"](around:${radius},${lat},${lon});way["building:part"](around:${radius},${lat},${lon});relation["building"](around:${radius},${lat},${lon}););out geom tags;`;
  const json = await cached(
    cache,
    `osm-${radius}.json`,
    "https://overpass-api.de/api/interpreter",
    { method: "POST", body: new URLSearchParams({ data: query }) },
  );
  return JSON.parse(json.toString()).elements.flatMap((element) => {
    const rings =
      element.type === "way"
        ? [element.geometry]
        : (element.members ?? [])
            .filter(({ role, geometry }) => role === "outer" && geometry)
            .map(({ geometry }) => geometry);
    return rings
      .filter((ring) => ring && ring.length >= 3)
      .map((ring) => ({
        id: `${element.type[0]}${element.id}`,
        lonLat: ring.map(({ lon, lat }) => [lon, lat]),
      }));
  });
}

// How far past the map's edge its ground and buildings go, in metres: as far
// as the map seen zoomed out its furthest, slid to its edge, shows.
const AROUND = 1000;

// What the ground is, by OpenStreetMap tag: the kinds of area drawn under
// the buildings, the first that matches.
const AREAS = [
  [
    "water",
    {
      natural: ["water"],
      waterway: ["riverbank"],
      landuse: ["reservoir", "basin"],
      leisure: ["marina"],
    },
  ],
  ["sand", { natural: ["beach", "sand"] }],
  // Squares and paved areas; the rest of the open ground is drawn as grass.
  [
    "paved",
    {
      highway: ["pedestrian", "footway", "service", "living_street", "path"],
      "area:highway": [
        "pedestrian",
        "footway",
        "service",
        "residential",
        "unclassified",
        "tertiary",
        "path",
        "cycleway",
      ],
      place: ["square"],
    },
  ],
  ["wood", { natural: ["wood", "scrub"], landuse: ["forest"] }],
  ["pitch", { leisure: ["pitch", "playground", "track"] }],
  ["parking", { amenity: ["parking"] }],
  ["field", { landuse: ["farmland"] }],
  [
    "grass",
    {
      landuse: ["grass", "meadow", "village_green", "recreation_ground"],
      leisure: ["park", "garden", "common", "golf_course"],
      natural: ["grassland", "heath"],
    },
  ],
];
// The order areas are drawn in, each over the ones before: the sea and the
// fields under all, a beach over the sea, a pitch over a park.
const UNDER = [
  "water",
  "field",
  "grass",
  "wood",
  "sand",
  "paved",
  "parking",
  "pitch",
];
// Roads and paths by OpenStreetMap's highway tag, and how wide, in metres.
const WAYS = {
  road: {
    primary: 10,
    secondary: 9,
    tertiary: 8,
    unclassified: 6,
    residential: 6,
    living_street: 5,
    service: 4.5,
  },
  path: {
    pedestrian: 4,
    track: 3,
    cycleway: 2.5,
    footway: 2,
    path: 1.5,
    steps: 2,
    bridleway: 2,
  },
};

/** The kind of area an OpenStreetMap element is, or null. */
function areaKind(tags = {}) {
  for (const [kind, match] of AREAS) {
    if (
      Object.entries(match).some(([key, values]) => values.includes(tags[key]))
    ) {
      return kind;
    }
  }
  return null;
}

/** Lines joined end to end into closed rings, as [lon, lat]. */
function stitch(lines) {
  const key = ([x, y]) => `${x},${y}`;
  const rest = lines.map((line) => [...line]);
  const rings = [];
  while (rest.length) {
    const ring = rest.shift();
    while (key(ring[0]) !== key(ring.at(-1))) {
      const end = key(ring.at(-1));
      const next = rest.findIndex(
        (line) => key(line[0]) === end || key(line.at(-1)) === end,
      );
      if (next < 0) break;
      const [line] = rest.splice(next, 1);
      ring.push(...(key(line[0]) === end ? line : line.reverse()).slice(1));
    }
    if (ring.length >= 4 && key(ring[0]) === key(ring.at(-1))) rings.push(ring);
  }
  return rings;
}

/** A ring cut to the box from 0, 0 to `width`, `height` (Sutherland–Hodgman). */
function clipRing(ring, width, height) {
  const edges = [
    [
      ([x]) => x >= 0,
      ([x1, y1], [x2, y2]) => [0, y1 + ((0 - x1) * (y2 - y1)) / (x2 - x1)],
    ],
    [
      ([x]) => x <= width,
      ([x1, y1], [x2, y2]) => [
        width,
        y1 + ((width - x1) * (y2 - y1)) / (x2 - x1),
      ],
    ],
    [
      ([, y]) => y >= 0,
      ([x1, y1], [x2, y2]) => [x1 + ((0 - y1) * (x2 - x1)) / (y2 - y1), 0],
    ],
    [
      ([, y]) => y <= height,
      ([x1, y1], [x2, y2]) => [
        x1 + ((height - y1) * (x2 - x1)) / (y2 - y1),
        height,
      ],
    ],
  ];
  let points = ring;
  for (const [keep, cross] of edges) {
    const next = [];
    points.forEach((point, i) => {
      const before = points[(i + points.length - 1) % points.length];
      if (keep(point)) {
        if (!keep(before)) next.push(cross(before, point));
        next.push(point);
      } else if (keep(before)) next.push(cross(before, point));
    });
    points = next;
    if (!points.length) break;
  }
  return points;
}

/** A line cut to the box, as the pieces of it inside (Liang–Barsky). */
function clipLine(line, width, height) {
  const pieces = [];
  let piece = [];
  for (let i = 1; i < line.length; i++) {
    const [[x1, y1], [x2, y2]] = [line[i - 1], line[i]];
    const [dx, dy] = [x2 - x1, y2 - y1];
    let [t0, t1] = [0, 1];
    const sides = [
      [-dx, x1],
      [dx, width - x1],
      [-dy, y1],
      [dy, height - y1],
    ];
    let out = false;
    for (const [p, q] of sides) {
      if (p === 0) {
        if (q < 0) out = true;
      } else {
        const t = q / p;
        if (p < 0) t0 = Math.max(t0, t);
        else t1 = Math.min(t1, t);
      }
    }
    if (out || t0 > t1) {
      if (piece.length > 1) pieces.push(piece);
      piece = [];
      continue;
    }
    const a = [x1 + t0 * dx, y1 + t0 * dy];
    const b = [x1 + t1 * dx, y1 + t1 * dy];
    if (!piece.length) piece.push(a);
    piece.push(b);
    if (t1 < 1) {
      pieces.push(piece);
      piece = [];
    }
  }
  if (piece.length > 1) pieces.push(piece);
  return pieces;
}

/**
 * The map under the buildings round a point, as OpenStreetMap has it: areas
 * (as rings of [lon, lat], the first outer and the rest holes in it) and
 * roads and paths (as lines).
 */
async function mapAround(cache, [lat, lon], radius) {
  const near = `(around:${radius},${lat},${lon})`;
  const query = `[out:json][timeout:100];(way["highway"]${near};nwr["landuse"]${near};nwr["natural"]${near};nwr["leisure"]${near};nwr["amenity"="parking"]${near};nwr["waterway"="riverbank"]${near};relation["highway"]${near};nwr["area:highway"]${near};nwr["place"="square"]${near};);out geom tags;`;
  const json = await cached(
    cache,
    `map-${radius}-v2.json`,
    "https://overpass-api.de/api/interpreter",
    { method: "POST", body: new URLSearchParams({ data: query }) },
  );
  const areas = [];
  const ways = [];
  const coast = [];
  const lonLat = (geometry) => geometry.map(({ lon, lat }) => [lon, lat]);
  for (const element of JSON.parse(json.toString()).elements) {
    const tags = element.tags ?? {};
    const highway = tags.highway;
    if (element.type === "way" && highway && tags.area !== "yes") {
      for (const [kind, widths] of Object.entries(WAYS)) {
        if (widths[highway]) {
          ways.push({
            kind,
            width: widths[highway],
            line: lonLat(element.geometry),
          });
        }
      }
      continue;
    }
    if (tags.natural === "coastline" && element.type === "way") {
      coast.push(lonLat(element.geometry));
      continue;
    }
    const kind = areaKind(tags);
    if (!kind) continue;
    if (element.type === "way") {
      const ring = lonLat(element.geometry);
      if (ring.length >= 4) areas.push({ kind, rings: [ring] });
    } else if (element.type === "relation") {
      const members = (element.members ?? []).filter(
        ({ geometry }) => geometry,
      );
      const outers = stitch(
        members
          .filter(({ role }) => role !== "inner")
          .map(({ geometry }) => lonLat(geometry)),
      );
      const inners = stitch(
        members
          .filter(({ role }) => role === "inner")
          .map(({ geometry }) => lonLat(geometry)),
      );
      for (const outer of outers) {
        areas.push({
          kind,
          rings: [outer, ...inners.filter((ring) => inside(ring[0], outer))],
        });
      }
    }
  }
  return { areas, ways, coast };
}

/** Lines joined where one ends and the next begins, as the coast's are. */
function chain(lines) {
  const key = ([x, y]) => `${x},${y}`;
  const rest = lines.map((line) => [...line]);
  const chains = [];
  while (rest.length) {
    const line = rest.shift();
    for (let joined = true; joined; ) {
      joined = false;
      const after = rest.findIndex((next) => key(next[0]) === key(line.at(-1)));
      if (after >= 0) {
        line.push(...rest.splice(after, 1)[0].slice(1));
        joined = true;
      }
      const before = rest.findIndex(
        (next) => key(next.at(-1)) === key(line[0]),
      );
      if (before >= 0) {
        line.unshift(...rest.splice(before, 1)[0].slice(0, -1));
        joined = true;
      }
    }
    chains.push(line);
  }
  return chains;
}

/**
 * The sea in the box from 0, 0 to `width`, `height`, from the coast's pieces
 * on it: each closed round the box's edge on the side away from `land`.
 */
function sea(pieces, width, height, land) {
  // How far round the box's edge a point on it is, clockwise from its
  // top-left corner (y down).
  const perimeter = 2 * (width + height);
  const along = ([x, y]) => {
    const near = Math.min(y, width - x, height - y, x);
    if (near === y) return x;
    if (near === width - x) return width + y;
    if (near === height - y) return width + height + (width - x);
    return 2 * width + height + (height - y);
  };
  const corners = [
    [[width, 0], width],
    [[width, height], width + height],
    [[0, height], 2 * width + height],
    [[0, 0], 0],
  ];
  /** The box's corners from one point on its edge to another, one way round. */
  const round = (from, to, clockwise) => {
    const [a, b] = [along(from), along(to)];
    const gone = (at) =>
      clockwise
        ? (at - a + perimeter) % perimeter
        : (a - at + perimeter) % perimeter;
    const span = gone(b);
    return corners
      .map(([point, at]) => ({ point, gone: gone(at) }))
      .filter(({ gone: g }) => g > 0 && g < span)
      .sort((p, q) => p.gone - q.gone)
      .map(({ point }) => point);
  };
  const onEdge = ([x, y]) => Math.min(x, y, width - x, height - y) < 0.01;
  return pieces.flatMap((piece) => {
    const [first, last] = [piece[0], piece.at(-1)];
    if (!onEdge(first) || !onEdge(last)) return [];
    return [true, false]
      .map((clockwise) => [...piece, ...round(last, first, clockwise)])
      .filter((ring) => !inside(land, ring))
      .slice(0, 1);
  });
}

// How big a piece of a height model is fetched at a time, in metres: more
// at once and Geonorge times out.
const TILE = 1000;

/** A Kartverket height model over a box in UTM, a metre a pixel. */
async function heights(cache, model, [minX, minY, maxX, maxY]) {
  // In tiles on a grid of TILE metres, each fetched once.
  const tiles = new Map();
  for (let tx = Math.floor(minX / TILE); tx * TILE < maxX; tx++) {
    for (let ty = Math.floor(minY / TILE); ty * TILE < maxY; ty++) {
      const [x0, y0] = [tx * TILE, ty * TILE];
      const url =
        `https://wcs.geonorge.no/skwms1/wcs.hoyde-${model}-nhm-25833?service=WCS&version=1.0.0` +
        `&request=GetCoverage&coverage=nhm_${model}_topo_25833&crs=EPSG:25833&format=GeoTIFF` +
        `&bbox=${x0},${y0},${x0 + TILE},${y0 + TILE}&width=${TILE}&height=${TILE}`;
      const tiff = await fromArrayBuffer(
        new Uint8Array(await cached(cache, `${model}-${x0}-${y0}.tif`, url))
          .buffer,
      );
      const image = await tiff.getImage();
      const [values] = await image.readRasters();
      const [originX, originY] = image.getOrigin();
      const [stepX, stepY] = image.getResolution();
      tiles.set(`${tx} ${ty}`, {
        values,
        originX,
        originY,
        stepX,
        stepY,
        nodata: image.getGDALNoData(),
        columns: image.getWidth(),
        rows: image.getHeight(),
      });
    }
  }
  /** The height at a point, or NaN off the map or where there's none. */
  return ([x, y]) => {
    const tile = tiles.get(`${Math.floor(x / TILE)} ${Math.floor(y / TILE)}`);
    if (!tile) return NaN;
    const { values, originX, originY, stepX, stepY, nodata, columns, rows } =
      tile;
    const column = Math.floor((x - originX) / stepX);
    const row = Math.floor((y - originY) / stepY);
    if (column < 0 || row < 0 || column >= columns || row >= rows) return NaN;
    const value = values[row * columns + column];
    return value === nodata ? NaN : value;
  };
}

/**
 * How high what stands over the ground is, every metre of `region`, as a
 * grid from its corner: none on the buildings' `rings`, nor a metre and a
 * half round them, their edges.
 */
function standing(region, surface, ground, rings) {
  const [x0, y0] = [Math.floor(region[0]), Math.floor(region[1])];
  const width = Math.ceil(region[2]) - x0;
  const height = Math.ceil(region[3]) - y0;
  const at = (column, row) => row * width + column;
  // How high what stands is, every metre.
  const canopy = new Float32Array(width * height);
  for (let row = 0; row < height; row++) {
    for (let column = 0; column < width; column++) {
      const point = [x0 + column + 0.5, y0 + row + 0.5];
      const over = surface(point) - ground(point);
      canopy[at(column, row)] = Number.isNaN(over) ? 0 : over;
    }
  }
  for (const ring of rings) {
    const xs = ring.map(([x]) => x);
    const ys = ring.map(([, y]) => y);
    for (
      let column = Math.max(0, Math.floor(Math.min(...xs) - x0 - 2));
      column < Math.min(width, Math.ceil(Math.max(...xs) - x0 + 2));
      column++
    ) {
      for (
        let row = Math.max(0, Math.floor(Math.min(...ys) - y0 - 2));
        row < Math.min(height, Math.ceil(Math.max(...ys) - y0 + 2));
        row++
      ) {
        const point = [x0 + column + 0.5, y0 + row + 0.5];
        if (inside(point, ring) || toEdge(point, ring) < 1.5) {
          canopy[at(column, row)] = 0;
        }
      }
    }
  }
  return { x0, y0, width, height, at, canopy };
}

/**
 * The buildings OpenStreetMap hasn't mapped in `region`, from the laser
 * scan, clear of the `rings` of those it has: wherever what stands is
 * UNMAPPED_LOWEST or more and smooth (a crown is bumpy, a roof isn't) over
 * UNMAPPED_AREA or more; each as its outline, a ring in UTM metres.
 */
function findUnmapped(region, surface, ground, rings) {
  const { x0, y0, width, height, at, canopy } = standing(
    region,
    surface,
    ground,
    rings,
  );
  const smooth = new Uint8Array(width * height);
  for (let row = 1; row < height - 1; row++) {
    for (let column = 1; column < width - 1; column++) {
      const value = canopy[at(column, row)];
      const [w, e, s, n] = [
        canopy[at(column - 1, row)],
        canopy[at(column + 1, row)],
        canopy[at(column, row - 1)],
        canopy[at(column, row + 1)],
      ];
      if (Math.min(value, w, e, s, n) < UNMAPPED_LOWEST) continue;
      const bend = Math.abs(w + e - 2 * value) + Math.abs(s + n - 2 * value);
      if (bend < UNMAPPED_BEND) smooth[at(column, row)] = 1;
    }
  }
  const found = [];
  const seen = new Uint8Array(width * height);
  for (let start = 0; start < smooth.length; start++) {
    if (!smooth[start] || seen[start]) continue;
    // Its cells, side by side.
    const cells = [start];
    seen[start] = 1;
    for (let k = 0; k < cells.length; k++) {
      const [column, row] = [cells[k] % width, Math.floor(cells[k] / width)];
      for (const [c, r] of [
        [column - 1, row],
        [column + 1, row],
        [column, row - 1],
        [column, row + 1],
      ]) {
        if (c < 0 || r < 0 || c >= width || r >= height) continue;
        if (smooth[at(c, r)] && !seen[at(c, r)]) {
          seen[at(c, r)] = 1;
          cells.push(at(c, r));
        }
      }
    }
    if (cells.length < UNMAPPED_AREA) continue;
    // Out to its edge, a metre past where it's smooth.
    const taken = new Set();
    for (const cell of cells) {
      const [column, row] = [cell % width, Math.floor(cell / width)];
      for (let dr = -1; dr <= 1; dr++) {
        for (let dc = -1; dc <= 1; dc++) taken.add(at(column + dc, row + dr));
      }
    }
    found.push(outline(taken, width).map(([c, r]) => [x0 + c, y0 + r]));
  }
  return found;
}

/**
 * The outline round cells of a grid `width` wide, as its corners: each
 * cell's sides with none beside them, joined round, the longest way round
 * kept (not a hole's), and straightened to within UNMAPPED_STRAIGHT.
 */
function outline(cells, width) {
  const from = new Map();
  const side = (a, b) => from.set(a.join(), [...(from.get(a.join()) ?? []), b]);
  for (const cell of cells) {
    const [c, r] = [cell % width, Math.floor(cell / width)];
    const has = (dc, dr) => cells.has(cell + dc + dr * width);
    // Round each cell anticlockwise, x east and y north.
    if (!has(0, -1)) side([c, r], [c + 1, r]);
    if (!has(1, 0)) side([c + 1, r], [c + 1, r + 1]);
    if (!has(0, 1)) side([c + 1, r + 1], [c, r + 1]);
    if (!has(-1, 0)) side([c, r + 1], [c, r]);
  }
  let longest = [];
  for (const key of from.keys()) {
    const loop = [];
    for (let at = key; from.get(at)?.length; ) {
      const next = from.get(at).pop();
      loop.push(next);
      at = next.join();
    }
    if (loop.length > longest.length) longest = loop;
  }
  return straighten(longest);
}

/** A closed ring with the corners less than UNMAPPED_STRAIGHT off it dropped. */
function straighten(ring) {
  const off = ([x, y], [x1, y1], [x2, y2]) =>
    Math.abs((x2 - x1) * (y1 - y) - (x1 - x) * (y2 - y1)) /
    (Math.hypot(x2 - x1, y2 - y1) || 1);
  const line = (points) => {
    let [far, at] = [0, 0];
    for (let k = 1; k < points.length - 1; k++) {
      const d = off(points[k], points[0], points.at(-1));
      if (d > far) [far, at] = [d, k];
    }
    if (far < UNMAPPED_STRAIGHT) return [points[0], points.at(-1)];
    return [
      ...line(points.slice(0, at + 1)).slice(0, -1),
      ...line(points.slice(at)),
    ];
  };
  // Split at the corner farthest from the first, each half straightened.
  let half = 0;
  ring.forEach(([x, y], k) => {
    const [hx, hy] = ring[half];
    if (
      Math.hypot(x - ring[0][0], y - ring[0][1]) >
      Math.hypot(hx - ring[0][0], hy - ring[0][1])
    )
      half = k;
  });
  return [
    ...line(ring.slice(0, half + 1)).slice(0, -1),
    ...line([...ring.slice(half), ring[0]]).slice(0, -1),
  ];
}

/**
 * The trees in `region` (UTM: west, south, east, north), from the laser
 * scan's `surface` less its `ground`, clear of the `rings` of the buildings:
 * each as [x, y, height, crown radius], in UTM metres.
 */
function findTrees(region, surface, ground, rings) {
  const { x0, y0, width, height, at, canopy } = standing(
    region,
    surface,
    ground,
    rings,
  );
  // The crowns' tops: the highest within two metres, highest first.
  const tops = [];
  for (let row = 2; row < height - 2; row++) {
    for (let column = 2; column < width - 2; column++) {
      const value = canopy[at(column, row)];
      if (value < TREE_LOWEST) continue;
      let highest = true;
      for (let dy = -2; dy <= 2 && highest; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          if (canopy[at(column + dx, row + dy)] > value) {
            highest = false;
            break;
          }
        }
      }
      if (highest) tops.push([column, row, value]);
    }
  }
  tops.sort((a, b) => b[2] - a[2]);
  // No two too close: on a grid TREE_APART across, the trees near each.
  const near = new Map();
  const key = (column, row) =>
    `${Math.floor(column / TREE_APART)},${Math.floor(row / TREE_APART)}`;
  const trees = [];
  for (const [column, row, value] of tops) {
    const [cx, cy] = [
      Math.floor(column / TREE_APART),
      Math.floor(row / TREE_APART),
    ];
    let crowded = false;
    for (let dx = -1; dx <= 1 && !crowded; dx++) {
      for (let dy = -1; dy <= 1 && !crowded; dy++) {
        for (const [ox, oy] of near.get(`${cx + dx},${cy + dy}`) ?? []) {
          if (Math.hypot(ox - column, oy - row) < TREE_APART) crowded = true;
        }
      }
    }
    if (crowded) continue;
    const cell = key(column, row);
    near.set(cell, [...(near.get(cell) ?? []), [column, row]]);
    // Its crown: out each way till it's under half as high.
    let reach = 0;
    const ways = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
      [0.7, 0.7],
      [-0.7, 0.7],
      [0.7, -0.7],
      [-0.7, -0.7],
    ];
    for (const [dx, dy] of ways) {
      let step = 1;
      for (; step <= CROWN[1]; step++) {
        const [c, r] = [
          Math.round(column + dx * step),
          Math.round(row + dy * step),
        ];
        if (c < 0 || r < 0 || c >= width || r >= height) break;
        if (canopy[at(c, r)] < Math.max(value / 2, TREE_LOWEST)) break;
      }
      reach += step - 0.5;
    }
    const radius = Math.min(reach / ways.length, CROWN[1]);
    // Too narrow for a crown: a lamp post, a flagpole, a spike in the scan.
    if (radius < CROWN[0]) continue;
    trees.push([x0 + column + 0.5, y0 + row + 0.5, value, radius]);
  }
  return trees;
}

export async function buildVenue(name, root) {
  const venue = VENUES[name];
  if (!venue) throw new Error(`no venue ${name}: ${Object.keys(VENUES)}`);
  const cache = join(root, ".cache/venues", name);
  mkdirSync(cache, { recursive: true });

  const toUtm = proj4("EPSG:4326", UTM);
  const around = venue.around.map(([lat, lon]) => toUtm.forward([lon, lat]));
  // The map's edge, in UTM: west, south, east, north.
  const [[north, west], [south, east]] = venue.bounds;
  const [x0, y1] = toUtm.forward([west, north]);
  const [x1, y0] = toUtm.forward([east, south]);
  const box = [
    Math.floor(Math.min(x0, x1)),
    Math.floor(Math.min(y0, y1)),
    Math.ceil(Math.max(x0, x1)),
    Math.ceil(Math.max(y0, y1)),
  ];
  // As far as the ground goes past it.
  const wider = [
    box[0] - AROUND,
    box[1] - AROUND,
    box[2] + AROUND,
    box[3] + AROUND,
  ];
  // The buildings standing inside that, by their middle.
  // What's cut away from them, kept clear of trees and found buildings too.
  const cutAway = [];
  const buildings = (await outlines(cache, venue.centre, venue.radius + AROUND))
    .map((building) => {
      const { kept, away } = cut(
        building.lonLat.map((point) => toUtm.forward(point)),
        venue.cuts?.[building.id]?.map(([lat, lon]) =>
          toUtm.forward([lon, lat]),
        ),
      );
      if (away) cutAway.push(away);
      return { ...building, ring: kept };
    })
    .filter(({ ring }) => {
      const x = ring.reduce((sum, [px]) => sum + px, 0) / ring.length;
      const y = ring.reduce((sum, [, py]) => sum + py, 0) / ring.length;
      return x >= wider[0] && x <= wider[2] && y >= wider[1] && y <= wider[3];
    });
  const surface = await heights(cache, "dom", wider);
  const ground = await heights(cache, "dtm", wider);
  // And those only the scan has, in the venue: `s` and a number.
  const unmapped = findUnmapped(box, surface, ground, [
    ...buildings.map(({ ring }) => ring),
    ...cutAway,
  ]).filter(
    (ring) =>
      !inside(
        [
          ring.reduce((sum, [x]) => sum + x, 0) / ring.length,
          ring.reduce((sum, [, y]) => sum + y, 0) / ring.length,
        ],
        around,
      ),
  );
  for (const [k, ring] of unmapped.entries()) {
    buildings.push({ id: `s${k + 1}`, ring });
  }

  // A number painted along its block: which way the block runs round the
  // label (its points within LABEL_NEAR, by their main axis), as an angle
  // on the map, x east, y south; and how tall its digits are, a share of
  // the roof's width there, kept to its length.
  const roofLabel = (text, [lx, ly], points) => {
    const near = points.filter(
      ([x, y]) => Math.hypot(x - lx, y - ly) <= LABEL_NEAR,
    );
    const [mx, my] = [
      near.reduce((sum, [x]) => sum + x, 0) / near.length,
      near.reduce((sum, [, y]) => sum + y, 0) / near.length,
    ];
    let [xx, yy, xy] = [0, 0, 0];
    for (const [x, y] of near) {
      xx += (x - mx) ** 2;
      yy += (y - my) ** 2;
      xy += (x - mx) * (y - my);
    }
    // North up, east right: y flips for the map's y south.
    let angle = -0.5 * Math.atan2(2 * xy, xx - yy);
    // Reading left to right on the unturned map.
    if (angle > Math.PI / 2) angle -= Math.PI;
    if (angle <= -Math.PI / 2) angle += Math.PI;
    const [ux, uy] = [Math.cos(angle), -Math.sin(angle)];
    const along = (x, y) => (x - lx) * ux + (y - ly) * uy;
    const across = (x, y) => -(x - lx) * uy + (y - ly) * ux;
    const extent = (values) =>
      values.length ? Math.max(...values) - Math.min(...values) + 1 : 0;
    const width = extent(
      points
        .filter(([x, y]) => Math.abs(along(x, y)) <= 1)
        .map(([x, y]) => across(x, y)),
    );
    const length = extent(
      points
        .filter(([x, y]) => Math.abs(across(x, y)) <= 1)
        .map(([x, y]) => along(x, y)),
    );
    const size = Math.min(
      LABEL_SHARE * width,
      (LABEL_SHARE * length) / (LABEL_EM * text.length),
    );
    return {
      angle: Math.round(angle * 1000) / 1000,
      size: round(size),
    };
  };

  const [left, , , top] = box;
  const round = (value) => Math.round(value * 10) / 10;
  const measured = buildings.map(({ id, ring }) => {
    // Every metre inside the outline, clear of its edge where there's room.
    const rx = ring.map(([x]) => x);
    const ry = ring.map(([, y]) => y);
    const points = [];
    for (let x = Math.floor(Math.min(...rx)) + 0.5; x < Math.max(...rx); x++) {
      for (
        let y = Math.floor(Math.min(...ry)) + 0.5;
        y < Math.max(...ry);
        y++
      ) {
        if (inside([x, y], ring)) points.push([x, y]);
      }
    }
    const clear = points.filter((point) => toEdge(point, ring) >= INSET);
    const under = clear.length ? clear : points;
    const roofs = under.map(surface).filter((value) => !Number.isNaN(value));
    const floors = under.map(ground).filter((value) => !Number.isNaN(value));
    const floor = floors.length ? percentile(floors, 0.5) : Number.NaN;
    const height =
      roofs.length && floors.length
        ? percentile(roofs, 0.9) - floor
        : MIN_HEIGHT;
    // How tall it is round a point: its roof's high tenth there, over the
    // ground under it all; NaN where the scan has none.
    const roofAt = ([px, py]) => {
      const near = under
        .filter(([x, y]) => Math.hypot(x - px, y - py) <= ROOF_NEAR)
        .map(surface)
        .filter((value) => !Number.isNaN(value));
      return near.length && !Number.isNaN(floor)
        ? percentile(near, 0.9) - floor
        : Number.NaN;
    };
    // Its roof, where it isn't flat: how tall it is every ROOF_STEP over a
    // grid round it, a step past its edge; where the scan has none, as the
    // nearest that has.
    const [gx, gy] = [
      Math.floor(Math.min(...rx) / ROOF_STEP - 1) * ROOF_STEP,
      Math.ceil(Math.max(...ry) / ROOF_STEP + 1) * ROOF_STEP,
    ];
    const columns = Math.ceil((Math.max(...rx) - gx) / ROOF_STEP) + 2;
    const rows = Math.ceil((gy - Math.min(...ry)) / ROOF_STEP) + 2;
    const grid = [];
    for (let row = 0; row < rows; row++) {
      for (let column = 0; column < columns; column++) {
        grid.push(roofAt([gx + column * ROOF_STEP, gy - row * ROOF_STEP]));
      }
    }
    const [cx, cy] = [
      rx.reduce((sum, x) => sum + x, 0) / rx.length,
      ry.reduce((sum, y) => sum + y, 0) / ry.length,
    ];
    // Past the map's edge or round it, only drawn, its roof flat.
    const ours =
      cx >= box[0] &&
      cx <= box[2] &&
      cy >= box[1] &&
      cy <= box[3] &&
      !inside([cx, cy], around);
    const read = grid.filter((value) => !Number.isNaN(value));
    const sloped =
      ours &&
      read.length > 0 &&
      Math.max(...read) - Math.min(...read) > ROOF_SLOPED;
    for (let missing = Infinity; sloped && missing > 0; ) {
      missing = 0;
      const was = [...grid];
      was.forEach((value, k) => {
        if (!Number.isNaN(value)) return;
        const [column, row] = [k % columns, Math.floor(k / columns)];
        const near = [
          [column - 1, row],
          [column + 1, row],
          [column, row - 1],
          [column, row + 1],
        ]
          .filter(([c, r]) => c >= 0 && r >= 0 && c < columns && r < rows)
          .map(([c, r]) => was[r * columns + c])
          .filter((other) => !Number.isNaN(other));
        if (near.length) {
          grid[k] = near.reduce((sum, other) => sum + other, 0) / near.length;
        } else missing++;
      });
    }
    // A label at the metre inside nearest its middle: a bent block's middle
    // can fall outside it.
    const text = venue.labels?.[id];
    const [lx, ly] = text
      ? points.reduce(
          (best, point) =>
            Math.hypot(point[0] - cx, point[1] - cy) <
            Math.hypot(best[0] - cx, best[1] - cy)
              ? point
              : best,
          points[0] ?? [cx, cy],
        )
      : [cx, cy];
    // The label's roof: how tall there, and how much it rises a metre
    // along the label, as far as the scan says.
    const labelRoof = (label) => {
      if (!sloped)
        return { roof: round(Math.max(height, MIN_HEIGHT)), slope: 0 };
      const [ux, uy] = [Math.cos(label.angle), -Math.sin(label.angle)];
      const [here, ahead, behind] = [0, ROOF_NEAR, -ROOF_NEAR].map((d) =>
        roofAt([lx + ux * d, ly + uy * d]),
      );
      const slope = (ahead - behind) / (2 * ROOF_NEAR);
      return {
        roof: round(Number.isNaN(here) ? height : here),
        slope: Number.isNaN(slope) ? 0 : Math.round(slope * 1000) / 1000,
      };
    };
    const label = text && {
      text,
      x: round(lx - left),
      y: round(top - ly),
      ...roofLabel(text, [lx, ly], points),
    };
    return {
      id,
      floor,
      height: round(Math.max(sloped ? Math.max(...read) : height, MIN_HEIGHT)),
      // From the map's top-left corner, y down the map, south.
      ring: ring.flatMap(([x, y]) => [round(x - left), round(top - y)]),
      ...(sloped && {
        roof: {
          x: gx - left,
          y: top - gy,
          step: ROOF_STEP,
          columns,
          heights: grid.map((value) => round(Math.max(value, 0))),
        },
      }),
      venue: ours,
      ...(venue.arenas[id] && { arena: venue.arenas[id] }),
      ...(label && { label: { ...label, ...labelRoof(label) } }),
    };
  });

  // The map under them, cut to the box: areas as rings, roads and paths as
  // the pieces of them on it.
  const [width, height] = [box[2] - box[0], box[3] - box[1]];
  // The ground goes on past the map's edge: worked out in a box AROUND
  // bigger on each side, and put back.
  const [wide, tall] = [width + 2 * AROUND, height + 2 * AROUND];
  const local = ([lon, lat]) => {
    const [x, y] = toUtm.forward([lon, lat]);
    return [x - left + AROUND, top - y + AROUND];
  };
  const flat = (points) =>
    points.flatMap(([x, y]) => [round(x - AROUND), round(y - AROUND)]);
  const map = await mapAround(cache, venue.centre, venue.radius + AROUND);
  const areas = map.areas.flatMap(({ kind, rings }) => {
    const [outer, ...holes] = rings.map((ring) =>
      clipRing(ring.slice(0, -1).map(local), wide, tall),
    );
    if (outer.length < 3) return [];
    return [
      {
        kind,
        rings: [outer, ...holes.filter((hole) => hole.length >= 3)].map(flat),
      },
    ];
  });
  // The sea, from the coast, on the side away from the arenas' buildings.
  // The numbers all one size: as big as the narrowest block takes.
  const labelled = measured.filter((building) => building.label);
  const size = Math.min(...labelled.map(({ label }) => label.size));
  for (const { label } of labelled) label.size = size;

  const arenaAt = measured.find((building) => building.arena);
  if (arenaAt) {
    const land = [arenaAt.ring[0] + AROUND, arenaAt.ring[1] + AROUND];
    const pieces = chain(map.coast).flatMap((line) =>
      clipLine(line.map(local), wide, tall),
    );
    for (const ring of sea(pieces, wide, tall, land)) {
      areas.push({ kind: "water", rings: [flat(ring)] });
    }
  }
  // What's cut off a building is paved: a terrace, not grass.
  for (const ring of cutAway) {
    areas.push({
      kind: "paved",
      rings: [
        ring
          .slice(0, -1)
          .flatMap(([x, y]) => [round(x - left), round(top - y)]),
      ],
    });
  }
  areas.sort((a, b) => UNDER.indexOf(a.kind) - UNDER.indexOf(b.kind));
  const ways = map.ways.flatMap(({ kind, width: across, line }) =>
    clipLine(line.map(local), wide, tall).map((piece) => ({
      kind,
      width: across,
      line: flat(piece),
    })),
  );

  for (const [id, what] of Object.entries({
    ...venue.arenas,
    ...venue.labels,
    ...Object.fromEntries(
      Object.keys(venue.cuts ?? {}).map((id) => [id, "a cut"]),
    ),
  })) {
    if (!measured.some((building) => building.id === id)) {
      throw new Error(`${name}: no building ${id} for ${what}`);
    }
  }

  // The ground's height, from the ground under the arenas' building: on a
  // grid TERRAIN_STEP apart, each the mean of the metres round it; the sea
  // where there's none.
  const level = arenaAt.floor;
  const atGround = ([x, y]) => {
    const values = [];
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const value = ground([x + dx, y + dy]);
        if (!Number.isNaN(value)) values.push(value);
      }
    }
    const mean = values.length
      ? values.reduce((sum, value) => sum + value, 0) / values.length
      : 0;
    return mean - level;
  };
  const columns = Math.floor((wider[2] - wider[0]) / TERRAIN_STEP) + 1;
  const rows = Math.floor((wider[3] - wider[1]) / TERRAIN_STEP) + 1;
  const terrain = [];
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      // To the metre: closer is more to download, and not seen.
      terrain.push(
        Math.round(
          atGround([
            wider[0] + column * TERRAIN_STEP,
            wider[3] - row * TERRAIN_STEP,
          ]),
        ),
      );
    }
  }
  // The trees round it, as x, y, height, crown radius, …, in metres from the
  // map's top-left: the venue's, and what's past its edge or round it.
  const trees = { venue: [], around: [] };
  for (const [x, y, tall, radius] of findTrees(
    [
      box[0] - TREE_PAST,
      box[1] - TREE_PAST,
      box[2] + TREE_PAST,
      box[3] + TREE_PAST,
    ],
    surface,
    ground,
    [...buildings.map(({ ring }) => ring), ...cutAway],
  )) {
    const ours =
      x >= box[0] &&
      x <= box[2] &&
      y >= box[1] &&
      y <= box[3] &&
      !inside([x, y], around);
    trees[ours ? "venue" : "around"].push(
      round(x - left),
      round(top - y),
      round(tall),
      round(radius),
    );
  }

  return {
    width: box[2] - box[0],
    height: box[3] - box[1],
    credit: CREDIT,
    // Where it is, as [lat, lon]: what the sun over it is worked out for.
    centre: venue.centre,
    // Longitude and latitude to the map, as a plane: over a kilometre the
    // projection bends less than a centimetre.
    geo: (() => {
      const [lat, lon] = venue.centre;
      const [x0, y0] = local([lon, lat]);
      const [x1, y1] = local([lon + 0.01, lat]);
      const [x2, y2] = local([lon, lat + 0.01]);
      const [a, d] = [(x1 - x0) / 0.01, (y1 - y0) / 0.01];
      const [b, e] = [(x2 - x0) / 0.01, (y2 - y0) / 0.01];
      return [a, b, x0 - a * lon - b * lat, d, e, y0 - d * lon - e * lat];
    })(),
    buildings: measured.map(({ floor, ring, ...building }) => {
      // Where it was measured, else the ground under its first corner.
      const [x, y] = [ring[0] + left, top - ring[1]];
      const base = Number.isNaN(floor) ? atGround([x, y]) : floor - level;
      return { ...building, base: round(base), ring };
    }),
    terrain: {
      x: wider[0] - left,
      y: top - wider[3],
      step: TERRAIN_STEP,
      columns,
      heights: terrain,
    },
    // Water lies flat, a little under the ground along its edge: the low
    // tenth of it, where the edge is on land (the scan has no sea).
    areas: areas.map((area) => {
      if (area.kind !== "water") return area;
      const [outer] = area.rings;
      const edge = [];
      for (let i = 0; i < outer.length; i += 2) {
        const j = (i + 2) % outer.length;
        const [x1, y1, x2, y2] = [
          outer[i],
          outer[i + 1],
          outer[j],
          outer[j + 1],
        ];
        const metres = Math.ceil(Math.hypot(x2 - x1, y2 - y1));
        for (let k = 0; k < metres; k++) {
          const t = k / metres;
          const value = ground([
            left + x1 + t * (x2 - x1),
            top - (y1 + t * (y2 - y1)),
          ]);
          if (!Number.isNaN(value)) edge.push(value);
        }
      }
      const shore = edge.length ? percentile(edge, 0.1) : 0;
      return { ...area, level: round(shore - WATER_BELOW - level) };
    }),
    ways,
    trees,
  };
}

export function venueModule(venue) {
  return `// Generated by \`npm run venue:build\` from OpenStreetMap and Kartverket — do not edit.
import type { Venue } from "../venue";

const venue: Venue = ${JSON.stringify(venue)};

export default venue;
`;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const name = process.argv[2];
  if (!name) throw new Error("usage: npm run venue:build -- <venue>");
  const root = join(import.meta.dirname, "..");
  const venue = await buildVenue(name, root);
  const out = join(root, "shared/venues", `${name}.ts`);
  mkdirSync(join(root, "shared/venues"), { recursive: true });
  writeFileSync(out, venueModule(venue));
  const inVenue = venue.buildings.filter((building) => building.venue).length;
  console.log(
    `${out}: ${venue.buildings.length} buildings, ${inVenue} in the venue, ${venue.areas.length} areas, ${venue.ways.length} roads and paths, ${venue.trees.venue.length / 4} + ${venue.trees.around.length / 4} trees, ${venue.width} × ${venue.height} m`,
  );
}
