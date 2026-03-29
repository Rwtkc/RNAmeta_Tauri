import type { BoxplotGroup } from "@/types/native";

export const WIDTH = 1180;
export const HEIGHT = 620;
export const MARGIN = { top: 92, right: 42, bottom: 118, left: 86 };
export const TEXT_COLOR = "#41503c";
export const TITLE_COLOR = "#22301f";
export const SURFACE = "#fffaf3";
export const GRID = "rgba(133, 155, 122, 0.16)";

interface BandScale {
  bandwidth: number;
  position: (index: number) => number;
}

export interface BoxplotSummary {
  count: number;
  q1: number;
  median: number;
  q3: number;
  lowerWhisker: number;
  upperWhisker: number;
  outliers: Array<{ raw: number; display: number }>;
}

export function createBandScale(
  count: number,
  rangeStart: number,
  rangeEnd: number,
  paddingInner = 0.6,
  paddingOuter = 0.28
): BandScale {
  const range = rangeEnd - rangeStart;
  const step = range / Math.max(1, count - paddingInner + paddingOuter * 2);
  const bandwidth = step * (1 - paddingInner);

  return {
    bandwidth,
    position: (index: number) => rangeStart + step * (paddingOuter + index)
  };
}

export function transformValue(value: number, scaleTransform: string) {
  if (!Number.isFinite(value)) {
    return null;
  }

  if (scaleTransform === "log2") {
    return value > 0 ? Math.log2(value) : null;
  }

  return value;
}

export function quantileSorted(sortedValues: number[], ratio: number) {
  if (!sortedValues.length) {
    return 0;
  }

  const pos = ratio * (sortedValues.length - 1);
  const lower = Math.floor(pos);
  const upper = Math.ceil(pos);

  if (lower === upper) {
    return sortedValues[lower];
  }

  return sortedValues[lower] + (pos - lower) * (sortedValues[upper] - sortedValues[lower]);
}

export function summarizeGroup(
  values: BoxplotGroup["values"],
  scaleTransform: string
): BoxplotSummary | null {
  const rawValues = values
    .map(Number)
    .filter(
      (value) =>
        Number.isFinite(value) && (scaleTransform === "log2" ? value > 0 : true)
    )
    .sort((left, right) => left - right);

  if (!rawValues.length) {
    return null;
  }

  const displayValues = rawValues
    .map((value) => transformValue(value, scaleTransform))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);

  const q1 = quantileSorted(displayValues, 0.25);
  const median = quantileSorted(displayValues, 0.5);
  const q3 = quantileSorted(displayValues, 0.75);
  const iqr = q3 - q1;
  const lowerFence = q1 - iqr * 1.5;
  const upperFence = q3 + iqr * 1.5;
  const inliers = displayValues.filter(
    (value) => value >= lowerFence && value <= upperFence
  );
  const lowerWhisker = inliers.length
    ? Math.min(...inliers)
    : Math.min(...displayValues);
  const upperWhisker = inliers.length
    ? Math.max(...inliers)
    : Math.max(...displayValues);
  const outliers = rawValues
    .map((value) => ({
      raw: value,
      display: transformValue(value, scaleTransform) as number
    }))
    .filter(
      (entry) =>
        entry.display !== null &&
        (entry.display < lowerWhisker || entry.display > upperWhisker)
    );

  return {
    count: rawValues.length,
    q1,
    median,
    q3,
    lowerWhisker,
    upperWhisker,
    outliers
  };
}

export function formatMetric(value: number, scaleTransform: string) {
  if (!Number.isFinite(value)) {
    return "-";
  }

  if (scaleTransform === "linear" && Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
}
