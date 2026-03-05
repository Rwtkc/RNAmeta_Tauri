import React, { useEffect, useMemo, useRef, useState } from "react";
import * as d3 from "d3";
import { getOrfTypeColor } from "@/modules/OrfPause/orfTypeColor";

interface OrfTrackRow {
  transcriptId: string;
  start: number;
  end: number;
  strand: string;
  orfType: string;
  orfScore: number;
  pvalue: number;
}

interface PauseTrackRow {
  transcriptId: string;
  coordinate: number;
  ratio: number;
  coverage: number;
  windowMean: number;
}

interface Props {
  selectedTranscriptId: string;
  orfRows: OrfTrackRow[];
  pauseRows: PauseTrackRow[];
}

const getTrackOrfKey = (row: Pick<OrfTrackRow, "start" | "end" | "strand" | "orfType" | "orfScore" | "pvalue">) =>
  `${row.start}:${row.end}:${row.strand}:${row.orfType}:${row.orfScore}:${row.pvalue}`;

export const D3TranscriptTrackChart: React.FC<Props> = ({
  selectedTranscriptId,
  orfRows,
  pauseRows,
}) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const brushSyncRef = useRef(false);

  const width = 980;
  const laneHeight = 14;
  const laneGap = 6;
  const pausePanelHeight = 126;
  const navPanelHeight = 56;
  const ORF_PANEL_MIN_HEIGHT = 220;
  const ORF_PANEL_DEFAULT_HEIGHT = 310;
  const ORF_PANEL_MAX_HEIGHT = 4000;

  const laneRows = useMemo(() => {
    const sorted = [...orfRows].sort((a, b) => a.start - b.start || a.end - b.end);
    const laneEnds: number[] = [];
    return sorted.map((row) => {
      let lane = laneEnds.findIndex((v) => row.start > v);
      if (lane < 0) {
        lane = laneEnds.length;
        laneEnds.push(row.end);
      } else {
        laneEnds[lane] = Math.max(laneEnds[lane], row.end);
      }
      return { ...row, lane };
    });
  }, [orfRows]);

  const laneCount = Math.max(1, ...laneRows.map((r) => r.lane + 1));
  const naturalOrfPanelHeight = laneCount * (laneHeight + laneGap) + 26;
  const orfPanelMaxHeight = Math.max(
    ORF_PANEL_MIN_HEIGHT,
    Math.min(ORF_PANEL_MAX_HEIGHT, naturalOrfPanelHeight + 40)
  );
  const defaultOrfPanelHeight = Math.max(
    ORF_PANEL_MIN_HEIGHT,
    Math.min(ORF_PANEL_DEFAULT_HEIGHT, orfPanelMaxHeight)
  );
  const [orfPanelHeight, setOrfPanelHeight] = useState(defaultOrfPanelHeight);

  const domainEnd = useMemo(
    () =>
      Math.max(
        1,
        d3.max(orfRows, (d) => d.end) ?? 0,
        d3.max(pauseRows, (d) => d.coordinate) ?? 0
      ),
    [orfRows, pauseRows]
  );

  const [viewRange, setViewRange] = useState<[number, number]>([0, 1]);

  useEffect(() => {
    setViewRange([0, Math.max(1, domainEnd)]);
  }, [selectedTranscriptId, domainEnd]);

  useEffect(() => {
    setOrfPanelHeight(defaultOrfPanelHeight);
  }, [defaultOrfPanelHeight, selectedTranscriptId]);

  useEffect(() => {
    setOrfPanelHeight((prev) => Math.max(ORF_PANEL_MIN_HEIGHT, Math.min(orfPanelMaxHeight, prev)));
  }, [orfPanelMaxHeight]);

  const viewStart = Math.max(0, Math.min(viewRange[0], Math.max(0, domainEnd - 1)));
  const viewEnd = Math.max(viewStart + 1, Math.min(viewRange[1], domainEnd));

  const navAxisBlockHeight = 52;
  const contentHeight =
    navPanelHeight +
    navAxisBlockHeight +
    orfPanelHeight +
    14 +
    pausePanelHeight;
  const height = 84 + contentHeight + 56;

  const resetZoom = () => setViewRange([0, domainEnd]);

  useEffect(() => {
    if (!svgRef.current || !selectedTranscriptId) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 70, right: 34, bottom: 56, left: 72 };
    const iWidth = width - margin.left - margin.right;

    const yNav = 0;
    const yNavAxis = yNav + navPanelHeight;
    const yOrfBase = yNavAxis + navAxisBlockHeight;
    const yOrf = yOrfBase - 20;  
    const yPause = yOrfBase + orfPanelHeight + 14;

    const x = d3.scaleLinear().domain([viewStart, viewEnd]).range([0, iWidth]);
    const xFull = d3.scaleLinear().domain([0, domainEnd]).range([0, iWidth]);

    const ratioCap = (() => {
      if (!pauseRows.length) return 10;
      const ratios = [...pauseRows.map((d) => d.ratio)].sort((a, b) => a - b);
      const p95 = ratios[Math.floor(ratios.length * 0.95)] ?? ratios[ratios.length - 1];
      return Math.max(10, p95);
    })();

    const colors = {
      text: "#0f172a",
      subtext: "#64748b",
      panelBg: "#ffffff",
      panelStroke: "#dbe4ef",
      grid: "rgba(15,23,42,0.08)",
      pauseFill: "#10b981",
      pauseStroke: "#059669",
      pausePoint: "#047857",
      navBar: "#94a3b8",
    };

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 20)
      .attr("text-anchor", "middle")
      .attr("fill", colors.text)
      .style("font-family", "Georgia, serif")
      .style("font-size", "22px")
      .style("font-weight", "700")
      .text("Transcript Track");

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 42)
      .attr("text-anchor", "middle")
      .attr("fill", colors.subtext)
      .style("font-family", "Inter, sans-serif")
      .style("font-size", "11px")
      .text(`transcript_id: ${selectedTranscriptId}`);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const panelDefs = [
      { y: yNav, h: navPanelHeight },
      { y: yOrf, h: orfPanelHeight },
      { y: yPause, h: pausePanelHeight },
    ];
    panelDefs.forEach((p) => {
      g.append("rect")
        .attr("x", 0)
        .attr("y", p.y)
        .attr("width", iWidth)
        .attr("height", p.h)
        .attr("fill", colors.panelBg)
        .attr("stroke", colors.panelStroke)
        .attr("rx", 6);
    });

    const orfResizeY = yOrf + orfPanelHeight;
    const resizeHandleBand = g
      .append("rect")
      .attr("x", 0)
      .attr("y", orfResizeY - 6)
      .attr("width", iWidth)
      .attr("height", 12)
      .attr("fill", "transparent")
      .style("cursor", "ns-resize");

    const resizeGuide = g.append("line")
      .attr("x1", 0)
      .attr("x2", iWidth)
      .attr("y1", orfResizeY)
      .attr("y2", orfResizeY)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1.1)
      .attr("stroke-dasharray", "5 4")
      .style("pointer-events", "none");

    let previewOrfPanelHeight = orfPanelHeight;

    resizeHandleBand.call(
      d3
        .drag<SVGRectElement, unknown>()
        .on("start", (event) => {
          event.sourceEvent?.stopPropagation?.();
        })
        .on("drag", (event) => {
          const sourceEvent = event.sourceEvent as MouseEvent | TouchEvent | undefined;
          if (!sourceEvent) return;
          const [, pointerY] = d3.pointer(sourceEvent, g.node() as SVGGElement);
          const raw = pointerY - yOrf;
          if (!Number.isFinite(raw)) return;
          const clamped = Math.max(ORF_PANEL_MIN_HEIGHT, Math.min(orfPanelMaxHeight, raw));
          previewOrfPanelHeight = clamped;
          resizeHandleBand.attr("y", yOrf + previewOrfPanelHeight - 6);
          resizeGuide
            .attr("y1", yOrf + previewOrfPanelHeight)
            .attr("y2", yOrf + previewOrfPanelHeight);
        })
        .on("end", () => {
          const committed = Math.round(previewOrfPanelHeight);
          setOrfPanelHeight((prev) => (prev === committed ? prev : committed));
        })
    );

    g.append("text")
      .attr("x", 0)
      .attr("y", yNav - 6)
      .attr("fill", colors.subtext)
      .style("font-size", "10px")
      .text(
        `Zoom navigator (drag to select window) | current region: ${Math.round(viewStart)}-${Math.round(viewEnd)}`
      );

    g.append("text")
      .attr("x", 0)
      .attr("y", yPause - 6)
      .attr("fill", colors.subtext)
      .style("font-size", "10px")
      .text("Pause sites (ratio > 10)");

    const tooltip = d3
      .select("body")
      .append("div")
      .style("position", "absolute")
      .style("display", "none")
      .style("padding", "8px 12px")
      .style("background", "#ffffff")
      .style("border", "1px solid #94a3b8")
      .style("border-radius", "10px")
      .style("box-shadow", "0 8px 20px rgba(0,0,0,0.12)")
      .style("pointer-events", "none")
      .style("z-index", 100);

    const clipId = `orf-clip-${selectedTranscriptId.replace(/[^\w-]/g, "_")}`;
    g.append("defs")
      .append("clipPath")
      .attr("id", clipId)
      .append("rect")
      .attr("x", 0)
      .attr("y", yOrf)
      .attr("width", iWidth)
      .attr("height", orfPanelHeight);

    const visibleOrfRows = laneRows.filter((d) => d.end >= viewStart && d.start <= viewEnd);

    const orfG = g.append("g").attr("clip-path", `url(#${clipId})`);

    orfG
      .selectAll("line.lane-guide")
      .data(d3.range(laneCount))
      .enter()
      .append("line")
      .attr("x1", 0)
      .attr("x2", iWidth)
      .attr("y1", (lane) => yOrf + 8 + lane * (laneHeight + laneGap) + laneHeight / 2)
      .attr("y2", (lane) => yOrf + 8 + lane * (laneHeight + laneGap) + laneHeight / 2)
      .attr("stroke", colors.grid);

    const barHeight = Math.max(5, laneHeight - 4);
    const markerHeadSize = 6;
    const markerStemLength = 7;

    type IntervalGeom = {
      x0: number;
      x1: number;
      yMid: number;
      yBar: number;
      barW: number;
      barX: number;
      hasMarker: boolean;
      stemX1: number | null;
      stemX2: number | null;
      stemY: number | null;
      markerPath: string | null;
    };

    const getIntervalGeometry = (d: (typeof visibleOrfRows)[number]): IntervalGeom => {
      const rawX0 = x(Math.max(viewStart, d.start));
      const rawX1 = x(Math.min(viewEnd, d.end));
      const x0 = Math.min(rawX0, rawX1);
      const x1 = Math.max(rawX0, rawX1);
      const w = Math.max(1, x1 - x0);
      const yLaneTop = yOrf + 8 + d.lane * (laneHeight + laneGap);
      const yMid = yLaneTop + laneHeight / 2;
      const yBar = yMid - barHeight / 2;

      const markerFootprint = markerStemLength + markerHeadSize + 1;
      const hasMarker = w > markerFootprint + 8;
      if (!hasMarker) {
        return {
          x0,
          x1,
          yMid,
          yBar,
          barW: w,
          barX: x0,
          hasMarker: false,
          stemX1: null,
          stemX2: null,
          stemY: null,
          markerPath: null,
        };
      }

      if (d.strand === "-") {
        const barX = x0 + markerFootprint;
        const barW = Math.max(1, w - markerFootprint);
        const stemX1 = barX;
        const stemX2 = barX - markerStemLength;
        const markerPath = `M${stemX2},${yMid - markerHeadSize / 2} L${stemX2 - markerHeadSize},${yMid} L${stemX2},${yMid + markerHeadSize / 2}`;
        return { x0, x1, yMid, yBar, barW, barX, hasMarker: true, stemX1, stemX2, stemY: yMid, markerPath };
      }

      const barX = x0;
      const barW = Math.max(1, w - markerFootprint);
      const stemX1 = barX + barW;
      const stemX2 = stemX1 + markerStemLength;
      const markerPath = `M${stemX2},${yMid - markerHeadSize / 2} L${stemX2 + markerHeadSize},${yMid} L${stemX2},${yMid + markerHeadSize / 2}`;
      return { x0, x1, yMid, yBar, barW, barX, hasMarker: true, stemX1, stemX2, stemY: yMid, markerPath };
    };

    const HOVER_DIM_OPACITY = 0.4;
    const HOVER_RESET_DELAY_MS = 100;
    let hoverResetTimer: number | null = null;
    let tooltipRafId: number | null = null;
    let pendingTooltipX = 0;
    let pendingTooltipY = 0;

    const clearHoverResetTimer = () => {
      if (hoverResetTimer !== null) {
        window.clearTimeout(hoverResetTimer);
        hoverResetTimer = null;
      }
    };

    const scheduleTooltipUpdate = () => {
      if (tooltipRafId !== null) return;
      tooltipRafId = window.requestAnimationFrame(() => {
        tooltip
          .style("left", `${pendingTooltipX + 15}px`)
          .style("top", `${pendingTooltipY - 60}px`);
        tooltipRafId = null;
      });
    };

    const resetHoverVisual = () => {
      orfRowsG
        .style("opacity", 0.95)
        .selectAll<SVGRectElement, typeof visibleOrfRows[number]>("rect.orf-interval")
        .attr("stroke", "rgba(15,23,42,0.2)")
        .attr("stroke-width", 0.7);
    };

    const orfRowsG = orfG
      .selectAll("g.orf-row")
      .data(visibleOrfRows)
      .enter()
      .append("g")
      .attr("class", "orf-row")
      .style("opacity", 0.95)
      .style("transition", "opacity 120ms ease")
      .style("cursor", "pointer")
      .on("mouseenter", (_event, d) => {
        clearHoverResetTimer();
        const hoveredKey = getTrackOrfKey(d);
        orfRowsG
          .style("opacity", (row) => (getTrackOrfKey(row) === hoveredKey ? 0.98 : HOVER_DIM_OPACITY))
          .selectAll<SVGRectElement, typeof d>("rect.orf-interval")
          .attr("stroke", (row) => (getTrackOrfKey(row) === hoveredKey ? "#0f172a" : "rgba(15,23,42,0.15)"))
          .attr("stroke-width", (row) => (getTrackOrfKey(row) === hoveredKey ? 1.6 : 0.6));

        tooltip
          .style("display", "block")
          .html(
            `<div style="font-family: Inter, sans-serif; font-size: 11px; line-height: 1.45;">
               <div><b>${d.orfType || "unknown"}</b> | strand: ${d.strand || "+"}</div>
               <div>coordinate: ${d.start} - ${d.end}</div>
               <div>ORFscore: ${d.orfScore.toFixed(4)}</div>
               <div>pvalue: ${d.pvalue}</div>
             </div>`
          );
      })
      .on("mousemove", (event) => {
        pendingTooltipX = event.pageX;
        pendingTooltipY = event.pageY;
        scheduleTooltipUpdate();
      })
      .on("mouseleave", () => {
        tooltip.style("display", "none");
        clearHoverResetTimer();
        hoverResetTimer = window.setTimeout(() => {
          resetHoverVisual();
          hoverResetTimer = null;
        }, HOVER_RESET_DELAY_MS);
      });

    orfRowsG
      .append("rect")
      .attr("class", "orf-interval")
      .attr("x", (d) => getIntervalGeometry(d).barX)
      .attr("y", (d) => getIntervalGeometry(d).yBar)
      .attr("width", (d) => getIntervalGeometry(d).barW)
      .attr("height", barHeight)
      .attr("rx", 2)
      .attr("fill", (d) => getOrfTypeColor(d.orfType))
      .attr("stroke", "rgba(15,23,42,0.2)")
      .attr("stroke-width", 0.7)
      .style("transition", "stroke 120ms ease, stroke-width 120ms ease");

    orfRowsG
      .append("path")
      .attr("class", "orf-dir-marker")
      .attr("d", (d) => getIntervalGeometry(d).markerPath ?? "")
      .attr("display", (d) => (getIntervalGeometry(d).hasMarker ? null : "none"))
      .attr("fill", "none")
      .attr("stroke", (d) => d3.color(getOrfTypeColor(d.orfType))?.darker(0.8).formatHex() ?? "#334155")
      .attr("stroke-width", 1.3)
      .attr("stroke-linecap", "round")
      .attr("stroke-linejoin", "round");

    orfRowsG
      .append("line")
      .attr("class", "orf-dir-stem")
      .attr("x1", (d) => getIntervalGeometry(d).stemX1 ?? 0)
      .attr("x2", (d) => getIntervalGeometry(d).stemX2 ?? 0)
      .attr("y1", (d) => getIntervalGeometry(d).stemY ?? 0)
      .attr("y2", (d) => getIntervalGeometry(d).stemY ?? 0)
      .attr("display", (d) => (getIntervalGeometry(d).hasMarker ? null : "none"))
      .attr("stroke", (d) => d3.color(getOrfTypeColor(d.orfType))?.darker(0.8).formatHex() ?? "#334155")
      .attr("stroke-width", 1.3)
      .attr("stroke-linecap", "round");

    const yPauseScale = d3
      .scaleLinear()
      .domain([0, ratioCap])
      .range([yPause + pausePanelHeight - 20, yPause + 10]);
    const pauseBaseY = yPause + pausePanelHeight - 20;

    g.append("g")
      .attr("transform", `translate(0,${yPause + pausePanelHeight - 20})`)
      .call(d3.axisBottom(x).ticks(8).tickSizeOuter(0))
      .attr("color", colors.subtext)
      .style("font-size", "10px");

    g.append("line")
      .attr("x1", 0)
      .attr("x2", iWidth)
      .attr("y1", pauseBaseY)
      .attr("y2", pauseBaseY)
      .attr("stroke", "#94a3b8")
      .attr("stroke-width", 1);

    const visiblePauseRows = pauseRows.filter(
      (d) => d.coordinate >= viewStart && d.coordinate <= viewEnd
    );

    const sortedPauseRows = [...visiblePauseRows].sort((a, b) => a.coordinate - b.coordinate);
    const pauseG = g.append("g").attr("class", "pause-area");

    if (sortedPauseRows.length > 0) {
      type PauseAreaPoint = {
        coordinate: number;
        ratio: number;
      };
      const areaPoints: PauseAreaPoint[] = [
        { coordinate: viewStart, ratio: 0 },
        ...sortedPauseRows.map((row) => ({
          coordinate: row.coordinate,
          ratio: Math.max(0, Math.min(row.ratio, ratioCap)),
        })),
        { coordinate: viewEnd, ratio: 0 },
      ];

      const pauseArea = d3
        .area<PauseAreaPoint>()
        .x((d) => x(d.coordinate))
        .y0(pauseBaseY)
        .y1((d) => yPauseScale(d.ratio))
        .curve(d3.curveMonotoneX);

      const pauseLine = d3
        .line<PauseAreaPoint>()
        .x((d) => x(d.coordinate))
        .y((d) => yPauseScale(d.ratio))
        .curve(d3.curveMonotoneX);

      pauseG
        .append("path")
        .datum(areaPoints)
        .attr("d", pauseArea)
        .attr("fill", colors.pauseFill)
        .attr("fill-opacity", 0.24);

      pauseG
        .append("path")
        .datum(areaPoints)
        .attr("d", pauseLine)
        .attr("fill", "none")
        .attr("stroke", colors.pauseStroke)
        .attr("stroke-width", 1.8)
        .attr("opacity", 0.9);

      pauseG
        .selectAll("line.pause-stem")
        .data(sortedPauseRows)
        .enter()
        .append("line")
        .attr("class", "pause-stem")
        .attr("x1", (d) => x(d.coordinate))
        .attr("x2", (d) => x(d.coordinate))
        .attr("y1", pauseBaseY)
        .attr("y2", (d) => yPauseScale(Math.max(0, Math.min(d.ratio, ratioCap))))
        .attr("stroke", colors.pauseStroke)
        .attr("stroke-width", 1.1)
        .attr("opacity", 0.5);

      pauseG
        .selectAll("circle.pause-site")
        .data(sortedPauseRows)
        .enter()
        .append("circle")
        .attr("class", "pause-site")
        .attr("cx", (d) => x(d.coordinate))
        .attr("cy", (d) => yPauseScale(Math.max(0, Math.min(d.ratio, ratioCap))))
        .attr("r", (d) => {
          const ratio = Math.max(0, Math.min(d.ratio, ratioCap));
          return 2 + (ratio / ratioCap) * 2.8;
        })
        .attr("fill", colors.pausePoint)
        .attr("stroke", "#ffffff")
        .attr("stroke-width", 0.8)
        .on("mouseover", (_event, row) => {
          tooltip
            .style("display", "block")
            .html(
              `<div style="font-family: Inter, sans-serif; font-size: 11px;">
                 <div><b>coord: ${row.coordinate}</b></div>
                 <div>ratio: ${row.ratio.toFixed(4)}</div>
                 <div>coverage: ${row.coverage.toFixed(3)}</div>
                 <div>window_mean: ${row.windowMean.toFixed(3)}</div>
               </div>`
            );
        })
        .on("mousemove", (event) => {
          tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 60}px`);
        })
        .on("mouseout", () => tooltip.style("display", "none"));
    } else {
      pauseG
        .append("text")
        .attr("x", iWidth / 2)
        .attr("y", yPause + pausePanelHeight / 2)
        .attr("text-anchor", "middle")
        .attr("fill", colors.subtext)
        .style("font-size", "11px")
        .style("font-style", "italic")
        .text("No pause sites with ratio > 10 in current window.");
    }

    const bins = 120;
    const binSpan = Math.max(1, domainEnd / bins);
    const binCounts = Array.from({ length: bins }, () => 0);
    for (const row of orfRows) {
      const from = Math.max(0, Math.floor(Math.max(0, row.start) / binSpan));
      const to = Math.min(bins - 1, Math.floor(Math.max(0, row.end) / binSpan));
      for (let b = from; b <= to; b += 1) binCounts[b] += 1;
    }
    const navMax = Math.max(1, d3.max(binCounts) ?? 1);
    const yNavScale = d3
      .scaleLinear()
      .domain([0, navMax])
      .range([yNav + navPanelHeight - 8, yNav + 8]);

    const navG = g.append("g");
    navG
      .selectAll("rect.nav-bin")
      .data(binCounts)
      .enter()
      .append("rect")
      .attr("class", "nav-bin")
      .attr("x", (_d, i) => xFull(i * binSpan))
      .attr("y", (d) => yNavScale(d))
      .attr("width", Math.max(1, iWidth / bins - 0.5))
      .attr("height", (d) => yNavScale(0) - yNavScale(d))
      .attr("fill", colors.navBar)
      .attr("opacity", 0.6);

    g.append("g")
      .attr("transform", `translate(0,${yNavAxis})`)
      .call(d3.axisBottom(xFull).ticks(8).tickSizeOuter(0))
      .attr("color", colors.subtext)
      .style("font-size", "10px");

    const brush = d3
      .brushX()
      .extent([
        [0, yNav + 1],
        [iWidth, yNav + navPanelHeight - 1],
      ])
      .on("end", (event) => {
        if (!event.selection || brushSyncRef.current) return;
        const [sx0, sx1] = event.selection as [number, number];
        let lo = xFull.invert(Math.min(sx0, sx1));
        let hi = xFull.invert(Math.max(sx0, sx1));
        const minWindow = Math.max(20, domainEnd * 0.02);
        if (hi - lo < minWindow) {
          hi = Math.min(domainEnd, lo + minWindow);
          lo = Math.max(0, hi - minWindow);
        }
        setViewRange((prev) => {
          if (Math.abs(prev[0] - lo) < 0.5 && Math.abs(prev[1] - hi) < 0.5) return prev;
          return [lo, hi];
        });
      });

    const brushG = navG.append("g").attr("class", "zoom-brush").call(brush);
    brushSyncRef.current = true;
    brushG.call(brush.move, [xFull(viewStart), xFull(viewEnd)]);
    brushSyncRef.current = false;

    navG.selectAll(".selection")
      .attr("fill", "#0ea5e9")
      .attr("fill-opacity", 0.18)
      .attr("stroke", "#0284c7")
      .attr("stroke-width", 1.2);

    navG.selectAll(".handle")
      .attr("fill", "#0284c7")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1);

    return () => {
      clearHoverResetTimer();
      if (tooltipRafId !== null) {
        window.cancelAnimationFrame(tooltipRafId);
        tooltipRafId = null;
      }
      tooltip.remove();
    };
  }, [
    selectedTranscriptId,
    orfRows,
    pauseRows,
    laneRows,
    domainEnd,
    orfPanelHeight,
    viewStart,
    viewEnd,
  ]);

  if (!selectedTranscriptId) {
    return <div className="p-4 text-xs text-slate-400 italic">Select transcript to render track.</div>;
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-end gap-2 text-[11px] text-slate-500">
        <button
          type="button"
          onClick={() => setOrfPanelHeight(defaultOrfPanelHeight)}
          className="px-2.5 py-1 rounded border border-app-border text-slate-600 hover:bg-slate-50"
        >
          Reset Height
        </button>
        <button
          type="button"
          onClick={resetZoom}
          className="px-2.5 py-1 rounded border border-app-border text-slate-600 hover:bg-slate-50"
        >
          Reset Zoom
        </button>
      </div>
      <svg ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" />
    </div>
  );
};
