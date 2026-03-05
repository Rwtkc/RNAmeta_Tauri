import React, { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { getOrfTypeColor } from "@/modules/OrfPause/orfTypeColor";

interface OrfPoint {
  transcriptId: string;
  orfType: string;
  orfScore: number;
  pvalue: number;
  total: number;
}

interface Props {
  rows: OrfPoint[];
  onSelectTranscript?: (transcriptId: string) => void;
}

interface BoxStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
}

interface TypeStats {
  typeKey: string;
  color: string;
  count: number;
  repTranscript: string;
  score: BoxStats;
  nlogP: BoxStats;
}

let typeStatsCache: { rowsRef: OrfPoint[]; stats: TypeStats[] } | null = null;

const normalizeType = (value: string): string => {
  const v = (value || "").trim();
  return v.length > 0 ? v : "unknown";
};

const getBoxStats = (values: number[]): BoxStats => {
  const sorted = values.filter((n) => Number.isFinite(n)).sort(d3.ascending);
  if (sorted.length === 0) {
    return { min: 0, q1: 0, median: 0, q3: 0, max: 0 };
  }
  const q = (p: number) => d3.quantileSorted(sorted, p) ?? sorted[0];
  return {
    min: q(0.05),
    q1: q(0.25),
    median: q(0.5),
    q3: q(0.75),
    max: q(0.95),
  };
};

const drawBoxRows = (
  g: d3.Selection<SVGGElement, unknown, null, undefined>,
  stats: TypeStats[],
  yScale: d3.ScaleBand<string>,
  xScale: d3.ScaleLinear<number, number>,
  access: (s: TypeStats) => BoxStats
) => {
  const rows = g
    .selectAll("g.box-row")
    .data(stats)
    .enter()
    .append("g")
    .attr("class", "box-row")
    .attr("transform", (d) => `translate(0,${yScale(d.typeKey) ?? 0})`);

  rows
    .append("line")
    .attr("class", "type-mark")
    .attr("data-type", (d) => d.typeKey)
    .attr("x1", (d) => xScale(access(d).min))
    .attr("x2", (d) => xScale(access(d).max))
    .attr("y1", yScale.bandwidth() / 2)
    .attr("y2", yScale.bandwidth() / 2)
    .attr("stroke", "#64748b")
    .attr("stroke-width", 1.1);

  rows
    .append("line")
    .attr("class", "type-mark")
    .attr("data-type", (d) => d.typeKey)
    .attr("x1", (d) => xScale(access(d).median))
    .attr("x2", (d) => xScale(access(d).median))
    .attr("y1", yScale.bandwidth() * 0.2)
    .attr("y2", yScale.bandwidth() * 0.8)
    .attr("stroke", "#0f172a")
    .attr("stroke-width", 1.3);

  rows
    .append("rect")
    .attr("class", "type-mark")
    .attr("data-type", (d) => d.typeKey)
    .attr("x", (d) => xScale(access(d).q1))
    .attr("y", yScale.bandwidth() * 0.24)
    .attr("width", (d) => Math.max(2, xScale(access(d).q3) - xScale(access(d).q1)))
    .attr("height", yScale.bandwidth() * 0.52)
    .attr("fill", (d) => d.color)
    .attr("fill-opacity", 0.7)
    .attr("stroke", (d) => d.color);

};

export const D3OrfEvidenceScatter: React.FC<Props> = ({ rows, onSelectTranscript }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 980;

  const typeStats = useMemo<TypeStats[]>(() => {
    if (typeStatsCache && typeStatsCache.rowsRef === rows) {
      return typeStatsCache.stats;
    }

    const grouped = d3.group(rows, (d) => normalizeType(d.orfType));
    const results: TypeStats[] = [];

    grouped.forEach((items, typeKey) => {
      if (items.length === 0) return;

      const scoreVals = items.map((d) => d.orfScore).filter((n) => Number.isFinite(n));
      const nlogVals = items
        .map((d) => -Math.log10(Math.max(d.pvalue, 1e-300)))
        .filter((n) => Number.isFinite(n));

      const rep = items.reduce((best, curr) =>
        curr.orfScore > best.orfScore ? curr : best
      );

      results.push({
        typeKey,
        color: getOrfTypeColor(typeKey),
        count: items.length,
        repTranscript: rep.transcriptId,
        score: getBoxStats(scoreVals),
        nlogP: getBoxStats(nlogVals),
      });
    });

    const stats = results.sort((a, b) => b.count - a.count);
    typeStatsCache = {
      rowsRef: rows,
      stats,
    };
    return stats;
  }, [rows]);

  useEffect(() => {
    if (!svgRef.current || typeStats.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const rowHeight = 34;
    const topPadding = 50;
    const bottomPadding = 28;
    const rowsHeight = typeStats.length * rowHeight;
    const height = topPadding + rowsHeight + bottomPadding;
    svg.attr("viewBox", `0 0 ${width} ${height}`);

    const leftPadding = 16;
    const leftTypeWidth = 148;
    const panelGap = 40;
    const panelWidth = (width - leftPadding * 2 - leftTypeWidth - panelGap * 2) / 3;
    const countWidth = panelWidth;
    const scoreWidth = panelWidth;
    const nlogWidth = panelWidth;
    const chartTop = topPadding;

    const xCountStart = leftTypeWidth - 60;
    const xScoreStart = xCountStart + countWidth + panelGap;
    const xNlogStart = xScoreStart + scoreWidth + panelGap;

    const yScale = d3
      .scaleBand<string>()
      .domain(typeStats.map((d) => d.typeKey))
      .range([0, rowsHeight])
      .paddingInner(0.25);

    const countMax = Math.max(1, d3.max(typeStats, (d) => d.count) ?? 1);
    const scoreMax = Math.max(1, d3.max(typeStats, (d) => d.score.max) ?? 1);
    const nlogMax = Math.max(1, d3.max(typeStats, (d) => d.nlogP.max) ?? 1);
    const countUpper = countMax <= 10 ? countMax + 1 : countMax * 1.22;

    const xCount = d3.scaleLinear().domain([0, countUpper]).range([0, countWidth]);
    const xScore = d3.scaleLinear().domain([0, scoreMax]).nice().range([0, scoreWidth]);
    const xNlog = d3.scaleLinear().domain([0, nlogMax]).nice().range([0, nlogWidth]);

    const chartRoot = svg.append("g").attr("transform", `translate(${leftPadding},${chartTop})`);

    chartRoot
      .append("g")
      .attr("transform", `translate(${xCountStart},0)`)
      .call(d3.axisTop(xCount).ticks(5).tickSizeOuter(0).tickFormat((v) => d3.format(",.0f")(Number(v))))
      .attr("color", "#64748b")
      .style("font-size", "10px");

    chartRoot
      .append("g")
      .attr("transform", `translate(${xScoreStart},0)`)
      .call(d3.axisTop(xScore).ticks(5).tickSizeOuter(0))
      .attr("color", "#64748b")
      .style("font-size", "10px");

    chartRoot
      .append("g")
      .attr("transform", `translate(${xNlogStart},0)`)
      .call(d3.axisTop(xNlog).ticks(5).tickSizeOuter(0))
      .attr("color", "#64748b")
      .style("font-size", "10px");

    chartRoot
      .append("g")
      .attr("transform", `translate(${xCountStart},0)`)
      .call(d3.axisTop(xCount).ticks(5).tickSize(-rowsHeight).tickFormat(() => "").tickSizeOuter(0))
      .attr("color", "rgba(15,23,42,0.08)");

    chartRoot
      .append("g")
      .attr("transform", `translate(${xScoreStart},0)`)
      .call(d3.axisTop(xScore).ticks(5).tickSize(-rowsHeight).tickFormat(() => "").tickSizeOuter(0))
      .attr("color", "rgba(15,23,42,0.08)");

    chartRoot
      .append("g")
      .attr("transform", `translate(${xNlogStart},0)`)
      .call(d3.axisTop(xNlog).ticks(5).tickSize(-rowsHeight).tickFormat(() => "").tickSizeOuter(0))
      .attr("color", "rgba(15,23,42,0.08)");

    chartRoot
      .selectAll("rect.row-bg")
      .data(typeStats)
      .enter()
      .append("rect")
      .attr("class", "row-bg")
      .attr("x", xCountStart - 4)
      .attr("y", (d) => yScale(d.typeKey) ?? 0)
      .attr("width", countWidth + panelGap + scoreWidth + panelGap + nlogWidth + 8)
      .attr("height", yScale.bandwidth())
      .attr("rx", 4)
      .attr("fill", "transparent");

    chartRoot
      .selectAll("text.type-label")
      .data(typeStats)
      .enter()
      .append("text")
      .attr("class", "type-label")
      .attr("x", xCountStart - 12)
      .attr("y", (d) => (yScale(d.typeKey) ?? 0) + yScale.bandwidth() / 2 + 4)
      .attr("text-anchor", "end")
      .style("font-size", "11px")
      .style("font-weight", "600")
      .style("fill", "#334155")
      .text((d) => d.typeKey);

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

    chartRoot
      .selectAll("rect.count-bar")
      .data(typeStats)
      .enter()
      .append("rect")
      .attr("class", "count-bar type-mark")
      .attr("data-type", (d) => d.typeKey)
      .attr("x", xCountStart)
      .attr("y", (d) => (yScale(d.typeKey) ?? 0) + yScale.bandwidth() * 0.2)
      .attr("width", (d) => xCount(d.count))
      .attr("height", yScale.bandwidth() * 0.6)
      .attr("rx", 3)
      .attr("fill", (d) => d.color)
      .attr("fill-opacity", 0.76);

    chartRoot
      .selectAll("text.count-label")
      .data(typeStats)
      .enter()
      .append("text")
      .attr("class", "count-label type-mark")
      .attr("data-type", (d) => d.typeKey)
      .attr("x", (d) => xCountStart + xCount(d.count) + 6)
      .attr("y", (d) => (yScale(d.typeKey) ?? 0) + yScale.bandwidth() / 2 + 4)
      .style("font-size", "10px")
      .style("fill", "#475569")
      .text((d) => d.count.toLocaleString());

    const scoreG = chartRoot.append("g").attr("transform", `translate(${xScoreStart},0)`);
    drawBoxRows(scoreG, typeStats, yScale, xScore, (s) => s.score);

    const nlogG = chartRoot.append("g").attr("transform", `translate(${xNlogStart},0)`);
    drawBoxRows(nlogG, typeStats, yScale, xNlog, (s) => s.nlogP);

    chartRoot
      .selectAll("rect.row-hit")
      .data(typeStats)
      .enter()
      .append("rect")
      .attr("class", "row-hit")
      .attr("x", xCountStart - 4)
      .attr("y", (d) => yScale(d.typeKey) ?? 0)
      .attr("width", countWidth + panelGap + scoreWidth + panelGap + nlogWidth + 8)
      .attr("height", yScale.bandwidth())
      .attr("fill", "transparent")
      .style("cursor", "pointer");

    let hoverType: string | null = null;

    const rowTooltipHtml = (d: TypeStats) => {
      return `<div style="font-family: Inter, sans-serif; font-size: 11px; line-height: 1.45;">
        <div><b>${d.typeKey}</b></div>
        <div>Count: ${d.count.toLocaleString()}</div>
        <div>ORFscore median: ${d.score.median.toFixed(3)}</div>
        <div>-log10(pvalue) median: ${d.nlogP.median.toFixed(3)}</div>
      </div>`;
    };

    const applyFocus = () => {
      const activeType = hoverType;
      chartRoot
        .selectAll<SVGElement, TypeStats>(".type-mark")
        .transition()
        .duration(120)
        .style("opacity", (d) => (!activeType || d.typeKey === activeType ? 1 : 0.22));

      chartRoot
        .selectAll<SVGTextElement, TypeStats>(".type-label")
        .transition()
        .duration(120)
        .style("opacity", (d) => (!activeType || d.typeKey === activeType ? 1 : 0.38))
        .style("font-weight", (d) => (!activeType || d.typeKey === activeType ? "800" : "600"));

      chartRoot
        .selectAll<SVGRectElement, TypeStats>(".row-bg")
        .attr("fill", (d) => (activeType && d.typeKey === activeType ? "rgba(15, 23, 42, 0.06)" : "transparent"));
    };

    chartRoot
      .selectAll<SVGRectElement, TypeStats>(".row-hit")
      .on("mouseenter", (event, d) => {
        hoverType = d.typeKey;
        tooltip.style("display", "block").html(rowTooltipHtml(d));
        tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 60}px`);
        applyFocus();
      })
      .on("mousemove", (event, d) => {
        tooltip.style("display", "block").html(rowTooltipHtml(d));
        tooltip.style("left", `${event.pageX + 15}px`).style("top", `${event.pageY - 60}px`);
      })
      .on("mouseleave", () => {
        hoverType = null;
        tooltip.style("display", "none");
        applyFocus();
      })
      .on("click", (event, d) => {
        event.stopPropagation();
        if (onSelectTranscript && d.repTranscript) {
          onSelectTranscript(d.repTranscript);
        }
      });

    svg.on("mouseleave", () => {
      hoverType = null;
      tooltip.style("display", "none");
      applyFocus();
    });

    svg
      .append("text")
      .attr("x", leftPadding + xCountStart + 70)
      .attr("y", 20)
      .style("font-size", "11px")
      .style("font-weight", "700")
      .style("fill", "#1e293b")
      .text("ORF Type Counts");

    svg
      .append("text")
      .attr("x", leftPadding + xScoreStart + 30)
      .attr("y", 20)
      .style("font-size", "11px")
      .style("font-weight", "700")
      .style("fill", "#1e293b")
      .text("ORFscore Distribution (5%-95%)");

    svg
      .append("text")
      .attr("x", leftPadding + xNlogStart + 15)
      .attr("y", 20)
      .style("font-size", "11px")
      .style("font-weight", "700")
      .style("fill", "#1e293b")
      .text("-log10(pvalue) Distribution (5%-95%)");

    return () => {
      tooltip.remove();
    };
  }, [typeStats, onSelectTranscript]);

  return <svg ref={svgRef} viewBox={`0 0 ${width} 420`} className="w-full h-auto" />;
};
