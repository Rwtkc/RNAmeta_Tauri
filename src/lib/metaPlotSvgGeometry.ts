import type { MetaPlotPayload, MetaPlotSeriesValue } from "@/types/native";

export const META_PLOT_MARGIN = { top: 58, right: 28, bottom: 78, left: 76 };

export function scaleMetaPlotX(
  value: number,
  width: number,
  domain: [number, number]
) {
  return (
    META_PLOT_MARGIN.left + ((value - domain[0]) / (domain[1] - domain[0])) * width
  );
}

export function scaleMetaPlotY(
  value: number,
  height: number,
  domain: [number, number]
) {
  return (
    META_PLOT_MARGIN.top +
    height -
    ((value - domain[0]) / (domain[1] - domain[0])) * height
  );
}

export function buildMetaPlotUnitTicks(min: number, max: number) {
  if (!Number.isFinite(min) || !Number.isFinite(max) || min === max) {
    return [min];
  }

  const ticks: number[] = [];
  for (let value = Math.ceil(min); value <= Math.floor(max); value += 1) {
    ticks.push(value);
  }
  return ticks;
}

function catmullRomSegment(
  p0: { x: number; y: number },
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  p3: { x: number; y: number }
) {
  const c1x = p1.x + (p2.x - p0.x) / 6;
  const c1y = p1.y + (p2.y - p0.y) / 6;
  const c2x = p2.x - (p3.x - p1.x) / 6;
  const c2y = p2.y - (p3.y - p1.y) / 6;
  return `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(
    2
  )} ${p2.x.toFixed(2)},${p2.y.toFixed(2)}`;
}

function buildMetaPlotSmoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length === 0) {
    return "";
  }

  if (points.length === 1) {
    return `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;
  }

  let path = `M${points[0].x.toFixed(2)},${points[0].y.toFixed(2)}`;

  for (let index = 0; index < points.length - 1; index += 1) {
    const p0 = points[Math.max(0, index - 1)];
    const p1 = points[index];
    const p2 = points[index + 1];
    const p3 = points[Math.min(points.length - 1, index + 2)];
    path += ` ${catmullRomSegment(p0, p1, p2, p3)}`;
  }

  return path;
}

function buildMetaPlotSeriesPoints(
  values: MetaPlotSeriesValue[],
  plotWidth: number,
  plotHeight: number,
  payload: MetaPlotPayload
) {
  return values.map((point) => ({
    x: scaleMetaPlotX(point.x, plotWidth, payload.xDomain),
    y: scaleMetaPlotY(point.density, plotHeight, payload.yDomain)
  }));
}

export function buildMetaPlotSeriesAreaPath(
  values: MetaPlotSeriesValue[],
  plotWidth: number,
  plotHeight: number,
  payload: MetaPlotPayload
) {
  const points = buildMetaPlotSeriesPoints(values, plotWidth, plotHeight, payload);
  if (points.length === 0) {
    return "";
  }

  const zeroY = scaleMetaPlotY(0, plotHeight, payload.yDomain);
  const topPath = buildMetaPlotSmoothPath(points);
  const first = points[0];
  const last = points[points.length - 1];
  return `${topPath} L${last.x.toFixed(2)},${zeroY.toFixed(2)} L${first.x.toFixed(
    2
  )},${zeroY.toFixed(2)} Z`;
}

export function buildMetaPlotSeriesLinePath(
  values: MetaPlotSeriesValue[],
  plotWidth: number,
  plotHeight: number,
  payload: MetaPlotPayload
) {
  return buildMetaPlotSmoothPath(
    buildMetaPlotSeriesPoints(values, plotWidth, plotHeight, payload)
  );
}

export function buildMetaPlotCiPath(
  values: MetaPlotSeriesValue[],
  key: "confidenceDown" | "confidenceUp",
  plotWidth: number,
  plotHeight: number,
  payload: MetaPlotPayload
) {
  const points = values
    .filter((point) => typeof point[key] === "number")
    .map((point) => ({
      x: scaleMetaPlotX(point.x, plotWidth, payload.xDomain),
      y: scaleMetaPlotY(point[key] as number, plotHeight, payload.yDomain)
    }));

  return buildMetaPlotSmoothPath(points);
}

export function buildMetaPlotCiAreaPath(
  values: MetaPlotSeriesValue[],
  plotWidth: number,
  plotHeight: number,
  payload: MetaPlotPayload
) {
  const down = values
    .filter(
      (point) =>
        typeof point.confidenceDown === "number" &&
        typeof point.confidenceUp === "number"
    )
    .map((point) => ({
      x: scaleMetaPlotX(point.x, plotWidth, payload.xDomain),
      y: scaleMetaPlotY(point.confidenceDown as number, plotHeight, payload.yDomain)
    }));
  const up = values
    .filter(
      (point) =>
        typeof point.confidenceDown === "number" &&
        typeof point.confidenceUp === "number"
    )
    .map((point) => ({
      x: scaleMetaPlotX(point.x, plotWidth, payload.xDomain),
      y: scaleMetaPlotY(point.confidenceUp as number, plotHeight, payload.yDomain)
    }));

  if (down.length === 0 || up.length === 0) {
    return "";
  }

  const upperPath = buildMetaPlotSmoothPath(up);
  const lowerReturn = down
    .slice()
    .reverse()
    .map((point) => `L${point.x.toFixed(2)},${point.y.toFixed(2)}`)
    .join(" ");

  return `${upperPath} ${lowerReturn} Z`;
}
