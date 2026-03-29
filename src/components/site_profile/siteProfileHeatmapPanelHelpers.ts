import * as d3 from "d3";
import { normalizeDomain } from "@/components/site_profile/siteProfileChartData";
import {
  COMPACT_SITE_PROFILE_WIDTH,
  HEATMAP_AXIS_GAP_PX,
  HEATMAP_AXIS_LINE_STROKE_WIDTH,
  HEATMAP_AXIS_TICK_FONT_WEIGHT,
  HEATMAP_AXIS_TICK_STROKE_WIDTH,
  HEATMAP_AXIS_WIDTH_PX,
  HEATMAP_X_AXIS_TICK_SIZE_PX,
  SITE_PROFILE_AXIS_TICK_FONT_SIZE_PX,
  STACKED_SITE_PROFILE_WIDTH,
  resolveHeatmapAxisViewportWidth,
  resolveHeatmapXAxisBaselineY,
  resolveHeatmapYAxisLineX,
  resolveHeatmapYAxisTickRange,
  resolveHeatmapYAxisViewportWidth
} from "@/components/site_profile/siteProfileLayout";

export const HEATMAP_PANEL_AXIS_HEIGHT = 54;
export const HEATMAP_PANEL_Y_AXIS_WIDTH = HEATMAP_AXIS_WIDTH_PX;
export const HEATMAP_PANEL_LAYOUT = {
  axisGapPx: HEATMAP_AXIS_GAP_PX
};

const AXIS_COLOR = "#41503c";
const COMPACT_MARGIN = { top: 0, right: 16, bottom: 22, left: 12 };
const STACKED_MARGIN = { top: 0, right: 42, bottom: 22, left: 12 };

export type HeatmapPanelData = {
  title: string;
  sampleName: string;
  originalName: string;
  rows: number;
  columns: number;
  matrixValues: number[][];
  xDomain: [number, number];
  displayHeightPx?: number;
  cornerRadiusPx?: number;
  backgroundColor?: string;
  palette?: string[];
  colorMaxQuantile?: number;
  layoutMode?: "compact" | "stacked";
};

function getAxisLayout(layoutMode: "compact" | "stacked" = "compact") {
  const width =
    layoutMode === "stacked"
      ? STACKED_SITE_PROFILE_WIDTH
      : COMPACT_SITE_PROFILE_WIDTH;
  const margin = layoutMode === "stacked" ? STACKED_MARGIN : COMPACT_MARGIN;
  const plotWidth = width - margin.left - margin.right;
  return { width, plotWidth };
}

function getHeatmapYTickValues(rowCount: number) {
  return Array.from(
    new Set([
      1,
      Math.max(1, Math.round(Math.max(1, rowCount) / 2)),
      Math.max(1, rowCount)
    ])
  ).sort((left, right) => left - right);
}

export function drawHeatmapXAxis(
  svgNode: SVGSVGElement,
  panel: HeatmapPanelData,
  layoutMode: "compact" | "stacked" = "compact",
  viewportWidth: number | null = null
) {
  const svg = d3.select(svgNode);
  svg.selectAll("*").remove();

  const fallbackWidth = getAxisLayout(layoutMode).width;
  const width = resolveHeatmapAxisViewportWidth(
    layoutMode,
    viewportWidth ?? fallbackWidth
  );
  const domain = normalizeDomain(panel.xDomain, [0, 1]);
  const baseTicks = d3.ticks(domain[0], domain[1], 5);
  const baseStep =
    baseTicks.length >= 2
      ? Math.abs(baseTicks[1] - baseTicks[0])
      : Math.abs(domain[1] - domain[0]);
  const endpointThreshold = Math.max(1, baseStep * 0.35);
  const shouldIncludeMin =
    baseTicks.length === 0 ||
    Math.min(...baseTicks.map((tick) => Math.abs(tick - domain[0]))) >
      endpointThreshold;
  const shouldIncludeMax =
    baseTicks.length === 0 ||
    Math.min(...baseTicks.map((tick) => Math.abs(tick - domain[1]))) >
      endpointThreshold;
  const tickValues = Array.from(
    new Set([
      ...(shouldIncludeMin ? [domain[0]] : []),
      ...baseTicks,
      ...(shouldIncludeMax ? [domain[1]] : [])
    ])
  ).sort((left, right) => left - right);
  const xScale = d3.scaleLinear().domain(domain).range([2, width - 2]);
  const baselineY = resolveHeatmapXAxisBaselineY();

  const axisGroup = svg
    .append("g")
    .call(
      d3
        .axisBottom(xScale)
        .tickValues(tickValues)
        .tickFormat(d3.format("~g"))
        .tickSize(HEATMAP_X_AXIS_TICK_SIZE_PX)
        .tickPadding(8)
    )
    .call((group) => group.select(".domain").remove())
    .call((group) =>
      group
        .selectAll(".tick line")
        .attr("stroke", AXIS_COLOR)
        .attr("stroke-width", HEATMAP_AXIS_TICK_STROKE_WIDTH)
    )
    .call((group) =>
      group
        .selectAll("text")
        .attr("fill", AXIS_COLOR)
        .style("font-size", `${SITE_PROFILE_AXIS_TICK_FONT_SIZE_PX}px`)
        .style("font-weight", HEATMAP_AXIS_TICK_FONT_WEIGHT)
    )
    .call((group) => {
      const ticks = group.selectAll(".tick");
      ticks.select("text").style("text-anchor", "middle");
      ticks
        .filter((_, index) => index === 0)
        .select("text")
        .style("text-anchor", "start");
      ticks
        .filter((_, index, nodes) => index === nodes.length - 1)
        .select("text")
        .style("text-anchor", "end");
    });

  axisGroup
    .append("line")
    .attr("x1", 2)
    .attr("x2", width - 2)
    .attr("y1", baselineY)
    .attr("y2", baselineY)
    .attr("stroke", AXIS_COLOR)
    .attr("stroke-width", HEATMAP_AXIS_LINE_STROKE_WIDTH);
}

export function drawHeatmapYAxis(
  svgNode: SVGSVGElement,
  rowCount: number,
  heightPx: number
) {
  const svg = d3.select(svgNode);
  svg.selectAll("*").remove();

  const roundedHeight = Math.max(1, Math.round(heightPx));
  const roundedWidth = resolveHeatmapYAxisViewportWidth(
    svgNode.getBoundingClientRect().width
  );
  const axisLineX = resolveHeatmapYAxisLineX(roundedWidth);
  const tickRange = resolveHeatmapYAxisTickRange(rowCount, roundedHeight);
  const yScale = d3
    .scaleLinear()
    .domain([1, Math.max(1, rowCount)])
    .range([tickRange.start, tickRange.end]);

  svg
    .append("line")
    .attr("x1", axisLineX)
    .attr("x2", axisLineX)
    .attr("y1", 0)
    .attr("y2", roundedHeight)
    .attr("stroke", AXIS_COLOR)
    .attr("stroke-width", HEATMAP_AXIS_LINE_STROKE_WIDTH);

  svg
    .append("g")
    .attr("transform", `translate(${axisLineX}, 0)`)
    .call(
      d3
        .axisLeft(yScale)
        .tickValues(getHeatmapYTickValues(rowCount))
        .tickSize(8)
        .tickPadding(8)
    )
    .call((group) => group.select(".domain").remove())
    .call((group) =>
      group
        .selectAll(".tick line")
        .attr("stroke", AXIS_COLOR)
        .attr("stroke-width", HEATMAP_AXIS_TICK_STROKE_WIDTH)
    )
    .call((group) =>
      group
        .selectAll("text")
        .attr("fill", AXIS_COLOR)
        .style("font-size", `${SITE_PROFILE_AXIS_TICK_FONT_SIZE_PX}px`)
        .style("font-weight", HEATMAP_AXIS_TICK_FONT_WEIGHT)
    );
}

export function formatHeatmapTooltipX(
  panel: HeatmapPanelData,
  columnIndex: number
) {
  const [domainMin, domainMax] = normalizeDomain(panel.xDomain, [0, 1]);
  if (!panel.columns || panel.columns <= 1) {
    return domainMin;
  }

  const ratio = (columnIndex - 1) / (panel.columns - 1);
  return domainMin + (domainMax - domainMin) * ratio;
}
