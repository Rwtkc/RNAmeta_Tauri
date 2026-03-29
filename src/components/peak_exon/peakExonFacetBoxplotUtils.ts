import type { BoxplotGroup } from "@/types/native";

export const WIDTH = 1180;
export const HEIGHT = 560;
export const MARGIN = { top: 92, right: 42, bottom: 118, left: 86 };
export const PANEL_HEIGHT = 350;
export const FACET_WIDTH = 300;
export const FACET_GAP = 26;
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
  rawQ1: number;
  rawMedian: number;
  rawQ3: number;
  outliers: Array<{ raw: number; display: number }>;
}

export function createBandScale(
  count: number,
  rangeStart: number,
  rangeEnd: number,
  paddingInner = 0.3,
  paddingOuter = 0.2
): BandScale {
  const range = rangeEnd - rangeStart;
  const step = range / Math.max(1, count - paddingInner + paddingOuter * 2);
  const bandwidth = step * (1 - paddingInner);

  return {
    bandwidth,
    position: (index: number) => rangeStart + step * (paddingOuter + index)
  };
}

export function transformValue(value: number, scaleTransform: "log2" | "linear") {
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
  scaleTransform: "log2" | "linear"
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

  return {
    count: rawValues.length,
    q1,
    median,
    q3,
    lowerWhisker,
    upperWhisker,
    rawQ1: quantileSorted(rawValues, 0.25),
    rawMedian: quantileSorted(rawValues, 0.5),
    rawQ3: quantileSorted(rawValues, 0.75),
    outliers: rawValues
      .map((raw) => ({
        raw,
        display: transformValue(raw, scaleTransform) as number
      }))
      .filter(
        (entry) =>
          entry.display < lowerWhisker || entry.display > upperWhisker
      )
  };
}

export function computeYTicks(minValue: number, maxValue: number) {
  const range = maxValue - minValue;
  const roughStep = range / 5;
  const magnitude = 10 ** Math.floor(Math.log10(Math.max(roughStep, 0.001)));
  const normalized = roughStep / magnitude;
  let niceStep = magnitude;

  if (normalized > 5) {
    niceStep = 10 * magnitude;
  } else if (normalized > 2) {
    niceStep = 5 * magnitude;
  } else if (normalized > 1) {
    niceStep = 2 * magnitude;
  }

  const start = Math.floor(minValue / niceStep) * niceStep;
  const ticks: number[] = [];

  for (let current = start; current <= maxValue + niceStep * 0.01; current += niceStep) {
    if (current >= minValue && current <= maxValue) {
      ticks.push(Math.round(current * 1000) / 1000);
    }
  }

  return ticks;
}

export function formatMetric(value: number, scaleTransform: "log2" | "linear") {
  if (!Number.isFinite(value)) {
    return "-";
  }

  if (scaleTransform === "linear" && Number.isInteger(value)) {
    return String(value);
  }

  return value.toFixed(2);
}

export function resolveTooltipPosition(
  container: HTMLDivElement | null,
  clientX: number,
  clientY: number
) {
  const rect = container?.getBoundingClientRect();
  if (!rect) {
    return { left: 0, top: 0 };
  }

  return {
    left: clientX - rect.left + 18,
    top: clientY - rect.top - 18
  };
}
