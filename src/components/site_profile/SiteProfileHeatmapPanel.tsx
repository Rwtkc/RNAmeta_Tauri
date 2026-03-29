import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type PointerEvent as ReactPointerEvent
} from "react";
import {
  buildHeatmapColorScale,
  buildHeatmapTileLookup,
  buildHeatmapTiles,
  resolveHeatmapDisplayMax,
  resolveHeatmapHoverTile
} from "@/components/site_profile/siteProfileHeatmapView";
import {
  HEATMAP_AXIS_GAP_PX,
  HEATMAP_SHOW_SAMPLE_LABEL,
  getStackedHeatmapContentStyle,
  getStackedHeatmapPlotRowStyle,
  getStackedSiteProfileTitleStyle,
  resolveHeatmapAxisViewportWidth,
  resolveHeatmapYAxisViewportWidth
} from "@/components/site_profile/siteProfileLayout";
import {
  drawHeatmapXAxis,
  drawHeatmapYAxis,
  formatHeatmapTooltipX,
  HEATMAP_PANEL_AXIS_HEIGHT,
  HEATMAP_PANEL_LAYOUT,
  HEATMAP_PANEL_Y_AXIS_WIDTH,
  type HeatmapPanelData
} from "@/components/site_profile/siteProfileHeatmapPanelHelpers";

export function SiteProfileHeatmapPanel(props: { panel: HeatmapPanelData }) {
  const axisRef = useRef<SVGSVGElement | null>(null);
  const yAxisRef = useRef<SVGSVGElement | null>(null);
  const contentRef = useRef<HTMLDivElement | null>(null);
  const mainRef = useRef<HTMLDivElement | null>(null);
  const layoutMode =
    props.panel.layoutMode === "stacked" ? "stacked" : "compact";
  const [axisWidth, setAxisWidth] = useState(() =>
    resolveHeatmapAxisViewportWidth(layoutMode)
  );
  const [yAxisWidth, setYAxisWidth] = useState(() =>
    resolveHeatmapYAxisViewportWidth()
  );
  const displayHeightPx =
    Number.isFinite(Number(props.panel.displayHeightPx)) &&
    Number(props.panel.displayHeightPx) > 0
      ? Number(props.panel.displayHeightPx)
      : 240;
  const heatmapPixelHeight = Math.max(220, Math.round(displayHeightPx));
  const cornerRadius = Number.isFinite(Number(props.panel.cornerRadiusPx))
    ? Math.max(0, Number(props.panel.cornerRadiusPx))
    : 0;
  const [tooltip, setTooltip] = useState<{
    rowIndex: number;
    columnIndex: number;
    value: number;
    xValue: number;
    left: number;
    top: number;
  } | null>(null);
  const contentStyle =
    layoutMode === "stacked" ? getStackedHeatmapContentStyle() : undefined;
  const titleStyle =
    layoutMode === "stacked" ? getStackedSiteProfileTitleStyle() : undefined;
  const frameStyle = {
    height: `${heatmapPixelHeight}px`,
    boxSizing: "border-box" as const,
    borderRadius: `${cornerRadius}px`,
    background: props.panel.backgroundColor || "#fffaf3"
  };
  const plotRowStyle =
    layoutMode === "stacked"
      ? getStackedHeatmapPlotRowStyle()
      : {
          gridTemplateColumns: `${HEATMAP_PANEL_Y_AXIS_WIDTH}px minmax(0, 1fr)`,
          columnGap: `${HEATMAP_PANEL_LAYOUT.axisGapPx}px`
        };
  const yAxisStyle = {
    width:
      layoutMode === "stacked" ? "100%" : `${HEATMAP_PANEL_Y_AXIS_WIDTH}px`,
    height: `${heatmapPixelHeight}px`,
    overflow: "visible" as const
  };
  const heatmapBodyHeightUnits = Math.max(1, props.panel.rows || 1);

  const tiles = useMemo(() => buildHeatmapTiles(props.panel), [props.panel]);
  const tileLookup = useMemo(() => buildHeatmapTileLookup(tiles), [tiles]);
  const displayMaxSignal = useMemo(
    () => resolveHeatmapDisplayMax(tiles, props.panel.colorMaxQuantile ?? 1),
    [props.panel.colorMaxQuantile, tiles]
  );
  const colorScale = useMemo(
    () => buildHeatmapColorScale(props.panel.palette, displayMaxSignal),
    [displayMaxSignal, props.panel.palette]
  );

  useEffect(() => {
    const targetNode = mainRef.current;
    const yAxisNode = yAxisRef.current;

    if (!targetNode || !yAxisNode) {
      setAxisWidth(resolveHeatmapAxisViewportWidth(layoutMode));
      setYAxisWidth(resolveHeatmapYAxisViewportWidth());
      return;
    }

    const updateAxisWidth = () => {
      setAxisWidth(
        resolveHeatmapAxisViewportWidth(
          layoutMode,
          targetNode.getBoundingClientRect().width
        )
      );
      setYAxisWidth(
        resolveHeatmapYAxisViewportWidth(yAxisNode.getBoundingClientRect().width)
      );
    };

    updateAxisWidth();

    const resizeObserver = new ResizeObserver(() => {
      updateAxisWidth();
    });
    resizeObserver.observe(targetNode);
    resizeObserver.observe(yAxisNode);

    return () => {
      resizeObserver.disconnect();
    };
  }, [layoutMode]);

  useEffect(() => {
    if (axisRef.current) {
      drawHeatmapXAxis(axisRef.current, props.panel, layoutMode, axisWidth);
    }
    if (yAxisRef.current) {
      drawHeatmapYAxis(yAxisRef.current, props.panel.rows || 0, displayHeightPx);
    }
  }, [axisWidth, displayHeightPx, layoutMode, props.panel]);

  function hideTooltip() {
    setTooltip(null);
  }

  function showTooltip(event: ReactPointerEvent<SVGSVGElement>, tile: {
    rowIndex: number;
    columnIndex: number;
    value: number;
  }) {
    if (!contentRef.current) {
      return;
    }

    const hostRect = contentRef.current.getBoundingClientRect();
    const nextTooltip = {
      rowIndex: tile.rowIndex,
      columnIndex: tile.columnIndex,
      value: tile.value,
      xValue: formatHeatmapTooltipX(props.panel, tile.columnIndex),
      left: event.clientX - hostRect.left + 14,
      top: event.clientY - hostRect.top + 14
    };

    setTooltip((previousTooltip) => {
      if (
        previousTooltip &&
        previousTooltip.rowIndex === nextTooltip.rowIndex &&
        previousTooltip.columnIndex === nextTooltip.columnIndex &&
        Math.abs(previousTooltip.left - nextTooltip.left) < 6 &&
        Math.abs(previousTooltip.top - nextTooltip.top) < 6
      ) {
        return previousTooltip;
      }

      return nextTooltip;
    });
  }

  function handleHeatmapPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    const svgRect = event.currentTarget.getBoundingClientRect();
    const tile = resolveHeatmapHoverTile({
      offsetX: event.clientX - svgRect.left,
      offsetY: event.clientY - svgRect.top,
      width: svgRect.width,
      height: svgRect.height,
      rowCount: props.panel.rows || 0,
      columnCount: props.panel.columns || 0,
      tileLookup
    });

    if (!tile) {
      hideTooltip();
      return;
    }

    showTooltip(event, tile);
  }

  return (
    <section className="site-profile-chart-panel">
      <h3 className="site-profile-chart-panel__title" style={titleStyle}>
        {props.panel.title}
      </h3>
      <div
        ref={contentRef}
        className="site-profile-heatmap-panel__content"
        style={contentStyle}
        onMouseLeave={hideTooltip}
        onPointerLeave={hideTooltip}
      >
        <div className="site-profile-heatmap-panel__plot-row" style={plotRowStyle}>
          <svg
            ref={yAxisRef}
            className="site-profile-heatmap-panel__y-axis"
            viewBox={`0 0 ${yAxisWidth} ${heatmapPixelHeight}`}
            preserveAspectRatio="none"
            style={yAxisStyle}
            aria-hidden="true"
          />
          <div ref={mainRef} className="site-profile-heatmap-panel__main">
            <div
              className="site-profile-heatmap-panel__frame"
              style={frameStyle}
              onMouseLeave={hideTooltip}
              onPointerLeave={hideTooltip}
            >
              <svg
                className="site-profile-heatmap-panel__body"
                viewBox={`0 0 ${Math.max(1, props.panel.columns || 1)} ${heatmapBodyHeightUnits}`}
                preserveAspectRatio="none"
                style={{ height: "100%" }}
                shapeRendering="crispEdges"
                onPointerMove={handleHeatmapPointerMove}
                onMouseLeave={hideTooltip}
                onPointerLeave={hideTooltip}
              >
                <rect
                  x="0"
                  y="0"
                  width={Math.max(1, props.panel.columns || 1)}
                  height={heatmapBodyHeightUnits}
                  fill={props.panel.backgroundColor || "#fffaf3"}
                />
                {tiles.map((tile) => (
                  <rect
                    key={`${tile.rowIndex}-${tile.columnIndex}`}
                    x={tile.columnIndex - 1}
                    y={tile.rowIndex - 1}
                    width="1"
                    height="1"
                    fill={colorScale(tile.value)}
                    stroke="none"
                  />
                ))}
              </svg>
            </div>
            <svg
              ref={axisRef}
              className="site-profile-heatmap-panel__axis"
              viewBox={`0 0 ${axisWidth} ${HEATMAP_PANEL_AXIS_HEIGHT}`}
              preserveAspectRatio="xMinYMin meet"
              aria-hidden="true"
            />
            {HEATMAP_SHOW_SAMPLE_LABEL ? (
              <div className="site-profile-heatmap-panel__sample">
                {props.panel.sampleName || ""}
              </div>
            ) : null}
          </div>
        </div>
        <div
          className="site-profile-tooltip site-profile-heatmap-panel__tooltip"
          data-visible={tooltip ? "true" : "false"}
          style={
            tooltip
              ? { left: `${tooltip.left}px`, top: `${tooltip.top}px` }
              : undefined
          }
        >
          <span className="site-profile-tooltip__label">
            {props.panel.sampleName || ""}
          </span>
          <div className="site-profile-tooltip__row site-profile-tooltip__row--file">
            <span>File</span>
            <strong>
              {props.panel.originalName || props.panel.sampleName || ""}
            </strong>
          </div>
          <div className="site-profile-tooltip__row">
            <span>Row</span>
            <strong>{tooltip ? tooltip.rowIndex : ""}</strong>
          </div>
          <div className="site-profile-tooltip__row">
            <span>Position</span>
            <strong>{tooltip ? tooltip.xValue.toFixed(1) : ""}</strong>
          </div>
          <div className="site-profile-tooltip__row">
            <span>Signal</span>
            <strong>{tooltip ? tooltip.value.toFixed(4) : ""}</strong>
          </div>
        </div>
      </div>
    </section>
  );
}
