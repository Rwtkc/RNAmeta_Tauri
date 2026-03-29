import * as d3 from "d3";

export function buildHeatmapTiles(panel: {
  rows?: number;
  columns?: number;
  matrixValues?: number[][];
}) {
  if (!panel?.rows || !panel?.columns || !panel?.matrixValues?.length) {
    return [] as Array<{ rowIndex: number; columnIndex: number; value: number }>;
  }

  const tiles = [] as Array<{ rowIndex: number; columnIndex: number; value: number }>;
  for (let rowIndex = 0; rowIndex < panel.rows; rowIndex += 1) {
    const rowValues = panel.matrixValues[rowIndex] ?? [];
    for (let columnIndex = 0; columnIndex < panel.columns; columnIndex += 1) {
      const value = Number(rowValues[columnIndex] ?? 0);
      if (value <= 0) {
        continue;
      }

      tiles.push({
        rowIndex: rowIndex + 1,
        columnIndex: columnIndex + 1,
        value
      });
    }
  }

  return tiles;
}

function getTileKey(rowIndex: number, columnIndex: number) {
  return `${rowIndex}:${columnIndex}`;
}

export function buildHeatmapTileLookup(
  tiles: Array<{ rowIndex: number; columnIndex: number; value: number }>
) {
  const lookup = new Map<string, { rowIndex: number; columnIndex: number; value: number }>();
  tiles.forEach((tile) => {
    lookup.set(getTileKey(tile.rowIndex, tile.columnIndex), tile);
  });
  return lookup;
}

export function resolveHeatmapDisplayMax(
  tiles: Array<{ value: number }>,
  quantile = 1
) {
  const values = tiles
    .map((tile) => Number(tile.value))
    .filter((value) => Number.isFinite(value) && value > 0)
    .sort((left, right) => left - right);

  if (values.length === 0) {
    return 1;
  }

  const safeQuantile = Math.max(0, Math.min(1, Number(quantile) || 1));
  const quantileValue =
    d3.quantileSorted(values, safeQuantile) ?? values[values.length - 1];
  return Math.max(1, quantileValue);
}

export function buildHeatmapColorScale(
  palette: string[] | undefined,
  displayMax: number
) {
  const colors =
    Array.isArray(palette) && palette.length >= 2
      ? palette
      : ["#fff0d9", "#f7cf7a", "#ee9b4b", "#da6a33", "#b23a2c", "#7f1d1d"];
  const domain = colors.map((_, index) => {
    if (colors.length === 1) {
      return 0;
    }

    return (displayMax * index) / (colors.length - 1);
  });

  return d3.scaleLinear<string>().domain(domain).range(colors).clamp(true);
}

export function resolveHeatmapHoverTile(input: {
  offsetX: number;
  offsetY: number;
  width: number;
  height: number;
  rowCount: number;
  columnCount: number;
  tileLookup: Map<string, { rowIndex: number; columnIndex: number; value: number }>;
}) {
  const safeWidth = Number(input.width);
  const safeHeight = Number(input.height);
  const safeRows = Math.max(1, Number(input.rowCount) || 1);
  const safeColumns = Math.max(1, Number(input.columnCount) || 1);

  if (
    !Number.isFinite(input.offsetX) ||
    !Number.isFinite(input.offsetY) ||
    !Number.isFinite(safeWidth) ||
    !Number.isFinite(safeHeight) ||
    safeWidth <= 0 ||
    safeHeight <= 0 ||
    input.offsetX < 0 ||
    input.offsetY < 0 ||
    input.offsetX > safeWidth ||
    input.offsetY > safeHeight
  ) {
    return null;
  }

  const columnIndex = Math.min(
    safeColumns,
    Math.max(1, Math.floor((input.offsetX / safeWidth) * safeColumns) + 1)
  );
  const rowIndex = Math.min(
    safeRows,
    Math.max(1, Math.floor((input.offsetY / safeHeight) * safeRows) + 1)
  );

  return input.tileLookup.get(getTileKey(rowIndex, columnIndex)) ?? null;
}
