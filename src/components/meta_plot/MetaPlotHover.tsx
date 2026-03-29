import type { MetaPlotSeries, MetaPlotSeriesValue } from "@/types/native";
import { formatFrequency, formatPosition } from "./metaPlotInteractiveHelpers";

export interface MetaPlotHoverState {
  series: MetaPlotSeries;
  datum: MetaPlotSeriesValue;
  x: number;
  y: number;
  tooltipX: number;
  tooltipY: number;
}

export function MetaPlotHoverMarker({ hoverState }: { hoverState: MetaPlotHoverState }) {
  return (
    <g className="meta-plot-hover-marker">
      <circle cx={hoverState.x} cy={hoverState.y} r={6} fill="#ffffff" />
      <circle
        cx={hoverState.x}
        cy={hoverState.y}
        r={4}
        fill={hoverState.series.color}
        stroke="#ffffff"
        strokeWidth={1.4}
      />
    </g>
  );
}

export function MetaPlotTooltip({
  hoverState,
  yLabel
}: {
  hoverState: MetaPlotHoverState;
  yLabel: string;
}) {
  return (
    <div
      className="meta-plot-tooltip"
      style={{
        left: `${hoverState.tooltipX}px`,
        top: `${hoverState.tooltipY}px`
      }}
    >
      <div className="meta-plot-tooltip__label">{hoverState.series.name}</div>
      {hoverState.series.originalName !== hoverState.series.name ? (
        <div className="meta-plot-tooltip__row meta-plot-tooltip__row--file">
          <span>File</span>
          <strong>{hoverState.series.originalName}</strong>
        </div>
      ) : null}
      <div className="meta-plot-tooltip__row">
        <span>Position</span>
        <strong>{formatPosition(hoverState.datum.x)}</strong>
      </div>
      <div className="meta-plot-tooltip__row">
        <span>{yLabel}</span>
        <strong>{formatFrequency(hoverState.datum.density)}</strong>
      </div>
    </div>
  );
}
