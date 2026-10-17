import { describe, expect, it } from "vitest";
import {
  columns,
  formatGridCoordinates,
  getCellSize,
  gridToPercentage,
  parseGridCoordinates,
  rows,
  snapToGrid,
} from "./grid";

describe("formatGridCoordinates", () => {
  it("serializes coordinates as X<col>Y<row>", () => {
    expect(formatGridCoordinates(16, 30)).toBe("X16Y30");
    expect(formatGridCoordinates(0, 0)).toBe("X0Y0");
  });
});

describe("parseGridCoordinates", () => {
  it("parses a well-formed location", () => {
    expect(parseGridCoordinates("X16Y30")).toEqual({ x: 16, y: 30 });
    expect(parseGridCoordinates("X0Y0")).toEqual({ x: 0, y: 0 });
  });

  it("extracts coordinates embedded in a longer string", () => {
    expect(parseGridCoordinates("salen/X10Y15")).toEqual({ x: 10, y: 15 });
  });

  it("returns null for unparseable input", () => {
    expect(parseGridCoordinates("invalid")).toBeNull();
    expect(parseGridCoordinates("")).toBeNull();
    expect(parseGridCoordinates("X-1Y2")).toBeNull();
  });

  it("round-trips with formatGridCoordinates", () => {
    for (const [x, y] of [
      [0, 0],
      [16, 30],
      [columns, rows],
    ]) {
      expect(parseGridCoordinates(formatGridCoordinates(x, y))).toEqual({
        x,
        y,
      });
    }
  });
});

describe("gridToPercentage", () => {
  it("maps grid corners to 0% and 100%", () => {
    expect(gridToPercentage(0, 0)).toEqual({
      percentageX: 0,
      percentageY: 0,
    });
    expect(gridToPercentage(columns, rows)).toEqual({
      percentageX: 100,
      percentageY: 100,
    });
  });

  it("maps the centre to 50%", () => {
    expect(gridToPercentage(columns / 2, rows / 2)).toEqual({
      percentageX: 50,
      percentageY: 50,
    });
  });
});

describe("getCellSize", () => {
  it("divides the container into the grid", () => {
    // columns = 48, rows = 90
    expect(getCellSize(480, 900)).toEqual({ width: 10, height: 10 });
  });
});

describe("snapToGrid", () => {
  it("snaps a pixel offset to the nearest cell", () => {
    // 480x900 container => 10px cells
    expect(snapToGrid(100, 200, 480, 900)).toEqual({ x: 10, y: 20 });
  });

  it("rounds to the nearest cell boundary", () => {
    // 10px cells: 104 -> 10, 105 -> 11
    expect(snapToGrid(104, 0, 480, 900).x).toBe(10);
    expect(snapToGrid(105, 0, 480, 900).x).toBe(11);
  });
});
