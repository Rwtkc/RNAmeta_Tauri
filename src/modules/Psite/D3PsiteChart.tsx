// src/modules/Psite/D3PsiteChart.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  data: any[];
  anchor: 'start' | 'stop';
}

export const D3PsiteChart: React.FC<Props> = ({ data, anchor }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 850;
  const height = 550; 
  const margin = { top: 100, right: 60, bottom: 80, left: 100 };

  useEffect(() => {
    if (!svgRef.current || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const iWidth = width - margin.left - margin.right;
    const iHeight = height - margin.top - margin.bottom;

    svg.append("rect").attr("width", width).attr("height", height).attr("fill", "#ffffff");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleLinear().domain(d3.extent(data, d => d.distance) as [number, number]).range([0, iWidth]);
    const y = d3.scaleLinear().domain([0, d3.max(data, d => d.reads) * 1.1]).range([iHeight, 0]);

    const colors = {
      primary: "#059669",
      text: "#1e293b",
      subtext: "#64748b",
      grid: "rgba(0,0,0,0.05)",
      tooltipBg: "#ffffff"
    };

    g.append("text").attr("x", iWidth / 2).attr("y", -60).attr("text-anchor", "middle").attr("fill", colors.text)
      .style("font-family", "Georgia, serif").style("font-weight", "bold").style("font-style", "italic").style("font-size", "20px")
      .text(`P-site Stratification (${anchor === 'start' ? 'Start' : 'Stop'} Codon)`);

    g.append("text").attr("x", iWidth / 2).attr("y", -35).attr("text-anchor", "middle").attr("fill", colors.subtext)
      .style("font-family", "Inter, sans-serif").style("font-size", "12px")
      .text(`Spatial distribution of ribosome footprints stratified by fragment length.`);

    g.append("text").attr("x", iWidth / 2).attr("y", iHeight + 50).attr("text-anchor", "middle").attr("fill", colors.subtext)
      .style("font-family", "Inter, sans-serif").style("font-style", "italic").style("font-size", "11px")
      .text(`Distance from ${anchor} (nt)`);

    g.append("text").attr("transform", "rotate(-90)").attr("y", -65).attr("x", -iHeight / 2).attr("text-anchor", "middle").attr("fill", colors.subtext)
      .style("font-family", "Inter, sans-serif").style("font-style", "italic").style("font-size", "11px")
      .text("Reads Frequency");

    g.append("g")
      .attr("color", colors.grid)
      .call(d3.axisLeft(y).ticks(5).tickSize(-iWidth).tickFormat(() => "").tickSizeOuter(0));

    const rangeLimit = anchor === 'start' ? d3.range(-24, 51, 3) : d3.range(-48, 26, 3);
    g.selectAll(".period-line").data(rangeLimit).enter().append("line")
      .attr("x1", d => x(d)).attr("x2", d => x(d)).attr("y1", 0).attr("y2", iHeight)
      .attr("stroke", d => d === 0 ? "#ef4444" : colors.grid)
      .attr("stroke-width", d => d === 0 ? 1.5 : 1)
      .attr("stroke-dasharray", "none");

    const xAxis = d3.axisBottom(x)
      .ticks(15)
      .tickSizeOuter(0)
      .tickFormat(d => d.toString().replace('\u2212', '-')); 

    g.append("g")
      .attr("transform", `translate(0,${iHeight})`)
      .call(xAxis)
      .attr("color", colors.subtext)
      .style("font-family", "Inter, sans-serif") 
      .style("font-size", "10px");

    g.append("g")
      .call(d3.axisLeft(y).ticks(5).tickFormat(d3.format(",")).tickSizeOuter(0))
      .attr("color", colors.subtext)
      .style("font-family", "Inter, sans-serif")
      .style("font-size", "10px");

    const line = d3.line<any>().x(d => x(d.distance)).y(d => y(d.reads)).curve(d3.curveMonotoneX);
    const path = g.append("path").datum(data).attr("fill", "none").attr("stroke", colors.primary).attr("stroke-width", 2.5).attr("d", line);
    
    const totalLength = (path.node() as SVGPathElement).getTotalLength();
    path.attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition().duration(1500).ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);

    const focus = g.append("g").style("display", "none");
    focus.append("line").attr("class", "hover-line").attr("y1", 0).attr("y2", iHeight).attr("stroke", colors.primary).attr("stroke-dasharray", "3,3");
    focus.append("circle").attr("r", 6).attr("fill", colors.primary).attr("stroke", "#fff").attr("stroke-width", 2);

    const tooltip = d3.select("body").append("div")
      .style("position", "absolute").style("display", "none").style("padding", "10px 14px")
      .style("background", colors.tooltipBg).style("border", `1.5px solid ${colors.primary}`)
      .style("border-radius", "12px").style("pointer-events", "none").style("z-index", "100")
      .style("box-shadow", "0 10px 25px -5px rgba(0,0,0,0.1)");

    const bisect = d3.bisector((d: any) => d.distance).left;

    g.append("rect").attr("width", iWidth).attr("height", iHeight).attr("fill", "none").attr("pointer-events", "all")
      .on("mouseover", () => { focus.style("display", null); tooltip.style("display", "block"); })
      .on("mouseout", () => { focus.style("display", "none"); tooltip.style("display", "none"); })
      .on("mousemove", (event) => {
        const mouseX = d3.pointer(event)[0];
        const x0 = x.invert(mouseX);
        const i = bisect(data, x0, 1);
        const d = x0 - data[i-1]?.distance > data[i]?.distance - x0 ? data[i] : data[i-1];
        if (d) {
          focus.attr("transform", `translate(${x(d.distance)}, 0)`);
          focus.select("circle").attr("transform", `translate(0, ${y(d.reads)})`);
          tooltip.html(`
            <div style="font-family: Inter, sans-serif;">
              <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Relative Pos</div>
              <div style="font-size: 15px; font-weight: 900; color: ${colors.text}; font-style: italic;">${d.distance} nt</div>
              <div style="margin-top: 6px; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Frequency</div>
              <div style="font-size: 15px; font-weight: 900; color: ${colors.primary};">${d.reads.toLocaleString()}</div>
            </div>
          `).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 50) + "px");
        }
      });

    return () => { tooltip.remove(); };
  }, [data, anchor]);

  return <svg id="psite-distribution-svg" ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" />;
};

