import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  arenaModule,
  levelsModule,
  parseArena,
  parseLevels,
} from "./arena-geometry.mjs";

const root = join(import.meta.dirname, "..");

describe("arena geometry", () => {
  it("shared/arenas/salen.ts matches public/arena/salen.svg", () => {
    const svg = readFileSync(join(root, "public/arena/salen.svg"), "utf8");
    const generated = readFileSync(
      join(root, "shared/arenas/salen.ts"),
      "utf8",
    );

    // Fails when the SVG was re-exported without `npm run arena:build -- salen`.
    expect(generated).toBe(arenaModule(parseArena(svg)));
  });

  it("shared/arenas/salen-levels.ts matches public/arena/salen_3d-raw.svg", () => {
    const svg = readFileSync(
      join(root, "public/arena/salen_3d-raw.svg"),
      "utf8",
    );
    const generated = readFileSync(
      join(root, "shared/arenas/salen-levels.ts"),
      "utf8",
    );

    // Fails when the SVG was re-exported without `npm run arena:build -- salen`.
    expect(generated).toBe(levelsModule(parseLevels(svg)));
  });

  it("reads levels by name, highest first, seats from the Overlay group and columns from Columns", () => {
    const levels = parseLevels(
      `<svg viewBox="0 0 100 50">
        <rect width="100" height="50" fill="white"/>
        <g id="Stairs">
          <rect id="stair2" x="0" y="0" width="10" height="20"/>
          <rect id="stair2_2" x="10" y="20" width="10" height="20" transform="rotate(-180 10 20)"/>
          <path id="stage4" d="M0 0H5V5Z"/>
        </g>
        <rect id="sounddeck14" x="50" y="0" width="5" height="5"/>
        <g id="Overlay"><g id="Group 1">
          <path id="Stroke-1" d="M20 30H34V46H20Z"/>
        </g></g>
        <g id="Columns"><path id="Stroke-2" d="M0 0H1V1Z"/></g>
      </svg>`,
    );

    expect(levels).toEqual({
      width: 100,
      height: 50,
      levels: [
        { part: "deck", height: 132, ring: [50, 0, 55, 0, 55, 5, 50, 5] },
        { part: "stage", height: 36, ring: [0, 0, 5, 0, 5, 5] },
        { part: "stair", height: 18, ring: [0, 0, 10, 0, 10, 20, 0, 20] },
        { part: "stair", height: 18, ring: [10, 20, 0, 20, 0, 0, 10, 0] },
      ],
      seats: [27, 38, 14, 16, 0],
      columns: [[0, 0, 1, 0, 1, 1]],
    });
  });

  it("classifies strokes as outlines and the row colour as rows", () => {
    const arena = parseArena(
      '<svg viewBox="0 0 10 20"><path d="M0 0" stroke="#9e9e9e"/><path d="M1 1" fill="#7299D6"/><path d="M2 2" fill="#9e9e9e"/></svg>',
    );

    expect(arena).toEqual({
      width: 10,
      height: 20,
      shapes: [
        { kind: "outline", d: "M0 0" },
        { kind: "row", d: "M1 1" },
        { kind: "marker", d: "M2 2" },
      ],
    });
  });
});
