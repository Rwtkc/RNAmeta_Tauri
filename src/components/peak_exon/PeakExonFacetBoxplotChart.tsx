import { useMemo, useRef, useState } from "react";
import type {
  BoxplotGroup,
  FacetedBoxplotFacet,
  FacetedBoxplotPayload
} from "@/types/native";
import {
  BoxplotSummary,
  computeYTicks,
  createBandScale,
  FACET_GAP,
  FACET_WIDTH,
  formatMetric,
  GRID,
  HEIGHT,
  MARGIN,
  PANEL_HEIGHT,
  resolveTooltipPosition,
  summarizeGroup,
  SURFACE,
  TEXT_COLOR,
  TITLE_COLOR,
  WIDTH
} from "./peakExonFacetBoxplotUtils";

interface TooltipState {
  x: number;
  y: number;
  facet: string;
  group: string;
  originalName: string;
  countLabel: string;
  scaleTransform: "log2" | "linear";
  summary: BoxplotSummary;
}


export function PeakExonFacetBoxplotChart({
  payload
}: {
  payload: FacetedBoxplotPayload;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<TooltipState | null>(null);
  const scaleTransform = payload.scaleTransform === "linear" ? "linear" : "log2";
  const countLabel = payload.countLabel || "Count";

  const facets = useMemo(() => {
    return (payload.facets || [])
      .map((facet: FacetedBoxplotFacet) => ({
        name: facet.name,
        groups: (facet.groups || [])
          .map((group: BoxplotGroup) => ({
            name: group.name,
            originalName: group.originalName || group.name,
            color: group.color,
            summary: summarizeGroup(group.values || [], scaleTransform)
          }))
          .filter(
            (entry): entry is typeof entry & { summary: BoxplotSummary } =>
              entry.summary !== null
          )
      }))
      .filter((facet) => facet.groups.length > 0);
  }, [payload.facets, scaleTransform]);

  const geometry = useMemo(() => {
    const innerWidth = WIDTH - MARGIN.left - MARGIN.right;
    const contentWidth =
      facets.length * FACET_WIDTH + Math.max(0, facets.length - 1) * FACET_GAP;
    const startLeft =
      MARGIN.left + Math.max(0, (innerWidth - contentWidth) / 2);
    const values = facets.flatMap((facet) =>
      facet.groups.flatMap((group) => [
        group.summary.lowerWhisker,
        group.summary.upperWhisker,
        ...group.summary.outliers.map((entry) => entry.display)
      ])
    );
    const maxBase = Math.max(...values) || 1;
    const minBase = Math.min(...values) || 0;
    const minValue =
      scaleTransform === "linear"
        ? Math.min(0, Math.floor(minBase))
        : Math.max(0, minBase - 0.25);
    const maxValue =
      maxBase + (scaleTransform === "linear" ? 1 : 0.25);

    return {
      startLeft,
      minValue,
      maxValue,
      yTicks: computeYTicks(minValue, maxValue)
    };
  }, [facets, scaleTransform]);

  function yScale(value: number) {
    if (geometry.maxValue <= geometry.minValue) {
      return PANEL_HEIGHT;
    }

    const ratio =
      (value - geometry.minValue) / (geometry.maxValue - geometry.minValue);
    return PANEL_HEIGHT - ratio * PANEL_HEIGHT;
  }

  if (!facets.length) {
    return null;
  }

  return (
    <div ref={containerRef} className="peak-gene-size-d3-chart">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        preserveAspectRatio="xMinYMin meet"
        role="img"
        aria-label={payload.title || "Peak Exon Size chart"}
      >
        <text
          x={MARGIN.left}
          y={MARGIN.top - 10}
          fill={TITLE_COLOR}
          fontSize="15"
          fontWeight="800"
        >
          {payload.title || "Peak Exon Size"}
        </text>

        <text
          transform={`translate(90, ${MARGIN.top + PANEL_HEIGHT / 2 + 50}) rotate(-90)`}
          fill={TEXT_COLOR}
          fontSize="15"
          fontWeight="700"
        >
          {payload.yLabel}
        </text>

        {facets.map((facet, facetIndex) => {
          const xScale = createBandScale(facet.groups.length, 0, FACET_WIDTH);
          const facetLeft =
            geometry.startLeft + facetIndex * (FACET_WIDTH + FACET_GAP);

          return (
            <g
              key={facet.name}
              transform={`translate(${facetLeft}, ${MARGIN.top})`}
            >
              <rect
                width={FACET_WIDTH}
                height={PANEL_HEIGHT}
                rx="18"
                fill={SURFACE}
              />

              {geometry.yTicks.map((tick) => (
                <line
                  key={`${facet.name}-grid-${tick}`}
                  x1="0"
                  x2={FACET_WIDTH}
                  y1={yScale(tick)}
                  y2={yScale(tick)}
                  stroke={GRID}
                  strokeWidth="1"
                />
              ))}

              {facetIndex === 0 ? (
                <>
                  <line
                    x1="0"
                    x2="0"
                    y1="0"
                    y2={PANEL_HEIGHT}
                    stroke={TEXT_COLOR}
                    strokeWidth="1.2"
                  />
                  {geometry.yTicks.map((tick) => (
                    <g key={`${facet.name}-tick-${tick}`}>
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
                </>
              ) : null}

              <line
                x1="0"
                x2={FACET_WIDTH}
                y1={PANEL_HEIGHT}
                y2={PANEL_HEIGHT}
                stroke={TEXT_COLOR}
                strokeWidth="1.2"
              />

              <text
                x={FACET_WIDTH / 2}
                y="-10"
                textAnchor="middle"
                fill={TITLE_COLOR}
                fontSize="15"
                fontWeight="800"
              >
                {facet.name}
              </text>

              {facet.groups.map((group, groupIndex) => {
                const xPos = xScale.position(groupIndex);
                const bandwidth = xScale.bandwidth;

                return (
                  <g
                    key={`${facet.name}-${group.name}`}
                    transform={`translate(${xPos}, 0)`}
                  >
                    <line
                      x1={bandwidth / 2}
                      x2={bandwidth / 2}
                      y1={yScale(group.summary.lowerWhisker)}
                      y2={yScale(group.summary.upperWhisker)}
                      stroke={TEXT_COLOR}
                      strokeWidth="1.6"
                    />
                    <rect
                      x={bandwidth * 0.18}
                      width={bandwidth * 0.64}
                      y={yScale(group.summary.q3)}
                      height={Math.max(
                        1,
                        yScale(group.summary.q1) - yScale(group.summary.q3)
                      )}
                      fill={group.color}
                      fillOpacity="0.86"
                      stroke="#ffffff"
                      strokeWidth="1.2"
                    />
                    <line
                      x1={bandwidth * 0.18}
                      x2={bandwidth * 0.82}
                      y1={yScale(group.summary.median)}
                      y2={yScale(group.summary.median)}
                      stroke="#ffffff"
                      strokeWidth="2"
                    />
                    {[group.summary.lowerWhisker, group.summary.upperWhisker].map(
                      (value, index) => (
                        <line
                          key={`${facet.name}-${group.name}-whisker-${index}`}
                          x1={bandwidth * 0.3}
                          x2={bandwidth * 0.7}
                          y1={yScale(value)}
                          y2={yScale(value)}
                          stroke={TEXT_COLOR}
                          strokeWidth="1.6"
                        />
                      )
                    )}
                    {group.summary.outliers.map((entry, index) => (
                      <circle
                        key={`${facet.name}-${group.name}-outlier-${index}`}
                        cx={bandwidth / 2}
                        cy={yScale(entry.display)}
                        r="3.7"
                        fill={group.color}
                        stroke="#111111"
                        strokeWidth="1"
                      />
                    ))}
                    <text
                      x={bandwidth / 2}
                      y={PANEL_HEIGHT + 32}
                      fill={TEXT_COLOR}
                      fontSize="13"
                      fontWeight="700"
                      textAnchor="middle"
                    >
                      {group.name}
                    </text>
                    <rect
                      x="0"
                      y="0"
                      width={bandwidth}
                      height={PANEL_HEIGHT}
                      fill="transparent"
                      onMouseEnter={(event) => {
                        const position = resolveTooltipPosition(
                          containerRef.current,
                          event.clientX,
                          event.clientY
                        );
                        setHover({
                          x: position.left,
                          y: position.top,
                          facet: facet.name,
                          group: group.name,
                          originalName: group.originalName,
                          countLabel,
                          scaleTransform,
                          summary: group.summary
                        });
                      }}
                      onMouseMove={(event) => {
                        const position = resolveTooltipPosition(
                          containerRef.current,
                          event.clientX,
                          event.clientY
                        );
                        setHover((current) =>
                          current
                            ? { ...current, x: position.left, y: position.top }
                            : null
                        );
                      }}
                      onMouseLeave={() => setHover(null)}
                    />
                  </g>
                );
              })}
            </g>
          );
        })}
      </svg>

      <div
        className="peak-gene-size-tooltip"
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
            <div className="peak-gene-size-tooltip__label">{hover.facet}</div>
            <div className="peak-gene-size-tooltip__row">
              <span>Sample</span>
              <strong>{hover.group}</strong>
            </div>
            {hover.originalName && hover.originalName !== hover.group ? (
              <div className="peak-gene-size-tooltip__row peak-gene-size-tooltip__row--file">
                <span>File</span>
                <strong>{hover.originalName}</strong>
              </div>
            ) : null}
            <div className="peak-gene-size-tooltip__row">
              <span>{hover.countLabel}</span>
              <strong>{hover.summary.count}</strong>
            </div>
            <div className="peak-gene-size-tooltip__row">
              <span>Median</span>
              <strong>
                {formatMetric(hover.summary.rawMedian, hover.scaleTransform)}
              </strong>
            </div>
            <div className="peak-gene-size-tooltip__row">
              <span>Q1-Q3</span>
              <strong>
                {formatMetric(hover.summary.rawQ1, hover.scaleTransform)} -{" "}
                {formatMetric(hover.summary.rawQ3, hover.scaleTransform)}
              </strong>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
