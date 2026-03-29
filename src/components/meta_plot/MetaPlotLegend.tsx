import type { MetaPlotSeries } from "@/types/native";
import {
  computeMetaPlotLegendLayouts,
  META_PLOT_FONT_FAMILY,
  META_PLOT_MARGIN,
  META_PLOT_WIDTH
} from "@/lib/metaPlotSvg";

export function MetaPlotLegend({
  legendY,
  series
}: {
  legendY: number;
  series: MetaPlotSeries[];
}) {
  return (
    <g>
      {computeMetaPlotLegendLayouts(
        series,
        META_PLOT_WIDTH - META_PLOT_MARGIN.left - META_PLOT_MARGIN.right
      ).map((entry, index) => (
        <g
          key={`legend-${index}`}
          transform={`translate(${META_PLOT_MARGIN.left + entry.x}, ${legendY + entry.y})`}
        >
          <rect
            x="0"
            y={entry.rectY}
            width={entry.rectSize}
            height={entry.rectSize}
            fill={entry.series.color}
            fillOpacity={0.18}
            stroke={entry.series.color}
            strokeWidth={2}
          />
          <text
            x={entry.textX}
            y={entry.textY}
            fill="#222222"
            dominantBaseline="middle"
            fontSize="15"
            fontWeight="700"
            fontFamily={META_PLOT_FONT_FAMILY}
          >
            {entry.series.name}
          </text>
        </g>
      ))}
    </g>
  );
}
