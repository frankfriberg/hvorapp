import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { arenaModule, parseArena } from "./arena-geometry.mjs";

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
