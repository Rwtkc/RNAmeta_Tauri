// src/modules/Codon/D3MetacodonChart.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface MetacodonData {
  codons_seq: string;
  normalized_value: number[];
}

interface Props {
  id?: string;
  data: MetacodonData;
}

export const D3MetacodonChart: React.FC<Props> = ({ id, data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 800;
  const height = 450;

  useEffect(() => {
    if (!svgRef.current || !data || !data.normalized_value || data.normalized_value.length === 0) return;

    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 80, right: 40, bottom: 80, left: 70 };
    const innerWidth = width - margin.left - margin.right;
    const innerHeight = height - margin.top - margin.bottom;

    const colors = {
      primary: "#059669",
      text: "#1e293b",
      subtext: "#64748b",
      grid: "rgba(0,0,0,0.06)",
      background: "#f9fafb",
      highlight: "#10b981",
      tooltipBg: "#ffffff"
    };


    svg.append("rect")
      .attr("width", width)
      .attr("height", height)
      .attr("fill", colors.background);

    svg.append("text")
      .attr("x", width / 2).attr("y", 35).attr("text-anchor", "middle")
      .attr("fill", colors.text).attr("font-family", "Georgia, serif").attr("font-weight", "bold").attr("font-style", "italic").attr("font-size", "20px")
      .text(`Metacodon Profile: ${data.codons_seq.toUpperCase()}`);

    svg.append("text")
      .attr("x", width / 2).attr("y", 58).attr("text-anchor", "middle")
      .attr("fill", colors.subtext).attr("font-family", "Inter, sans-serif").attr("font-size", "11px")
      .text("Normalized occupancy across positions relative to codon center");

    const values = data.normalized_value.map((value, index) => ({ index, value }));
    const centerIndex = Math.floor((values.length - 1) / 2);

    const x = d3.scaleLinear().domain([0, values.length - 1]).range([0, innerWidth]);
    const yMax = Math.max(2.0, d3.max(values, d => d.value) || 0) * 1.1;
    const y = d3.scaleLinear().domain([0, yMax]).range([innerHeight, 0]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g").attr("color", colors.grid)
      .call(d3.axisLeft(y).ticks(6).tickSize(-innerWidth).tickFormat(() => ""))
      .selectAll("line").attr("stroke-dasharray", "3,3");

    const xAxis = d3.axisBottom(x)
      .ticks(Math.min(10, values.length))
      .tickFormat(d => (Number(d) - centerIndex).toString().replace('\u2212', '-'));

    g.append("g").attr("transform", `translate(0,${innerHeight})`).call(xAxis)
      .attr("color", colors.subtext)
      .selectAll("text").attr("font-family", "Inter, sans-serif").attr("font-size", "10px");

    g.append("g").call(d3.axisLeft(y).ticks(6).tickFormat(d => d.toString().replace('\u2212', '-')))
      .attr("color", colors.subtext)
      .selectAll("text").attr("font-family", "Inter, sans-serif").attr("font-size", "10px");

    g.append("line")
      .attr("x1", x(centerIndex)).attr("x2", x(centerIndex)).attr("y1", 0).attr("y2", innerHeight)
      .attr("stroke", colors.subtext).attr("stroke-width", 1).attr("stroke-dasharray", "2,4").attr("opacity", 0.6);

    g.append("line")
      .attr("x1", 0).attr("x2", innerWidth).attr("y1", y(1.2)).attr("y2", y(1.2))
      .attr("stroke", "#ef4444").attr("stroke-width", 1.2).attr("stroke-dasharray", "4,2");


    const lineGenerator = d3.line<{ index: number; value: number }>()
      .x(d => x(d.index)).y(d => y(d.value)).curve(d3.curveMonotoneX);

    const path = g.append("path")
      .datum(values)
      .attr("fill", "none").attr("stroke", colors.primary).attr("stroke-width", 2.5).attr("d", lineGenerator);

    const totalLength = (path.node() as SVGPathElement).getTotalLength();
    path.attr("stroke-dasharray", totalLength + " " + totalLength)
        .attr("stroke-dashoffset", totalLength)
        .transition().duration(1200).ease(d3.easeCubicOut)
        .attr("stroke-dashoffset", 0);


    const circles = g.selectAll("circle")
      .data(values).enter().append("circle")
      .attr("cx", d => x(d.index)).attr("cy", d => y(d.value))
      .attr("r", 0) 
      .attr("fill", colors.primary).attr("stroke", colors.background).attr("stroke-width", 1.5);

    circles.transition().duration(600).delay((_, i) => 800 + i * 20).attr("r", 3.5);

    const tooltip = d3.select("body").append("div")
      .style("position", "absolute").style("display", "none")
      .style("background", colors.tooltipBg).style("border", `1.2px solid ${colors.primary}`)
      .style("padding", "8px 12px").style("border-radius", "10px")
      .style("pointer-events", "none").style("z-index", 100).style("box-shadow", "0 10px 20px rgba(0,0,0,0.15)");

    circles.on("mouseover", function(event, d) {
        d3.select(this).transition().duration(200).attr("r", 6).attr("fill", colors.highlight);
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 60) + "px");
        
        tooltip.style("display", "block").html(`
            <div style="font-family: Inter, sans-serif;">
                <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Relative Position</div>
                <div style="font-size: 15px; font-weight: 900; color: ${colors.text}; font-style: italic;">${d.index - centerIndex} nt</div>
                <div style="margin-top: 6px; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Occupancy</div>
                <div style="font-size: 16px; font-weight: 900; color: ${colors.primary};">${d.value.toFixed(4)}</div>
            </div>
        `);
    })
    .on("mousemove", (event) => {
        tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 60) + "px");
    })
    .on("mouseout", function() {
        d3.select(this).transition().duration(200).attr("r", 3.5).attr("fill", colors.primary);
        tooltip.style("display", "none");
    });


    g.append("text").attr("x", innerWidth / 2).attr("y", innerHeight + 45).attr("text-anchor", "middle")
      .attr("fill", colors.subtext).attr("font-family", "Inter, sans-serif").attr("font-size", "11px").attr("font-style", "italic")
      .text("Position (relative to codon center)");

    g.append("text").attr("transform", "rotate(-90)").attr("y", -50).attr("x", -innerHeight / 2).attr("text-anchor", "middle")
      .attr("fill", colors.subtext).attr("font-family", "Inter, sans-serif").attr("font-size", "11px").attr("font-style", "italic")
      .text("Normalized Occupancy");

    return () => { tooltip.remove(); };
  }, [data]);

  return <svg id={id} ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" />;
};

