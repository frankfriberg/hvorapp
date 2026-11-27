export const gridMultiplier = 6;
export const aspectRatio = { width: 8, height: 15 };

export const columns = gridMultiplier * aspectRatio.width;
export const rows = gridMultiplier * aspectRatio.height;

export function getCellSize(containerWidth: number, containerHeight: number) {
  return {
    width: containerWidth / columns,
    height: containerHeight / rows,
  };
}

export function snapToGrid(
  x: number,
  y: number,
  containerWidth: number,
  containerHeight: number,
) {
  const cellSize = getCellSize(containerWidth, containerHeight);

  const snappedX = Math.round(x / cellSize.width);
  const snappedY = Math.round(y / cellSize.height);

  return { x: snappedX, y: snappedY };
}

export function gridToPercentage(gridX: number, gridY: number) {
  return {
    percentageX: (gridX / columns) * 100,
    percentageY: (gridY / rows) * 100,
  };
}

/**
 * Where a point on the map falls on the grid, to a tenth of a cell: the app
 * places pins anywhere, not only on whole cells.
 */
export function percentageToGrid(percentageX: number, percentageY: number) {
  const tenth = (value: number) => Math.round(value * 10) / 10;
  return {
    gridX: tenth((percentageX / 100) * columns),
    gridY: tenth((percentageY / 100) * rows),
  };
}

// A whole or decimal grid coordinate, as in X16Y30 or X16.4Y30.2.
const COORDINATE = String.raw`(\d+(?:\.\d+)?)`;

export function parseGridCoordinates(
  location: string,
): { x: number; y: number } | null {
  const match = location.match(new RegExp(`X${COORDINATE}Y${COORDINATE}`));
  if (!match) return null;

  return {
    x: Number.parseFloat(match[1]),
    y: Number.parseFloat(match[2]),
  };
}

export function formatGridCoordinates(gridX: number, gridY: number): string {
  return `X${gridX}Y${gridY}`;
}

export type GridPosition = {
  gridX: number;
  gridY: number;
  percentageX: number;
  percentageY: number;
};
