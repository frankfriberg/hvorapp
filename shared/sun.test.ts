import { describe, expect, it } from "vitest";
import { sunPosition } from "./sun";

// Brunstad, where solar noon is near 11:18 UTC.
const [LAT, LON] = [59.2266, 10.3632];
const deg = (radians: number) => (radians * 180) / Math.PI;

describe("sunPosition", () => {
  it("stands high in the south at midsummer noon", () => {
    const { azimuth, altitude } = sunPosition(
      new Date("2026-06-21T11:18:00Z"),
      LAT,
      LON,
    );
    expect(deg(altitude)).toBeCloseTo(54.2, 0);
    expect(deg(azimuth)).toBeCloseTo(180, -1);
  });

  it("barely clears the horizon at midwinter noon", () => {
    const { altitude } = sunPosition(
      new Date("2026-12-21T11:18:00Z"),
      LAT,
      LON,
    );
    expect(deg(altitude)).toBeCloseTo(7.3, 0);
  });

  it("rises in the east and sets in the west", () => {
    const morning = sunPosition(new Date("2026-03-20T06:00:00Z"), LAT, LON);
    const evening = sunPosition(new Date("2026-03-20T17:00:00Z"), LAT, LON);
    expect(deg(morning.azimuth)).toBeGreaterThan(60);
    expect(deg(morning.azimuth)).toBeLessThan(120);
    expect(deg(evening.azimuth)).toBeGreaterThan(240);
    expect(deg(evening.azimuth)).toBeLessThan(300);
  });

  it("is under the horizon at midnight", () => {
    const { altitude } = sunPosition(
      new Date("2026-11-26T23:00:00Z"),
      LAT,
      LON,
    );
    expect(altitude).toBeLessThan(0);
  });
});
