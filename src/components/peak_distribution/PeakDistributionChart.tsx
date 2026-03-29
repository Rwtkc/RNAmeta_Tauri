import { useMemo, useRef, useState } from "react";
import type {
  PeakDistributionPayload,
  PeakDistributionSeries
} from "@/types/native";
import {
  AXIS_COLOR,
  computeLegendLayout,
  createBandScale,
  formatYAxisValue,
  GRID_COLOR,
  HEIGHT,
  HoverState,
  MARGIN,
  PANEL_FILL,
  resolveCategoryOriginalName,
  WIDTH,
  yScale
} from "./peakDistributionChartUtils";

export function PeakDistributionChart({
  payload
}: {
  payload: PeakDistributionPayload;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredKey, setHoveredKey] = useState("");
  const [hover, setHover] = useState<HoverState | null>(null);

  const geometry = useMemo(() => {
    const plotWidth = WIDTH - MARGIN.left - MARGIN.right;
    const plotHeight = HEIGHT - MARGIN.top - MARGIN.bottom;
    const categoryScale = createBandScale(
      payload.categories.length,
      0,
      plotWidth,
      payload.type === "grouped_bar" ? 0.18 : 0.3
    );

    const seriesCount = Math.max(1, payload.series.length);
    const innerScale = createBandScale(seriesCount, 0, categoryScale.bandwidth, 0.18);

    return {
      plotWidth,
      plotHeight,
      categoryScale,
      innerScale
    };
  }, [payload]);

  const groupedBars = useMemo(() => {
    if (payload.type !== "grouped_bar") {
      return [];
    }

    return payload.categories.flatMap((category, categoryIndex) =>
      payload.series.map((series, seriesIndex) => {
        const value = series.values[categoryIndex] ?? 0;
        const x =
          geometry.categoryScale.position(categoryIndex) +
          geometry.innerScale.position(seriesIndex);
        const y = yScale(value, payload.yDomain, geometry.plotHeight);
        const height = Math.max(0, geometry.plotHeight - y);

        return {
          key: `${category}::${series.name}`,
          category,
          sample: series.name,
          originalName: series.originalName || series.name,
          value,
          color: series.color,
          x,
          y,
          width: geometry.innerScale.bandwidth,
          height
        };
      })
    );
  }, [geometry, payload]);

  const stackedBars = useMemo(() => {
    if (payload.type !== "stacked_bar") {
      return [];
    }

    return payload.categories.flatMap((category, categoryIndex) => {
      let cumulative = 0;

      return payload.series.map((series) => {
        const value = series.values[categoryIndex] ?? 0;
        const start = cumulative;
        cumulative += value;
        const end = cumulative;
        const y = yScale(end, payload.yDomain, geometry.plotHeight);
        const nextY = yScale(start, payload.yDomain, geometry.plotHeight);

        return {
          key: `${category}::${series.name}`,
          category,
          sample: series.name,
          originalName: resolveCategoryOriginalName(
            payload,
            category,
            categoryIndex
          ),
          value,
          color: series.color,
          x: geometry.categoryScale.position(categoryIndex),
          y,
          width: geometry.categoryScale.bandwidth,
          height: Math.max(0, nextY - y)
        };
      });
    });
  }, [geometry, payload]);

  const legendLayout = useMemo(
    () =>
      computeLegendLayout(
        payload.series,
        WIDTH - MARGIN.left - MARGIN.right
      ),
    [payload.series]
  );

  const bars = payload.type === "grouped_bar" ? groupedBars : stackedBars;
  const yTicks = payload.yTicks.length
    ? payload.yTicks.filter(
        (tick) => tick >= payload.yDomain[0] && tick <= payload.yDomain[1]
      )
    : [0];

  function resolveTooltipPosition(clientX: number, clientY: number) {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return { left: 0, top: 0 };
    }

    return {
      left: clientX - rect.left + 18,
      top: clientY - rect.top - 18
    };
  }

  return (
    <div ref={containerRef} className="peak-distribution-d3-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={payload.title || "Peak Distribution chart"}
      >
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          <rect
            width={geometry.plotWidth}
            height={geometry.plotHeight}
            rx="18"
            fill={PANEL_FILL}
          />

          {yTicks.map((tick) => {
            const y = yScale(tick, payload.yDomain, geometry.plotHeight);
            return (
              <line
                key={`grid-${tick}`}
                x1="0"
                x2={geometry.plotWidth}
                y1={y}
                y2={y}
                stroke={GRID_COLOR}
                strokeWidth="1"
              />
            );
          })}

          <line
            x1="0"
            x2="0"
            y1="0"
            y2={geometry.plotHeight}
            stroke={AXIS_COLOR}
            strokeWidth="1.2"
          />

          {yTicks.map((tick) => {
            const y = yScale(tick, payload.yDomain, geometry.plotHeight);
            return (
              <g key={`tick-${tick}`}>
                <line
                  x1="-6"
                  x2="0"
                  y1={y}
                  y2={y}
                  stroke={AXIS_COLOR}
                  strokeWidth="1.1"
                />
                <text
                  x="-16"
                  y={y}
                  fill={AXIS_COLOR}
                  fontSize="13"
                  fontWeight="600"
                  textAnchor="end"
                  dominantBaseline="middle"
                >
                  {formatYAxisValue(tick, payload.type)}
                </text>
              </g>
            );
          })}

          {payload.categories.map((category, categoryIndex) => (
            <text
              key={`category-${category}`}
              x={
                geometry.categoryScale.position(categoryIndex) +
                geometry.categoryScale.bandwidth / 2
              }
              y={geometry.plotHeight + 32}
              fill={AXIS_COLOR}
              fontSize="13"
              fontWeight="700"
              textAnchor="middle"
            >
              {category}
            </text>
          ))}

          <line
            x1="0"
            x2={geometry.plotWidth}
            y1={geometry.plotHeight}
            y2={geometry.plotHeight}
            stroke={AXIS_COLOR}
            strokeWidth="1.2"
          />

          {bars.map((bar) => {
            const isHovered = hoveredKey === bar.key;
            return (
              <rect
                key={bar.key}
                x={bar.x}
                y={bar.y}
                width={bar.width}
                height={bar.height}
                fill={bar.color}
                stroke={isHovered ? AXIS_COLOR : "none"}
                strokeWidth={isHovered ? 1.4 : 0}
                onMouseEnter={(event) => {
                  const position = resolveTooltipPosition(
                    event.clientX,
                    event.clientY
                  );
                  setHoveredKey(bar.key);
                  setHover({
                    x: position.left,
                    y: position.top,
                    category: bar.category,
                    sample: bar.sample,
                    originalName: bar.originalName,
                    value: bar.value
                  });
                }}
                onMouseMove={(event) => {
                  const position = resolveTooltipPosition(
                    event.clientX,
                    event.clientY
                  );
                  setHover((current) =>
                    current
                      ? {
                          ...current,
                          x: position.left,
                          y: position.top
                        }
                      : {
                          x: position.left,
                          y: position.top,
                          category: bar.category,
                          sample: bar.sample,
                          originalName: bar.originalName,
                          value: bar.value
                        }
                  );
                }}
                onMouseLeave={() => {
                  setHoveredKey("");
                  setHover(null);
                }}
              />
            );
          })}

          {payload.showLabels && payload.type === "grouped_bar"
            ? groupedBars.map((bar) =>
                bar.value > 0 ? (
                  <text
                    key={`label-${bar.key}`}
                    x={bar.x + bar.width / 2}
                    y={bar.y - 8}
                    fill={AXIS_COLOR}
                    fontSize="12"
                    fontWeight="700"
                    textAnchor="middle"
                  >
                    {bar.value}
                  </text>
                ) : null
              )
            : null}
        </g>

        <text
          x={MARGIN.left}
          y="80"
          fill="#22301f"
          fontSize="15"
          fontWeight="800"
        >
          {payload.title || "Peak Distribution"}
        </text>

        <text
          transform={`translate(26, ${MARGIN.top + geometry.plotHeight / 2}) rotate(-90)`}
          fill={AXIS_COLOR}
          fontSize="15"
          fontWeight="700"
        >
          {payload.yLabel || ""}
        </text>

        <g transform={`translate(${MARGIN.left}, ${HEIGHT - 48})`}>
          {legendLayout.map((entry) => (
            <g
              key={`legend-${entry.series.name}`}
              transform={`translate(${entry.x}, ${entry.y})`}
            >
              <rect
                width={entry.rectSize}
                height={entry.rectSize}
                rx="4"
                fill={entry.series.color}
              />
              <text
                x={entry.textX}
                y={entry.textY}
                dominantBaseline="middle"
                fill={AXIS_COLOR}
                fontSize="13"
                fontWeight="600"
              >
                {entry.series.name}
              </text>
            </g>
          ))}
        </g>
      </svg>

      <div
        className="peak-distribution-tooltip"
        data-visible={hover ? "true" : "false"}
        style={
          hover
            ? {
                left: `${hover.x + 16}px`,
                top: `${hover.y - 18}px`
              }
            : undefined
        }
      >
        {hover ? (
          <>
            <div className="peak-distribution-tooltip__label">{hover.category}</div>
            <div className="peak-distribution-tooltip__row">
              <span>
                {payload.tooltipSeriesLabel ||
                  (payload.type === "stacked_bar" ? "Series" : "Sample")}
              </span>
              <strong>{hover.sample}</strong>
            </div>
            {hover.originalName && hover.originalName !== hover.sample ? (
              <div className="peak-distribution-tooltip__row peak-distribution-tooltip__row--file">
                <span>File</span>
                <strong>{hover.originalName}</strong>
              </div>
            ) : null}
            <div className="peak-distribution-tooltip__row">
              <span>
                {payload.tooltipValueLabel ||
                  (payload.type === "stacked_bar" ? "Percentage" : "Frequency")}
              </span>
              <strong>
                {payload.type === "stacked_bar"
                  ? `${Number(hover.value).toFixed(1).replace(/\.0$/, "")}%`
                  : hover.value}
              </strong>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
