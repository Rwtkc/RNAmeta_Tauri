import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

export interface CoveragePoint {
  transcript_coordinate: number;
  coverage: number;
}

export interface CoverageProfile {
  transcript_id: string;
  tx_len: number;
  utr5_len: number;
  cds_len: number;
  utr3_len: number;
  start_pos: number;
  stop_pos: number;
  points: CoveragePoint[];
}

interface Props {
  id?: string;
  profile: CoverageProfile;
  chartType: "bar" | "line";
}

export const D3MetaViewChart: React.FC<Props> = ({ id, profile, chartType }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 980;
  const height = 460;

  useEffect(() => {
    if (!svgRef.current || !profile?.points?.length) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 70, right: 40, bottom: 110, left: 90 };
    const iWidth = width - margin.left - margin.right;
    const iHeight = height - margin.top - margin.bottom;
    const sorted = [...profile.points].sort(
      (a, b) => a.transcript_coordinate - b.transcript_coordinate
    );

    const maxY = d3.max(sorted, (d) => d.coverage) ?? 1;
    const x = d3.scaleLinear().domain([1, profile.tx_len]).range([0, iWidth]);
    const y = d3.scaleLinear().domain([0, maxY * 1.1]).nice().range([iHeight, 0]);
    const barWidth = Math.max(1, iWidth / Math.max(profile.tx_len, 900));
    const animationMs = 1400;

    const colors = {
      primary: "#059669",
      accent: "#10b981",
      lineDark: "#0f766e",
      text: "#1e293b",
      subtext: "#64748b",
      grid: "rgba(0,0,0,0.05)",
      utrFill: "#e2e8f0",
      utrStroke: "#94a3b8",
      cdsFill: "#d1fae5",
      cdsStroke: "#059669",
      tooltipBg: "#ffffff",
    };

    const g = svg
      .append("g")
      .attr("transform", `translate(${margin.left},${margin.top})`);

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 34)
      .attr("text-anchor", "middle")
      .attr("fill", colors.text)
      .style("font-family", "Georgia, serif")
      .style("font-size", "22px")
      .style("font-weight", "bold")
      .text("Distribution on mRNA");

    svg
      .append("text")
      .attr("x", width / 2)
      .attr("y", 56)
      .attr("text-anchor", "middle")
      .attr("fill", colors.subtext)
      .style("font-family", "Inter, sans-serif")
      .style("font-size", "11px")
      .text(`transcript_id: ${profile.transcript_id} | points: ${profile.points.length}`);

    g.append("g")
      .attr("color", colors.grid)
      .call(
        d3
          .axisLeft(y)
          .ticks(6)
          .tickSize(-iWidth)
          .tickFormat(() => "")
          .tickSizeOuter(0)
      );

    g.append("g")
      .attr("transform", `translate(0,${iHeight})`)
      .call(
        d3
          .axisBottom(x)
          .ticks(10)
          .tickSizeOuter(0)
          .tickFormat((d) => d.toString().replace("\u2212", "-"))
      )
      .attr("color", colors.subtext)
      .style("font-size", "10px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(6).tickSizeOuter(0))
      .attr("color", colors.subtext)
      .style("font-size", "10px");

    if (chartType === "bar") {
      const bars = g
        .selectAll("rect.coverage-bar")
        .data(sorted)
        .enter()
        .append("rect")
        .attr("class", "coverage-bar")
        .attr("x", (d) => x(d.transcript_coordinate) - barWidth / 2)
        .attr("y", y(0))
        .attr("width", barWidth)
        .attr("height", 0)
        .attr("fill", colors.accent)
        .attr("opacity", 0.58);

      bars
        .transition()
        .duration(animationMs)
        .delay((_, i) => Math.floor((i / sorted.length) * 500))
        .ease(d3.easeCubicOut)
        .attr("y", (d) => y(d.coverage))
        .attr("height", (d) => y(0) - y(d.coverage));
    } else {
      const line = d3
        .line<CoveragePoint>()
        .x((d) => x(d.transcript_coordinate))
        .y((d) => y(d.coverage))
        .curve(d3.curveLinear);

      const linePath = g
        .append("path")
        .datum(sorted)
        .attr("fill", "none")
        .attr("stroke", colors.lineDark)
        .attr("stroke-width", 2.2)
        .attr("d", line);

      const lineLen = (linePath.node() as SVGPathElement).getTotalLength();
      linePath
        .attr("stroke-dasharray", lineLen)
        .attr("stroke-dashoffset", lineLen)
        .transition()
        .duration(animationMs)
        .ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);
    }

    g.append("line")
      .attr("x1", x(profile.start_pos - 0.5))
      .attr("x2", x(profile.start_pos - 0.5))
      .attr("y1", 0)
      .attr("y2", iHeight)
      .attr("stroke", colors.cdsStroke)
      .attr("stroke-width", 1.3)
      .attr("stroke-dasharray", "3,4");

    g.append("line")
      .attr("x1", x(profile.stop_pos + 0.5))
      .attr("x2", x(profile.stop_pos + 0.5))
      .attr("y1", 0)
      .attr("y2", iHeight)
      .attr("stroke", colors.cdsStroke)
      .attr("stroke-width", 1.3)
      .attr("stroke-dasharray", "3,4");

    const stripY = iHeight + 18;
    const stripH = 10;
    const drawStrip = (x1: number, x2: number, fill: string, stroke: string) => {
      g.append("rect")
        .attr("x", x(Math.max(1, x1)))
        .attr("y", stripY)
        .attr("width", Math.max(1, x(Math.min(profile.tx_len, x2)) - x(Math.max(1, x1))))
        .attr("height", stripH)
        .attr("fill", fill)
        .attr("stroke", stroke)
        .attr("stroke-width", 1);
    };

    drawStrip(1, profile.start_pos - 0.5, colors.utrFill, colors.utrStroke);
    drawStrip(
      profile.start_pos - 0.5,
      profile.stop_pos + 0.5,
      colors.cdsFill,
      colors.cdsStroke
    );
    drawStrip(profile.stop_pos + 0.5, profile.tx_len, colors.utrFill, colors.utrStroke);

    const labelY = stripY + stripH + 18;
    g.append("text")
      .attr("x", x((1 + profile.start_pos - 1) / 2))
      .attr("y", labelY)
      .attr("text-anchor", "middle")
      .attr("fill", colors.utrStroke)
      .style("font-size", "11px")
      .style("font-weight", "700")
      .text("5'UTR");
    g.append("text")
      .attr("x", x((profile.start_pos + profile.stop_pos) / 2))
      .attr("y", labelY)
      .attr("text-anchor", "middle")
      .attr("fill", colors.cdsStroke)
      .style("font-size", "11px")
      .style("font-weight", "700")
      .text("CDS");
    g.append("text")
      .attr("x", x((profile.stop_pos + profile.tx_len) / 2))
      .attr("y", labelY)
      .attr("text-anchor", "middle")
      .attr("fill", colors.utrStroke)
      .style("font-size", "11px")
      .style("font-weight", "700")
      .text("3'UTR");

    g.append("text")
      .attr("x", iWidth / 2)
      .attr("y", iHeight + 72)
      .attr("text-anchor", "middle")
      .attr("fill", colors.subtext)
      .style("font-size", "11px")
      .style("font-style", "italic")
      .text("transcript_coordinate");

    g.append("text")
      .attr("transform", "rotate(-90)")
      .attr("x", -iHeight / 2)
      .attr("y", -58)
      .attr("text-anchor", "middle")
      .attr("fill", colors.subtext)
      .style("font-size", "11px")
      .style("font-style", "italic")
      .text("RPF coverage");

    const bisect = d3.bisector<CoveragePoint, number>((d) => d.transcript_coordinate).left;
    const guide = g
      .append("line")
      .attr("stroke", colors.primary)
      .attr("stroke-width", 1)
      .attr("stroke-dasharray", "3,3")
      .style("opacity", 0);
    const focusDot = g
      .append("circle")
      .attr("r", 4)
      .attr("fill", colors.primary)
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 1.5)
      .style("opacity", 0);

    const tooltip = svg.append("g").style("opacity", 0).style("pointer-events", "none");
    tooltip
      .append("rect")
      .attr("width", 142)
      .attr("height", 44)
      .attr("fill", colors.tooltipBg)
      .attr("stroke", colors.primary)
      .attr("rx", 8);
    const tipLine1 = tooltip
      .append("text")
      .attr("x", 71)
      .attr("y", 16)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", colors.text)
      .style("font-family", "Inter, sans-serif")
      .style("font-size", "10px")
      .style("font-weight", "700");

    const tipLine2 = tooltip
      .append("text")
      .attr("x", 71)
      .attr("y", 31)
      .attr("text-anchor", "middle")
      .attr("dominant-baseline", "middle")
      .attr("fill", colors.text)
      .style("font-family", "Inter, sans-serif")
      .style("font-size", "10px")
      .style("font-weight", "700");

    const updateFocus = (event: MouseEvent) => {
      const [mx] = d3.pointer(event, g.node());
      const xValue = x.invert(mx);
      const i = bisect(sorted, xValue, 1);
      const left = sorted[Math.max(0, i - 1)];
      const right = sorted[Math.min(sorted.length - 1, i)];
      const d =
        Math.abs(xValue - left.transcript_coordinate) <=
        Math.abs(xValue - right.transcript_coordinate)
          ? left
          : right;

      const px = x(d.transcript_coordinate);
      const py = y(d.coverage);
      const absX = margin.left + px;
      const absY = margin.top + py;

      guide
        .attr("x1", px)
        .attr("x2", px)
        .attr("y1", 0)
        .attr("y2", iHeight)
        .style("opacity", 0.8);

      focusDot.attr("cx", px).attr("cy", py).style("opacity", 1);

      let tooltipX = absX + 12;
      if (tooltipX + 142 > width - 8) tooltipX = absX - 154;
      let tooltipY = absY - 54;
      if (tooltipY < margin.top + 2) tooltipY = margin.top + 2;

      tooltip.attr("transform", `translate(${tooltipX},${tooltipY})`).style("opacity", 1);
      tipLine1.text(`x: ${d.transcript_coordinate}`);
      tipLine2.text(`coverage: ${d.coverage.toFixed(2)}`);
    };

    g.append("rect")
      .attr("x", 0)
      .attr("y", 0)
      .attr("width", iWidth)
      .attr("height", iHeight)
      .attr("fill", "transparent")
      .style("cursor", "crosshair")
      .on("mousemove", (event) => updateFocus(event as MouseEvent))
      .on("mouseenter", (event) => updateFocus(event as MouseEvent))
      .on("mouseleave", () => {
        guide.style("opacity", 0);
        focusDot.style("opacity", 0);
        tooltip.style("opacity", 0);
      });
  }, [profile, chartType]);

  return (
    <svg
      id={id}
      ref={svgRef}
      viewBox={`0 0 ${width} ${height}`}
      className="w-full h-auto"
    />
  );
};

