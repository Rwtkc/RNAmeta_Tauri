export const STACKED_SITE_PROFILE_WIDTH = 1180;
export const COMPACT_SITE_PROFILE_WIDTH = 540;
export const STACKED_DENSITY_MARGIN = {
  top: 18,
  right: 128,
  bottom: 50,
  left: 112
};
export const HEATMAP_AXIS_WIDTH_PX = 68;
export const HEATMAP_AXIS_GAP_PX = 1;
export const HEATMAP_Y_AXIS_LINE_X = HEATMAP_AXIS_WIDTH_PX;
export const SITE_PROFILE_AXIS_TICK_FONT_SIZE_PX = 12;
export const HEATMAP_AXIS_TICK_FONT_WEIGHT = 700;
export const HEATMAP_AXIS_LINE_STROKE_WIDTH = 1.2;
export const HEATMAP_AXIS_TICK_STROKE_WIDTH = 1.2;
export const HEATMAP_X_AXIS_TICK_SIZE_PX = 8;
export const HEATMAP_TITLE_OFFSET_PX = 110;
export const HEATMAP_SHOW_SAMPLE_LABEL = false;

function asPercent(part: number, whole: number) {
  return `${(part / whole) * 100}%`;
}

export function getStackedHeatmapContentLeftPx() {
  return STACKED_DENSITY_MARGIN.left - HEATMAP_Y_AXIS_LINE_X;
}

export function getStackedHeatmapContentWidthPx() {
  return (
    STACKED_SITE_PROFILE_WIDTH -
    getStackedHeatmapContentLeftPx() -
    STACKED_DENSITY_MARGIN.right
  );
}

export function getStackedHeatmapContentStyle() {
  const contentLeftPx = getStackedHeatmapContentLeftPx();
  const contentWidthPx = getStackedHeatmapContentWidthPx();

  return {
    width: asPercent(contentWidthPx, STACKED_SITE_PROFILE_WIDTH),
    marginLeft: asPercent(contentLeftPx, STACKED_SITE_PROFILE_WIDTH),
    marginRight: asPercent(STACKED_DENSITY_MARGIN.right, STACKED_SITE_PROFILE_WIDTH)
  };
}

export function getStackedHeatmapPlotRowStyle() {
  const contentWidthPx = getStackedHeatmapContentWidthPx();

  return {
    gridTemplateColumns: `${asPercent(
      HEATMAP_AXIS_WIDTH_PX,
      contentWidthPx
    )} minmax(0, 1fr)`,
    columnGap: asPercent(HEATMAP_AXIS_GAP_PX, contentWidthPx)
  };
}

export function getStackedSiteProfileTitleStyle(
  offsetPx = HEATMAP_TITLE_OFFSET_PX
) {
  return {
    marginLeft: asPercent(offsetPx, STACKED_SITE_PROFILE_WIDTH)
  };
}

export function resolveHeatmapAxisViewportWidth(
  layoutMode: "compact" | "stacked" = "compact",
  renderedWidth: number | null = null
) {
  const numericWidth = Number(renderedWidth);
  if (Number.isFinite(numericWidth) && numericWidth > 0) {
    return Math.max(1, Math.round(numericWidth));
  }

  return layoutMode === "stacked"
    ? STACKED_SITE_PROFILE_WIDTH
    : COMPACT_SITE_PROFILE_WIDTH;
}

export function resolveHeatmapYAxisViewportWidth(renderedWidth: number | null = null) {
  const numericWidth = Number(renderedWidth);
  if (Number.isFinite(numericWidth) && numericWidth > 0) {
    return Math.max(1, Math.round(numericWidth));
  }

  return HEATMAP_AXIS_WIDTH_PX;
}

export function resolveHeatmapYAxisLineX(viewportWidth: number | null = null) {
  return Math.max(1, resolveHeatmapYAxisViewportWidth(viewportWidth) - 1);
}

export function resolveHeatmapXAxisBaselineY() {
  return HEATMAP_AXIS_LINE_STROKE_WIDTH / 2;
}

export function resolveHeatmapYAxisTickRange(rowCount: number, heightPx: number) {
  const safeRowCount = Math.max(1, Number(rowCount) || 1);
  const safeHeight = Math.max(1, Number(heightPx) || 1);
  const rowHeight = safeHeight / safeRowCount;

  return {
    start: rowHeight / 2,
    end: safeHeight - rowHeight / 2
  };
}
