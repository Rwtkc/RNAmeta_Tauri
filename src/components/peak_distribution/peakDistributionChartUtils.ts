import type {
  PeakDistributionPayload,
  PeakDistributionSeries
} from "@/types/native";

export const WIDTH = 1180;
export const HEIGHT = 560;
export const MARGIN = { top: 92, right: 36, bottom: 108, left: 82 };
export const PANEL_FILL = "#fffaf3";
export const GRID_COLOR = "rgba(133, 155, 122, 0.16)";
export const AXIS_COLOR = "#41503c";

export interface HoverState {
  x: number;
  y: number;
  category: string;
  sample: string;
  originalName: string;
  value: number;
}

interface BandScale {
  bandwidth: number;
  position: (index: number) => number;
}

export function resolveCategoryOriginalName(
  payload: PeakDistributionPayload,
  category: string,
  categoryIndex: number
) {
  const mapping = payload.categoryOriginalNames;
  if (!mapping) {
    return category;
  }

  if (Array.isArray(mapping)) {
    return mapping[categoryIndex] || category;
  }

  return mapping[category] || category;
}

export function createBandScale(
  count: number,
  rangeStart: number,
  rangeEnd: number,
  paddingInner: number,
  paddingOuter = paddingInner / 2
): BandScale {
  const range = rangeEnd - rangeStart;
  const step = range / Math.max(1, count - paddingInner + paddingOuter * 2);
  const bandwidth = step * (1 - paddingInner);

  return {
    bandwidth,
    position: (index: number) => rangeStart + step * (paddingOuter + index)
  };
}

export function yScale(
  value: number,
  domain: [number, number],
  plotHeight: number
) {
  const [min, max] = domain;
  if (max <= min) {
    return plotHeight;
  }
  const ratio = (value - min) / (max - min);
  return plotHeight - ratio * plotHeight;
}

export function formatYAxisValue(
  value: number,
  type: PeakDistributionPayload["type"]
) {
  if (type === "stacked_bar") {
    return `${Math.round(value)}%`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1)}k`;
  }

  return String(Math.round(value));
}

export function computeLegendLayout(
  series: PeakDistributionSeries[],
  totalWidth: number
) {
  const itemGap = 24;
  const rowGap = 28;
  const rectSize = 16;
  const textOffset = 24;
  const rows: Array<Array<{ series: PeakDistributionSeries; itemWidth: number }>> = [];
  let currentRow: Array<{ series: PeakDistributionSeries; itemWidth: number }> = [];
  let currentWidth = 0;

  series.forEach((entry) => {
    const label = String(entry?.name || "");
    const itemWidth = Math.max(110, label.length * 8.3 + 44);
    const projectedWidth = currentRow.length
      ? currentWidth + itemGap + itemWidth
      : itemWidth;

    if (currentRow.length && projectedWidth > totalWidth) {
      rows.push(currentRow);
      currentRow = [];
      currentWidth = 0;
    }

    currentRow.push({ series: entry, itemWidth });
    currentWidth =
      currentRow.length === 1 ? itemWidth : currentWidth + itemGap + itemWidth;
  });

  if (currentRow.length) {
    rows.push(currentRow);
  }

  return rows.flatMap((row, rowIndex) => {
    const rowWidth = row.reduce(
      (sum, item, index) => sum + item.itemWidth + (index > 0 ? itemGap : 0),
      0
    );
    let cursorX = (totalWidth - rowWidth) / 2;

    return row.map((item, itemIndex) => {
      const layout = {
        series: item.series,
        x: cursorX,
        y: rowIndex * rowGap,
        rectSize,
        textX: textOffset,
        textY: 8
      };

      cursorX += item.itemWidth + (itemIndex < row.length - 1 ? itemGap : 0);
      return layout;
    });
  });
}
