// src/modules/Psite/D3SaturationChart.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface SaturationPoint {
  perc: number;
  perc_gene: number;
}

interface Props {
  data: SaturationPoint[];
}

export const D3SaturationChart: React.FC<Props> = ({ data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 800;
  const height = 550;

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 100, right: 80, bottom: 100, left: 100 };
    const iWidth = width - margin.left - margin.right;
    const iHeight = height - margin.top - margin.bottom;

    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", "#ffffff");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const xExtent = d3.extent(data, d => Number(d.perc)) as [number, number];
    const yExtent = d3.extent(data, d => Number(d.perc_gene)) as [number, number];
    const x = d3.scaleLinear().domain([Math.max(0, xExtent[0] - 0.1), Math.min(1.1, xExtent[1] + 0.1)]).range([0, iWidth]);
    const y = d3.scaleLinear().domain([Math.max(0, yExtent[0] - 0.1), Math.min(1.1, yExtent[1] + 0.1)]).range([iHeight, 0]);

    const colors = {
      primary: "#059669",
      text: "#1e293b",
      subtext: "#64748b",
      grid: "rgba(0,0,0,0.05)",
      tooltipBg: "#ffffff"
    };

    g.append("text").attr("x", iWidth/2).attr("y", -60).attr("text-anchor", "middle").attr("fill", colors.text).style("font-family", "Georgia, serif").style("font-weight", "bold").style("font-style", "italic").style("font-size", "20px").text("Library Saturation Analysis");
    g.append("text").attr("x", iWidth/2).attr("y", -35).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "12px").text("Rarefaction curve correlating sequencing depth with gene discovery rates.");
    
    g.append("text").attr("x", iWidth / 2).attr("y", iHeight + 50).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-style", "italic").style("font-size", "11px").text("perc (Sampling Fraction)");
    g.append("text").attr("transform", "rotate(-90)").attr("y", -60).attr("x", -iHeight / 2).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-style", "italic").style("font-size", "11px").text("perc_gene (Discovery Rate)");

    g.append("g").attr("color", colors.grid).call(d3.axisLeft(y).ticks(6).tickSize(-iWidth).tickFormat(() => ""));
    g.append("g").attr("color", colors.grid).call(d3.axisBottom(x).ticks(10).tickSize(iHeight).tickFormat(() => ""));
    g.append("g").call(d3.axisLeft(y).ticks(6).tickFormat(d3.format(".2f"))).attr("color", colors.subtext).style("font-size", "10px");
    g.append("g").attr("transform", `translate(0,${iHeight})`).call(d3.axisBottom(x).ticks(10).tickFormat(d3.format(".1f"))).attr("color", colors.subtext).style("font-size", "10px");

    const line = d3.line<any>().x(d => x(Number(d.perc))).y(d => y(Number(d.perc_gene))).curve(d3.curveMonotoneX);
    const path = g.append("path").datum(data).attr("fill", "none").attr("stroke", colors.primary).attr("stroke-width", 3).attr("d", line);
    
    const totalLength = (path.node() as SVGPathElement).getTotalLength();
    path.attr("stroke-dasharray", totalLength + " " + totalLength).attr("stroke-dashoffset", totalLength).transition().duration(1500).ease(d3.easeCubicOut).attr("stroke-dashoffset", 0);

    g.selectAll("circle").data(data).enter().append("circle").attr("cx", d => x(Number(d.perc))).attr("cy", d => y(Number(d.perc_gene))).attr("r", 0).attr("fill", "#fff").attr("stroke", colors.primary).attr("stroke-width", 2).transition().delay((_, i) => 800 + i * 100).duration(500).attr("r", 4);

    const focus = g.append("g").style("display", "none");
    focus.append("line").attr("class", "hover-line").attr("y1", 0).attr("y2", iHeight).attr("stroke", colors.primary).attr("stroke-dasharray", "3,3");
    focus.append("circle").attr("r", 6).attr("fill", colors.primary).attr("stroke", "#fff").attr("stroke-width", 2);

    const tooltip = d3.select("body").append("div")
      .style("position", "absolute").style("display", "none").style("padding", "10px 14px")
      .style("background", colors.tooltipBg).style("border", `1.5px solid ${colors.primary}`)
      .style("border-radius", "12px").style("pointer-events", "none").style("z-index", "100")
      .style("box-shadow", "0 10px 25px -5px rgba(0,0,0,0.1)");

    const bisect = d3.bisector((d: any) => d.perc).left;

    g.append("rect").attr("width", iWidth).attr("height", iHeight).attr("fill", "none").attr("pointer-events", "all")
      .on("mouseover", () => { focus.style("display", null); tooltip.style("display", "block"); })
      .on("mouseout", () => { focus.style("display", "none"); tooltip.style("display", "none"); })
      .on("mousemove", (event) => {
        const mouseX = d3.pointer(event)[0];
        const x0 = x.invert(mouseX);
        const i = bisect(data, x0, 1);
        const d = x0 - data[i-1].perc > data[i].perc - x0 ? data[i] : data[i-1];
        focus.attr("transform", `translate(${x(d.perc)}, 0)`);
        focus.select("circle").attr("transform", `translate(0, ${y(d.perc_gene)})`);
        tooltip.html(`
          <div style="font-family: Inter, sans-serif;">
            <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Sampling Fraction</div>
            <div style="font-size: 15px; font-weight: 900; color: ${colors.text}; font-style: italic;">${d.perc.toFixed(2)}</div>
            <div style="margin-top: 6px; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Discovery Rate</div>
            <div style="font-size: 15px; font-weight: 900; color: ${colors.primary};">${d.perc_gene.toFixed(4)}</div>
          </div>
        `).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 50) + "px");
      });

    return () => { tooltip.remove(); };
  }, [data]);

  return <svg id="psite-saturation-svg" ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" />;
};

