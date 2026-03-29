export function normalizeList<T>(value: T | T[] | null | undefined) {
  if (value === null || value === undefined) {
    return [] as T[];
  }

  if (Array.isArray(value)) {
    return value;
  }

  if (typeof value === "object") {
    return Object.values(value as Record<string, T>);
  }

  return [value];
}

export function normalizeNumber(value: unknown, fallback = 0) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : fallback;
}

export function normalizeDomain(
  value: unknown,
  fallback: [number, number] = [0, 1]
): [number, number] {
  const domain = normalizeList(value)
    .map((item) => normalizeNumber(item, Number.NaN))
    .filter(Number.isFinite);

  if (domain.length >= 2) {
    return [domain[0], domain[1]];
  }

  return fallback;
}

export function normalizeDensityValues(value: unknown) {
  return normalizeList(value)
    .map((point) => {
      if (!point || typeof point !== "object") {
        return null;
      }

      const x = normalizeNumber((point as { x?: unknown }).x, Number.NaN);
      const density = normalizeNumber(
        (point as { density?: unknown }).density,
        Number.NaN
      );

      if (!Number.isFinite(x) || !Number.isFinite(density)) {
        return null;
      }

      return { x, density };
    })
    .filter((point): point is { x: number; density: number } => Boolean(point));
}

export function normalizeHeatmapMatrix(
  value: unknown,
  rowCount = 0,
  columnCount = 0
) {
  const rows = normalizeList(value)
    .map((row) =>
      normalizeList(row).map((cell) => normalizeNumber(cell, 0))
    )
    .filter((row) => row.length > 0);

  if (!rows.length || !rowCount || !columnCount) {
    return [] as number[][];
  }

  return rows.slice(0, rowCount).map((row) => {
    const normalizedRow = row.slice(0, columnCount);
    if (normalizedRow.length >= columnCount) {
      return normalizedRow;
    }

    return normalizedRow.concat(
      Array.from({ length: columnCount - normalizedRow.length }, () => 0)
    );
  });
}

export function normalizeSeries(value: unknown) {
  return normalizeList(value)
    .map((item) => {
      if (!item || typeof item !== "object") {
        return null;
      }

      const record = item as Record<string, unknown>;
      const values = normalizeDensityValues(record.values);

      return {
        ...record,
        name: String(record.name ?? ""),
        originalName: record.originalName ? String(record.originalName) : "",
        color: record.color ? String(record.color) : "#859b7a",
        values
      };
    })
    .filter(
      (
        item
      ): item is {
        name: string;
        originalName: string;
        color: string;
        values: Array<{ x: number; density: number }>;
      } => item !== null && Boolean(item.name) && item.values.length > 0
    );
}

export function normalizePanels(config: Record<string, unknown> | null | undefined) {
  return normalizeList(config?.panels).map((panel) => {
    const normalizedPanel =
      panel && typeof panel === "object"
        ? (panel as Record<string, unknown>)
        : {};
    const isHeatmap = normalizedPanel.type === "heatmap";

    return {
      ...normalizedPanel,
      type: isHeatmap ? "heatmap" : "density",
      title: String(normalizedPanel.title ?? ""),
      sampleName: normalizedPanel.sampleName
        ? String(normalizedPanel.sampleName)
        : "",
      originalName: normalizedPanel.originalName
        ? String(normalizedPanel.originalName)
        : "",
      imageData:
        typeof normalizedPanel.imageData === "string"
          ? normalizedPanel.imageData
          : "",
      rows: Math.max(0, Math.round(normalizeNumber(normalizedPanel.rows, 0))),
      columns: Math.max(
        0,
        Math.round(normalizeNumber(normalizedPanel.columns, 0))
      ),
      xLabel: String(normalizedPanel.xLabel ?? ""),
      yLabel: String(normalizedPanel.yLabel ?? ""),
      xDomain: normalizeDomain(normalizedPanel.xDomain, isHeatmap ? [-1, 1] : [0, 1]),
      yDomain: normalizeDomain(normalizedPanel.yDomain, [0, 1]),
      displayHeightPx: Number.isFinite(Number(normalizedPanel.displayHeightPx))
        ? Number(normalizedPanel.displayHeightPx)
        : undefined,
      displayWidthRatio: Number.isFinite(Number(normalizedPanel.displayWidthRatio))
        ? Number(normalizedPanel.displayWidthRatio)
        : undefined,
      cornerRadiusPx: Number.isFinite(Number(normalizedPanel.cornerRadiusPx))
        ? Number(normalizedPanel.cornerRadiusPx)
        : undefined,
      backgroundColor: normalizedPanel.backgroundColor
        ? String(normalizedPanel.backgroundColor)
        : undefined,
      palette: normalizeList(normalizedPanel.palette).map(String).filter(Boolean),
      colorMaxQuantile: normalizeNumber(
        normalizedPanel.colorMaxQuantile,
        1
      ),
      yTicks: normalizeList(normalizedPanel.yTicks)
        .map((tick) => normalizeNumber(tick, Number.NaN))
        .filter(Number.isFinite),
      guideLines: normalizeList(normalizedPanel.guideLines)
        .map((tick) => normalizeNumber(tick, Number.NaN))
        .filter(Number.isFinite),
      series: normalizeSeries(normalizedPanel.series),
      matrixValues: normalizeHeatmapMatrix(
        normalizedPanel.matrixValues,
        Math.max(0, Math.round(normalizeNumber(normalizedPanel.rows, 0))),
        Math.max(0, Math.round(normalizeNumber(normalizedPanel.columns, 0)))
      )
    };
  });
}
