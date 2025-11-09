export const gridMultiplier = 4;
export const aspectRatio = { width: 8, height: 15 };

export const columns = gridMultiplier * aspectRatio.width;
export const rows = gridMultiplier * aspectRatio.height;

export function getGridDimensions() {
  return {
    columns,
    rows,
    totalCells: columns * rows,
  };
}

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

export function gridToPosition(
  gridX: number,
  gridY: number,
  containerWidth: number,
  containerHeight: number,
) {
  const cellSize = getCellSize(containerWidth, containerHeight);

  const x = gridX * cellSize.width;
  const y = gridY * cellSize.height;

  return { x, y };
}

export function gridToPercentage(gridX: number, gridY: number) {
  return {
    percentageX: (gridX / columns) * 100,
    percentageY: (gridY / rows) * 100,
  };
}

export function percentageToGrid(xPercent: number, yPercent: number) {
  return {
    x: Math.round(xPercent * columns),
    y: Math.round(yPercent * rows),
  };
}

export function parseGridCoordinates(
  location: string,
): { x: number; y: number } | null {
  const match = location.match(/X(\d+)Y(\d+)/);
  if (!match) return null;

  return {
    x: Number.parseInt(match[1], 10),
    y: Number.parseInt(match[2], 10),
  };
}

export function formatGridCoordinates(gridX: number, gridY: number): string {
  return `X${gridX}Y${gridY}`;
}
