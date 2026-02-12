// src/modules/QC/D3MetaProfileChart.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  id?: string;
  data: any[];
  type: 'start' | 'stop';
}

export const D3MetaProfileChart: React.FC<Props> = ({ id, data, type }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 900;
  const height = 400;

  useEffect(() => {
    const panelData = data.filter(d => String(d.reg).includes(type));
    if (!svgRef.current || !panelData || panelData.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 80, right: 50, bottom: 80, left: 80 };
    const iWidth = width - margin.left - margin.right;
    const iHeight = height - margin.top - margin.bottom;
    
    const colors = { 
      primary: "#059669", 
      text: "#1e293b", 
      subtext: "#64748b", 
      grid: "rgba(0,0,0,0.05)", 
      tooltipBg: "#ffffff" 
    };

    const title = type === 'start' ? "Start Codon Proximity Profile" : "Stop Codon Proximity Profile";
    svg.append("text").attr("x", width/2).attr("y", 35).attr("text-anchor", "middle").attr("fill", colors.text).style("font-family", "Georgia, serif").style("font-weight", "bold").style("font-style", "italic").style("font-size", "18px").text(title);
    svg.append("text").attr("x", width/2).attr("y", 55).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "11px").text("Aggregated spatial distribution of P-sites near genomic landmarks.");

    const sorted = [...panelData].sort((a, b) => a.distance - b.distance);
    const x = d3.scaleLinear().domain(d3.extent(sorted, d => d.distance) as [number, number]).range([0, iWidth]);
    const y = d3.scaleLinear().domain([0, (d3.max(sorted, d => d.reads) ?? 1) * 1.1]).range([iHeight, 0]);

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

    g.append("text").attr("x", iWidth / 2).attr("y", iHeight + 45).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "11px").style("font-style", "italic").text(`Distance from ${type === 'start' ? 'Start' : 'Stop'} Codon (nt)`);
    g.append("text").attr("transform", "rotate(-90)").attr("y", -60).attr("x", -iHeight / 2).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "11px").style("font-style", "italic").text("Normalized Density");

    const line = d3.line<any>().x(d => x(d.distance)).y(d => y(d.reads)).curve(d3.curveMonotoneX);
    const path = g.append("path").datum(sorted).attr("fill", "none").attr("stroke", colors.primary).attr("stroke-width", 2.5).attr("d", line);
    const totalLen = (path.node() as SVGPathElement).getTotalLength();
    path.attr("stroke-dasharray", totalLen).attr("stroke-dashoffset", totalLen).transition().duration(1500).attr("stroke-dashoffset", 0);

    g.append("line").attr("x1", x(0)).attr("x2", x(0)).attr("y1", 0).attr("y2", iHeight).attr("stroke", "#ef4444").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,2");

    const focus = g.append("g").style("display", "none");
    focus.append("circle").attr("r", 4).attr("fill", colors.primary).attr("stroke", "#fff");
    const tooltip = svg.append("g").style("display", "none").style("pointer-events", "none");
    tooltip.append("rect").attr("width", 100).attr("height", 30).attr("fill", colors.tooltipBg).attr("stroke", colors.primary).attr("rx", 4);
    const tipText = tooltip.append("text").attr("text-anchor", "middle").attr("x", 50).attr("fill", colors.text).style("font-family", "Inter, sans-serif").style("font-size", "10px");

    const bisect = d3.bisector((d: any) => d.distance).left;
    
    const updateTooltip = (event: any) => {
      const [mx, my] = d3.pointer(event, svgRef.current);
      const x0 = x.invert(mx - margin.left);
      const i = bisect(sorted, x0, 1);
      const d = x0 - sorted[i-1].distance > sorted[i].distance - x0 ? sorted[i] : sorted[i-1];
      if (d) {
        focus.attr("transform", `translate(${x(d.distance)}, ${y(d.reads)})`);
        tooltip.attr("transform", `translate(${mx - 50}, ${my - 40})`);
        tipText.attr("y", 20).text(`Dist: ${d.distance}nt | ${d.reads.toFixed(3)}`);
      }
    };

    g.append("rect").attr("width", iWidth).attr("height", iHeight).attr("fill", "none").attr("pointer-events", "all")
      .on("mouseover", (event) => { 
        focus.style("display", null); 
        tooltip.style("display", null); 
        updateTooltip(event); 
      })
      .on("mouseout", () => { focus.style("display", "none"); tooltip.style("display", "none"); })
      .on("mousemove", (event: any) => updateTooltip(event));

  }, [data, type]);

  return <svg id={id} ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" />;
};

