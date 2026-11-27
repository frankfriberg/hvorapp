// Where the sun is in the sky, for a place and a time: accurate to a fraction
// of a degree, enough to light a map by. After the astronomical almanac's
// low-precision formulas.

const RAD = Math.PI / 180;
// Days from 1 January 2000, 12:00 UTC (J2000).
const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY = 86_400_000;
// The Earth's tilt.
const OBLIQUITY = 23.4397 * RAD;

/**
 * The sun seen from `latitude`, `longitude` at `date`, in radians: its
 * azimuth, clockwise from north, and its altitude over the horizon, below it
 * negative.
 */
export function sunPosition(date: Date, latitude: number, longitude: number) {
  const days = (date.getTime() - J2000) / DAY;
  // Its mean anomaly, and its longitude along the ecliptic.
  const anomaly = (357.5291 + 0.98560028 * days) * RAD;
  const centre =
    (1.9148 * Math.sin(anomaly) +
      0.02 * Math.sin(2 * anomaly) +
      0.0003 * Math.sin(3 * anomaly)) *
    RAD;
  const ecliptic = anomaly + centre + 102.9372 * RAD + Math.PI;
  const declination = Math.asin(Math.sin(OBLIQUITY) * Math.sin(ecliptic));
  const ascension = Math.atan2(
    Math.sin(ecliptic) * Math.cos(OBLIQUITY),
    Math.cos(ecliptic),
  );
  // How far round from due south it is, westward.
  const hour =
    (280.16 + 360.9856235 * days) * RAD + longitude * RAD - ascension;
  const phi = latitude * RAD;
  const altitude = Math.asin(
    Math.sin(phi) * Math.sin(declination) +
      Math.cos(phi) * Math.cos(declination) * Math.cos(hour),
  );
  const fromSouth = Math.atan2(
    Math.sin(hour),
    Math.cos(hour) * Math.sin(phi) - Math.tan(declination) * Math.cos(phi),
  );
  return { azimuth: fromSouth + Math.PI, altitude };
}
