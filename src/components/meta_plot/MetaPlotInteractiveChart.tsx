import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent } from "react";
import type { MetaPlotPayload, MetaPlotSeries, MetaPlotSeriesValue } from "@/types/native";
import {
  buildMetaPlotCiAreaPath,
  buildMetaPlotCiPath,
  buildMetaPlotSeriesAreaPath,
  buildMetaPlotSeriesLinePath,
  buildMetaPlotUnitTicks,
  computeMetaPlotLegendLayouts,
  META_PLOT_AXIS_COLOR,
  META_PLOT_FONT_FAMILY,
  META_PLOT_GRID_COLOR,
  META_PLOT_HEIGHT,
  META_PLOT_MARGIN,
  META_PLOT_PANEL_FILL,
  META_PLOT_WIDTH,
  metaPlotMinimumComponentHeight,
  scaleMetaPlotX,
  scaleMetaPlotY
} from "@/lib/metaPlotSvg";
import { MetaPlotLegend } from "./MetaPlotLegend";
import {
  findNearestValue,
  findPointOnPathByX,
  interpolateSeriesValue
} from "./metaPlotInteractiveHelpers";
import {
  MetaPlotHoverMarker,
  MetaPlotTooltip,
  type MetaPlotHoverState
} from "./MetaPlotHover";

export function MetaPlotInteractiveChart({ payload }: { payload: MetaPlotPayload }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const linePathRefs = useRef<Record<string, SVGPathElement | null>>({});
  const [hoverState, setHoverState] = useState<MetaPlotHoverState | null>(null);
  const [animationCycle, setAnimationCycle] = useState(0);

  const plotWidth = META_PLOT_WIDTH - META_PLOT_MARGIN.left - META_PLOT_MARGIN.right;
  const plotHeight = META_PLOT_HEIGHT - META_PLOT_MARGIN.top - META_PLOT_MARGIN.bottom;
  const yTicks = buildMetaPlotUnitTicks(payload.yDomain[0], payload.yDomain[1]);
  const xTicks = [0, 0.25, 0.5, 0.75, 1];
  const componentBase = payload.components?.trackBase ?? -0.03;
  const labelY = payload.components?.labelY ?? -0.08;
  const baselineY = scaleMetaPlotY(componentBase, plotHeight, payload.yDomain);
  const legendY = META_PLOT_HEIGHT - 48;

  const seriesPaths = useMemo(
    () =>
      payload.series.map((series) => ({
        series,
        areaPath: buildMetaPlotSeriesAreaPath(series.values, plotWidth, plotHeight, payload),
        linePath: buildMetaPlotSeriesLinePath(series.values, plotWidth, plotHeight, payload),
        ciAreaPath: payload.showCI
          ? buildMetaPlotCiAreaPath(series.values, plotWidth, plotHeight, payload)
          : "",
        ciLowerPath: payload.showCI
          ? buildMetaPlotCiPath(
              series.values,
              "confidenceDown",
              plotWidth,
              plotHeight,
              payload
            )
          : "",
        ciUpperPath: payload.showCI
          ? buildMetaPlotCiPath(series.values, "confidenceUp", plotWidth, plotHeight, payload)
          : ""
      })),
    [payload, plotHeight, plotWidth]
  );

  useEffect(() => {
    setAnimationCycle((current) => current + 1);
    setHoverState(null);
  }, [payload]);

  function handleSeriesPointerMove(
    event: ReactPointerEvent<SVGPathElement>,
    series: MetaPlotSeries
  ) {
    const container = containerRef.current;
    const svg = svgRef.current;
    if (!container || !svg) {
      return;
    }

    const rect = container.getBoundingClientRect();
    const svgRect = svg.getBoundingClientRect();
    const pointerSvgX =
      ((event.clientX - svgRect.left) / Math.max(1, svgRect.width)) * META_PLOT_WIDTH;
    const clampedSvgX = Math.min(
      META_PLOT_MARGIN.left + plotWidth,
      Math.max(META_PLOT_MARGIN.left, pointerSvgX)
    );
    const linePath = linePathRefs.current[series.name];
    const curvePoint = linePath ? findPointOnPathByX(linePath, clampedSvgX) : null;
    const chartX = curvePoint?.x ?? clampedSvgX;
    const normalizedX =
      (chartX - META_PLOT_MARGIN.left) / Math.max(1, plotWidth);
    const domainX =
      payload.xDomain[0] + normalizedX * (payload.xDomain[1] - payload.xDomain[0]);
    const datum =
      interpolateSeriesValue(series.values, domainX) ?? findNearestValue(series.values, domainX);

    if (!datum) {
      return;
    }

    const chartY =
      curvePoint?.y ?? scaleMetaPlotY(datum.density, plotHeight, payload.yDomain);
    const renderedPointX =
      ((chartX / META_PLOT_WIDTH) * svgRect.width) + (svgRect.left - rect.left);
    const renderedPointY =
      ((chartY / META_PLOT_HEIGHT) * svgRect.height) + (svgRect.top - rect.top);
    const tooltipWidth = 220;
    const tooltipHeight = series.originalName !== series.name ? 110 : 84;
    const nextX =
      renderedPointX + 24 + tooltipWidth > rect.width
        ? Math.max(12, renderedPointX - tooltipWidth - 18)
        : renderedPointX + 24;
    const nextY = Math.min(
      Math.max(12, renderedPointY - tooltipHeight / 2),
      rect.height - tooltipHeight - 12
    );

    setHoverState({
      series,
      datum,
      x: chartX,
      y: chartY,
      tooltipX: nextX,
      tooltipY: nextY
    });
  }

  return (
    <div ref={containerRef} className="meta-plot-interactive-chart">
      <svg
        ref={svgRef}
        viewBox={`0 0 ${META_PLOT_WIDTH} ${META_PLOT_HEIGHT}`}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={payload.title || "Meta Plot chart"}
      >
        <g>
          <rect
            x={META_PLOT_MARGIN.left}
            y={META_PLOT_MARGIN.top}
            width={plotWidth}
            height={plotHeight}
            fill={META_PLOT_PANEL_FILL}
          />

          {xTicks.map((tick) => {
            const x = scaleMetaPlotX(tick, plotWidth, payload.xDomain);
            return (
              <line
                key={`grid-x-${tick}`}
                x1={x}
                x2={x}
                y1={META_PLOT_MARGIN.top}
                y2={META_PLOT_MARGIN.top + plotHeight}
                stroke={META_PLOT_GRID_COLOR}
                strokeWidth={1.1}
              />
            );
          })}

          {yTicks.map((tick) => {
            const y = scaleMetaPlotY(tick, plotHeight, payload.yDomain);
            return (
              <line
                key={`grid-y-${tick}`}
                x1={META_PLOT_MARGIN.left}
                x2={META_PLOT_WIDTH - META_PLOT_MARGIN.right}
                y1={y}
                y2={y}
                stroke={META_PLOT_GRID_COLOR}
                strokeWidth={1.1}
              />
            );
          })}

          {seriesPaths.map(
            ({ series, areaPath, linePath, ciAreaPath, ciLowerPath, ciUpperPath }, seriesIndex) => {
              const isActive = hoverState?.series.name === series.name;
              const animationStyle = {
                "--meta-plot-animation-delay": `${seriesIndex * 90}ms`
              } as CSSProperties;
              const areaStyle = {
                ...animationStyle,
                "--meta-plot-fill-opacity": "0.18"
              } as CSSProperties;
              const ciAreaStyle = {
                ...animationStyle,
                "--meta-plot-fill-opacity": "0.12"
              } as CSSProperties;

              return (
                <g key={`${series.name}-${animationCycle}`}>
                  {areaPath ? (
                    <path
                      d={areaPath}
                      fill={series.color}
                      className="meta-plot-area-path"
                      style={areaStyle}
                    />
                  ) : null}
                  {payload.showCI && ciAreaPath ? (
                    <path
                      d={ciAreaPath}
                      fill={series.color}
                      className="meta-plot-area-path meta-plot-area-path--ci"
                      style={ciAreaStyle}
                    />
                  ) : null}
                  {payload.showCI && ciLowerPath ? (
                    <path
                      d={ciLowerPath}
                      fill="none"
                      stroke="#4f6db8"
                      strokeWidth={1}
                      opacity={0.45}
                    />
                  ) : null}
                  {payload.showCI && ciUpperPath ? (
                    <path
                      d={ciUpperPath}
                      fill="none"
                      stroke="#111111"
                      strokeWidth={1}
                      opacity={0.45}
                    />
                  ) : null}
                  <path
                    d={linePath}
                    fill="none"
                    stroke={series.color}
                    strokeWidth={isActive ? 5.4 : 4}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    pathLength={1}
                    className="meta-plot-line-path"
                    style={animationStyle}
                    ref={(node) => {
                      linePathRefs.current[series.name] = node;
                    }}
                  />
                  <path
                    d={linePath}
                    fill="none"
                    stroke="transparent"
                    strokeWidth={20}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="meta-plot-hit-path"
                    onPointerMove={(event) => handleSeriesPointerMove(event, series)}
                    onPointerEnter={(event) => handleSeriesPointerMove(event, series)}
                    onPointerLeave={() => setHoverState(null)}
                  />
                </g>
              );
            }
          )}

          {(payload.components?.separators || []).map((separator, index) => {
            const x = scaleMetaPlotX(separator.x, plotWidth, payload.xDomain);
            const y1 = scaleMetaPlotY(separator.y1, plotHeight, payload.yDomain);
            const y2 = scaleMetaPlotY(separator.y2, plotHeight, payload.yDomain);
            return (
              <line
                key={`sep-${index}`}
                x1={x}
                x2={x}
                y1={y1}
                y2={y2}
                stroke="#111111"
                strokeWidth={1.6}
                strokeDasharray="2,6"
              />
            );
          })}

          <line
            x1={META_PLOT_MARGIN.left}
            x2={META_PLOT_MARGIN.left}
            y1={META_PLOT_MARGIN.top}
            y2={META_PLOT_MARGIN.top + plotHeight}
            stroke={META_PLOT_AXIS_COLOR}
            strokeWidth={1.5}
          />

          {yTicks.map((tick) => {
            const y = scaleMetaPlotY(tick, plotHeight, payload.yDomain);
            return (
              <g key={`axis-${tick}`}>
                <line
                  x1={META_PLOT_MARGIN.left - 6}
                  x2={META_PLOT_MARGIN.left}
                  y1={y}
                  y2={y}
                  stroke={META_PLOT_AXIS_COLOR}
                  strokeWidth={1.2}
                />
                <text
                  x={META_PLOT_MARGIN.left - 18}
                  y={y + 5}
                  fill={META_PLOT_AXIS_COLOR}
                  fontSize="14"
                  fontFamily={META_PLOT_FONT_FAMILY}
                  textAnchor="end"
                >
                  {tick.toFixed(1)}
                </text>
              </g>
            );
          })}

          {(payload.components?.segments || []).map((segment, index) => {
            const fill =
              segment.component === "promoter" || segment.component === "tail"
                ? "#111111"
                : "#ffffff";
            const fillOpacity =
              segment.component === "promoter" || segment.component === "tail" ? 1 : segment.alpha;
            const segmentCenterY = baselineY;
            const segmentHeight = Math.max(
              metaPlotMinimumComponentHeight(segment.component),
              Math.abs(
                scaleMetaPlotY(componentBase - segment.height, plotHeight, payload.yDomain) -
                  scaleMetaPlotY(componentBase + segment.height, plotHeight, payload.yDomain)
              )
            );
            const segmentY = Math.round(segmentCenterY - segmentHeight / 2) + 0.5;
            const x1 = scaleMetaPlotX(segment.start, plotWidth, payload.xDomain);
            const x2 = scaleMetaPlotX(segment.end, plotWidth, payload.xDomain);
            const labelX = scaleMetaPlotX(segment.mid, plotWidth, payload.xDomain);
            const labelYPos = scaleMetaPlotY(labelY, plotHeight, payload.yDomain) + 12;

            return (
              <g key={`segment-${index}`}>
                <rect
                  x={x1}
                  y={segmentY}
                  width={Math.max(1, x2 - x1)}
                  height={Math.max(1, Math.round(segmentHeight))}
                  fill={fill}
                  fillOpacity={fillOpacity}
                  stroke="#111111"
                  strokeWidth={1.1}
                />
                <text
                  x={labelX}
                  y={labelYPos}
                  textAnchor="middle"
                  fill="#222222"
                  fontSize="14"
                  fontWeight="700"
                  fontFamily={META_PLOT_FONT_FAMILY}
                >
                  {segment.label}
                </text>
              </g>
            );
          })}

          {hoverState ? (
            <MetaPlotHoverMarker hoverState={hoverState} />
          ) : null}
        </g>

        <text
          x={META_PLOT_MARGIN.left}
          y="50"
          fill="#111111"
          fontSize="15"
          fontWeight="700"
          fontFamily={META_PLOT_FONT_FAMILY}
        >
          {payload.title || ""}
        </text>

        <text
          transform="translate(30, 250) rotate(-90)"
          fill="#111111"
          fontSize="15"
          fontWeight="700"
          fontFamily={META_PLOT_FONT_FAMILY}
        >
          {payload.yLabel || ""}
        </text>

        <MetaPlotLegend legendY={legendY} series={payload.series} />
      </svg>

      {hoverState ? (
        <MetaPlotTooltip
          hoverState={hoverState}
          yLabel={payload.yLabel || "Frequency"}
        />
      ) : null}
    </div>
  );
}
