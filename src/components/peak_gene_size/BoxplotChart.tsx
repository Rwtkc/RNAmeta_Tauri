import { useMemo, useRef, useState } from "react";
import type { BoxplotPayload, BoxplotGroup } from "@/types/native";
import {
  BoxplotSummary,
  createBandScale,
  formatMetric,
  GRID,
  HEIGHT,
  MARGIN,
  summarizeGroup,
  SURFACE,
  TEXT_COLOR,
  TITLE_COLOR,
  WIDTH
} from "./boxplotChartUtils";

interface HoverState {
  x: number;
  y: number;
  name: string;
  originalName: string;
  countLabel: string;
  scaleTransform: string;
  count: number;
  median: number;
  q1: number;
  q3: number;
}

export function BoxplotChart({ payload }: { payload: BoxplotPayload }) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<HoverState | null>(null);

  const scaleTransform = payload.scaleTransform === "linear" ? "linear" : "log2";
  const countLabel = payload.countLabel || "Transcripts";

  const summaries = useMemo(() => {
    return (payload.groups || [])
      .map((group: BoxplotGroup) => ({
        name: group.name,
        originalName: group.originalName || group.name,
        color: group.color,
        summary: summarizeGroup(group.values || [], scaleTransform)
      }))
      .filter(
        (entry): entry is typeof entry & { summary: BoxplotSummary } =>
          entry.summary !== null
      );
  }, [payload.groups, scaleTransform]);

  const geometry = useMemo(() => {
    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const innerHeight = HEIGHT - MARGIN.top - MARGIN.bottom;

    const allDisplayExtrema = summaries.flatMap((entry) => {
      const values = [
        entry.summary.lowerWhisker,
        entry.summary.q1,
        entry.summary.median,
        entry.summary.q3,
        entry.summary.upperWhisker
      ];

      for (const outlier of entry.summary.outliers) {
        values.push(outlier.display);
      }

      return values;
    });
    const domainMaxBase = Math.max(...allDisplayExtrema) || 1;
    const domainMinBase = Math.min(...allDisplayExtrema) || 0;
    const domainPadding =
      scaleTransform === "linear"
        ? Math.max(1, (domainMaxBase - domainMinBase) * 0.05)
        : Math.max(0.2, (domainMaxBase - domainMinBase) * 0.05);
    const domainMin =
      scaleTransform === "linear"
        ? Math.min(0, domainMinBase - domainPadding)
        : Math.max(0, domainMinBase - domainPadding);
    const domainMaxFinal = domainMaxBase + domainPadding;

    const xScale = createBandScale(summaries.length, 0, innerWidth);

    return { innerWidth, innerHeight, domainMin, domainMax: domainMaxFinal, xScale };
  }, [summaries, scaleTransform]);

  function yScale(value: number) {
    const { domainMin, domainMax, innerHeight } = geometry;
    if (domainMax <= domainMin) {
      return innerHeight;
    }
    const ratio = (value - domainMin) / (domainMax - domainMin);
    return innerHeight - ratio * innerHeight;
  }

  function computeYTicks() {
    const { domainMin, domainMax } = geometry;
    const range = domainMax - domainMin;
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

    const start = Math.floor(domainMin / niceStep) * niceStep;
    const ticks: number[] = [];
    for (let t = start; t <= domainMax + niceStep * 0.01; t += niceStep) {
      if (t >= domainMin && t <= domainMax) {
        ticks.push(Math.round(t * 1000) / 1000);
      }
    }

    return ticks;
  }

  const yTicks = computeYTicks();

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

  if (!summaries.length) {
    return null;
  }

  return (
    <div ref={containerRef} className="peak-gene-size-d3-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={payload.title || "Boxplot chart"}
      >
        <g transform={`translate(${MARGIN.left}, ${MARGIN.top})`}>
          <rect
            width={geometry.innerWidth}
            height={geometry.innerHeight}
            rx="18"
            fill={SURFACE}
          />

          {yTicks.map((tick) => (
            <line
              key={`grid-${tick}`}
              x1="0"
              x2={geometry.innerWidth}
              y1={yScale(tick)}
              y2={yScale(tick)}
              stroke={GRID}
              strokeWidth="1"
            />
          ))}

          <line
            x1="0"
            x2="0"
            y1="0"
            y2={geometry.innerHeight}
            stroke={TEXT_COLOR}
            strokeWidth="1.2"
          />

          {yTicks.map((tick) => (
            <g key={`tick-${tick}`}>
              <line
                x1="-6"
                x2="0"
                y1={yScale(tick)}
                y2={yScale(tick)}
                stroke={TEXT_COLOR}
                strokeWidth="1.1"
              />
              <text
                x="-16"
                y={yScale(tick)}
                fill={TEXT_COLOR}
                fontSize="13"
                fontWeight="600"
                textAnchor="end"
                dominantBaseline="middle"
              >
                {tick}
              </text>
            </g>
          ))}

          <line
            x1="0"
            x2={geometry.innerWidth}
            y1={geometry.innerHeight}
            y2={geometry.innerHeight}
            stroke={TEXT_COLOR}
            strokeWidth="1.2"
          />

          {summaries.map((entry, index) => {
            const xPos = geometry.xScale.position(index);
            const bw = geometry.xScale.bandwidth;
            return (
              <text
                key={`label-${entry.name}`}
                x={xPos + bw / 2}
                y={geometry.innerHeight + 32}
                fill={TEXT_COLOR}
                fontSize="13"
                fontWeight="700"
                textAnchor="middle"
              >
                {entry.name}
              </text>
            );
          })}

          {summaries.map((entry, index) => {
            const xPos = geometry.xScale.position(index);
            const bw = geometry.xScale.bandwidth;
            const { summary } = entry;
            return (
              <g key={`box-${entry.name}`} transform={`translate(${xPos}, 0)`}>
                {/* whisker line */}
                <line
                  x1={bw / 2}
                  x2={bw / 2}
                  y1={yScale(summary.lowerWhisker)}
                  y2={yScale(summary.upperWhisker)}
                  stroke={TEXT_COLOR}
                  strokeWidth="1.6"
                />

                {/* IQR box */}
                <rect
                  x={bw * 0.18}
                  width={bw * 0.64}
                  y={yScale(summary.q3)}
                  height={Math.max(
                    1,
                    yScale(summary.q1) - yScale(summary.q3)
                  )}
                  fill={entry.color}
                  fillOpacity="0.84"
                  stroke="#ffffff"
                  strokeWidth="1.2"
                />

                {/* median line */}
                <line
                  x1={bw * 0.18}
                  x2={bw * 0.82}
                  y1={yScale(summary.median)}
                  y2={yScale(summary.median)}
                  stroke="#ffffff"
                  strokeWidth="2"
                />

                {/* whisker caps */}
                {[summary.lowerWhisker, summary.upperWhisker].map((value) => (
                  <line
                    key={`cap-${value}`}
                    x1={bw * 0.3}
                    x2={bw * 0.7}
                    y1={yScale(value)}
                    y2={yScale(value)}
                    stroke={TEXT_COLOR}
                    strokeWidth="1.6"
                  />
                ))}

                {/* outliers */}
                {summary.outliers.map((outlier, oi) => (
                  <circle
                    key={`outlier-${oi}`}
                    cx={bw / 2}
                    cy={yScale(outlier.display)}
                    r="4"
                    fill={entry.color}
                    stroke="#111111"
                    strokeWidth="1.1"
                  />
                ))}

                {/* hover target */}
                <rect
                  x="0"
                  y="0"
                  width={bw}
                  height={geometry.innerHeight}
                  fill="transparent"
                  style={{ pointerEvents: "all" }}
                  onMouseEnter={(event) => {
                    const pos = resolveTooltipPosition(
                      event.clientX,
                      event.clientY
                    );
                    setHover({
                      x: pos.left,
                      y: pos.top,
                      name: entry.name,
                      originalName: entry.originalName,
                      countLabel,
                      scaleTransform,
                      count: summary.count,
                      median: summary.median,
                      q1: summary.q1,
                      q3: summary.q3
                    });
                  }}
                  onMouseMove={(event) => {
                    const pos = resolveTooltipPosition(
                      event.clientX,
                      event.clientY
                    );
                    setHover((current) =>
                      current
                        ? { ...current, x: pos.left, y: pos.top }
                        : null
                    );
                  }}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            );
          })}
        </g>

        <text
          x={MARGIN.left}
          y="80"
          fill={TITLE_COLOR}
          fontSize="15"
          fontWeight="800"
        >
          {payload.title || "Peak Gene Size"}
        </text>

        <text
          transform={`translate(28, ${
            MARGIN.top + geometry.innerHeight / 2 + 30
          }) rotate(-90)`}
          fill={TEXT_COLOR}
          fontSize="15"
          fontWeight="700"
        >
          {payload.yLabel || ""}
        </text>
      </svg>

      <div
        className="peak-gene-size-tooltip"
        data-visible={hover ? "true" : "false"}
        style={
          hover
            ? { left: `${hover.x + 16}px`, top: `${hover.y - 18}px` }
            : undefined
        }
      >
        {hover ? (
          <>
            <strong>{hover.name}</strong>
            {hover.originalName && hover.originalName !== hover.name ? (
              <div className="peak-gene-size-tooltip__row peak-gene-size-tooltip__row--file">
                <span>File</span>
                <strong>{hover.originalName}</strong>
              </div>
            ) : null}
            <div className="peak-gene-size-tooltip__row">
              <span>{hover.countLabel}</span>
              <strong>{hover.count}</strong>
            </div>
            <div className="peak-gene-size-tooltip__row">
              <span>Median</span>
              <strong>
                {formatMetric(hover.median, hover.scaleTransform)}
              </strong>
            </div>
            <div className="peak-gene-size-tooltip__row">
              <span>Q1-Q3</span>
              <strong>
                {formatMetric(hover.q1, hover.scaleTransform)} -{" "}
                {formatMetric(hover.q3, hover.scaleTransform)}
              </strong>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
