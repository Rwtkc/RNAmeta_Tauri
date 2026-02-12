// src/modules/QC/D3OccupancyChart.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  id?: string;
  data: any[];
  type: 'bin' | 'start' | 'end';
}

export const D3OccupancyChart: React.FC<Props> = ({ id, data, type }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 900;
  const height = 450;

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 100, right: 50, bottom: 80, left: 80 };
    const iWidth = width - margin.left - margin.right;
    const iHeight = height - margin.top - margin.bottom;
    const xKey = type === 'bin' ? 'bin_pos' : 'codon_coordinate';

    const sorted = [...data].sort((a, b) => a[xKey] - b[xKey]);
    const smoothRadius = type === 'bin' ? 2 : 1.2;
    const means = d3.blur(sorted.map(d => d.Normalized_coverage), smoothRadius);
    const ses = d3.blur(sorted.map(d => d.se || 0), smoothRadius);

    const plotData = sorted.map((d, i) => ({
      x: d[xKey], raw: d.Normalized_coverage, mean: means[i],
      low: means[i] - (ses[i] * 1.96), high: means[i] + (ses[i] * 1.96)
    }));

    const colors = { primary: "#059669", text: "#1e293b", subtext: "#64748b", grid: "rgba(0,0,0,0.05)", tooltipBg: "#ffffff" };

    const mainTitle = type === 'bin' ? "Global CDS Occupancy (Binned)" : type === 'start' ? "5' Terminus Ribosome Occupancy" : "3' Terminus Ribosome Occupancy";
    svg.append("text").attr("x", width/2).attr("y", 40).attr("text-anchor", "middle").attr("fill", colors.text).style("font-family", "Georgia, serif").style("font-weight", "bold").style("font-style", "italic").style("font-size", "20px").text(mainTitle);
    svg.append("text").attr("x", width/2).attr("y", 65).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "12px").text("Meta-gene coverage profile with local regression smoothing and 95% CI.");

    const yMin = d3.min(plotData, d => d.low) ?? 0;
    const yMax = d3.max(plotData, d => d.high) ?? 1;
    const x = d3.scaleLinear().domain(d3.extent(plotData, d => d.x) as [number, number]).range([0, iWidth]);
    const y = d3.scaleLinear().domain([yMin * 0.9, yMax * 1.1]).range([iHeight, 0]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);
    
    const xAxis = d3.axisBottom(x)
      .ticks(10)
      .tickSizeOuter(0)
      .tickFormat(d => d.toString().replace('\u2212', '-'));

    g.append("g").attr("color", colors.grid).call(d3.axisLeft(y).ticks(5).tickSize(-iWidth).tickFormat(() => "").tickSizeOuter(0));
    g.append("g").attr("color", colors.grid).attr("transform", `translate(0, ${iHeight})`).call(d3.axisBottom(x).ticks(10).tickSize(-iHeight).tickFormat(() => "").tickSizeOuter(0));
    
    g.append("g")
      .attr("transform", `translate(0,${iHeight})`)
      .call(xAxis)
      .attr("color", colors.subtext)
      .style("font-family", "Inter, sans-serif")
      .style("font-size", "10px");

    g.append("g").call(d3.axisLeft(y).ticks(5).tickSizeOuter(0)).attr("color", colors.subtext).style("font-size", "10px");

    const xTitle = type === 'bin' ? 'Relative Transcript Position (%)' : 'Codon Index (Relative to terminus)';
    g.append("text").attr("x", iWidth / 2).attr("y", iHeight + 45).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "11px").style("font-style", "italic").text(xTitle);
    g.append("text").attr("transform", "rotate(-90)").attr("y", -60).attr("x", -iHeight / 2).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "11px").style("font-style", "italic").text("Normalized Ribosome Coverage");

    g.selectAll("circle.data-point").data(plotData).enter().append("circle").attr("class", "data-point")
      .attr("cx", d => x(d.x)).attr("cy", d => y(d.raw)).attr("r", 1.2).attr("fill", "#cbd5e1").attr("opacity", 0.4);

    const area = d3.area<any>().x(d => x(d.x)).y0(d => y(d.low)).y1(d => y(d.high)).curve(d3.curveBasis);
    g.append("path").datum(plotData).attr("fill", colors.primary).attr("opacity", 0.15).attr("d", area);

    const line = d3.line<any>().x(d => x(d.x)).y(d => y(d.mean)).curve(d3.curveBasis);
    const path = g.append("path").datum(plotData).attr("fill", "none").attr("stroke", colors.primary).attr("stroke-width", 2.5).attr("d", line);
    const totalLen = (path.node() as SVGPathElement).getTotalLength();
    path.attr("stroke-dasharray", totalLen).attr("stroke-dashoffset", totalLen).transition().duration(1500).attr("stroke-dashoffset", 0);

    const focus = g.append("g").style("display", "none");
    focus.append("line").attr("y1", 0).attr("y2", iHeight).attr("stroke", colors.primary).attr("stroke-dasharray", "3,3").attr("opacity", 0.5);
    const tooltip = svg.append("g").style("display", "none").style("pointer-events", "none");
    tooltip.append("rect").attr("width", 120).attr("height", 45).attr("fill", colors.tooltipBg).attr("stroke", colors.primary).attr("rx", 8);
    const tipText = tooltip.append("text").attr("text-anchor", "middle").attr("x", 60).attr("fill", colors.text).style("font-family", "Inter, sans-serif").style("font-size", "10px").style("font-weight", "bold");

    const bisect = d3.bisector((d: any) => d.x).left;

    const updateTooltip = (event: any) => {
      const [mx, my] = d3.pointer(event, svgRef.current);
      const x0 = x.invert(mx - margin.left);
      const i = bisect(plotData, x0, 1);
      const d = x0 - plotData[i-1].x > plotData[i]?.x - x0 ? plotData[i] : plotData[i-1];
      if (d) {
        focus.attr("transform", `translate(${x(d.x)}, 0)`);
        tooltip.attr("transform", `translate(${mx - 60}, ${my - 55})`);
        tipText.selectAll("tspan").remove();
        tipText.append("tspan").attr("x", 60).attr("dy", "1.6em").text(`X: ${d.x.toFixed(2)}`);
        tipText.append("tspan").attr("x", 60).attr("dy", "1.4em").text(`Rel.Cov: ${d.mean.toFixed(4)}`);
      }
    };

    g.append("rect").attr("width", iWidth).attr("height", iHeight).attr("fill", "none").attr("pointer-events", "all")
      .on("mouseover", (event) => { 
        focus.style("display", null); 
        tooltip.style("display", null);
        updateTooltip(event); 
      })
      .on("mouseout", () => { focus.style("display", "none"); tooltip.style("display", "none"); })
      .on("mousemove", (event) => updateTooltip(event));

  }, [data, type]);

  return <svg id={id} ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" />;
};

