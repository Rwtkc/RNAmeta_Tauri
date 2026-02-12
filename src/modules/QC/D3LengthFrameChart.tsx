// src/modules/QC/D3LengthFrameChart.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  id?: string;
  data: any[];
}

export const D3LengthFrameChart: React.FC<Props> = ({ id, data }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 900;
  const height = 450;

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 100, right: 100, bottom: 80, left: 80 };
    const iWidth = width - margin.left - margin.right;
    const iHeight = height - margin.top - margin.bottom;

    const colors = {
      text: "#1e293b",
      subtext: "#64748b",
      grid: "rgba(0,0,0,0.05)",
      palette: ["#059669", "#f59e0b", "#94a3b8"],
      tooltipBg: "#ffffff"
    };

    svg.append("text")
      .attr("x", width/2)
      .attr("y", 40)
      .attr("text-anchor", "middle")
      .attr("fill", colors.text)
      .style("font-family", "Georgia, serif")
      .style("font-weight", "bold")
      .style("font-style", "italic")
      .style("font-size", "20px")
      .text("Length-Frame Stratification");

    svg.append("text")
      .attr("x", width/2)
      .attr("y", 65)
      .attr("text-anchor", "middle")
      .attr("fill", colors.subtext)
      .style("font-family", "Inter, sans-serif")
      .style("font-size", "12px")
      .text("Abundance of footprints across reading frames stratified by fragment length.");

    const lengths = Array.from(new Set(data.map(d => d.Length))).sort((a, b) => a - b);
    const stackedData = lengths.map(len => {
      const entry: any = { Length: len };
      data.filter(d => d.Length === len).forEach(d => { entry[d.Frame] = d.Frequency; });
      return entry;
    });
    const series = d3.stack().keys(["0", "1", "2"])(stackedData);

    const x = d3.scaleBand().domain(lengths.map(String)).range([0, iWidth]).padding(0.3);
    const yMax = d3.max(series, s => d3.max(s, d => d[1])) ?? 1;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([iHeight, 0]);

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    g.append("g").attr("color", colors.grid).call(d3.axisLeft(y).ticks(6).tickSize(-iWidth).tickFormat(() => "").tickSizeOuter(0));
    g.append("g").attr("color", colors.grid).attr("transform", `translate(0,${iHeight})`).call(d3.axisBottom(x).tickSize(-iHeight).tickFormat(() => "").tickSizeOuter(0));

    g.append("g").attr("transform", `translate(0,${iHeight})`).call(d3.axisBottom(x).tickSizeOuter(0)).attr("color", colors.subtext);
    g.append("g").call(d3.axisLeft(y).ticks(6, "s").tickSizeOuter(0)).attr("color", colors.subtext);

    g.append("text").attr("x", iWidth / 2).attr("y", iHeight + 50).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "11px").style("font-style", "italic").text("Fragment Length (nt)");
    g.append("text").attr("transform", "rotate(-90)").attr("y", -60).attr("x", -iHeight / 2).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "11px").style("font-style", "italic").text("Read Frequency");

    const tooltip = svg.append("g").style("display", "none").style("pointer-events", "none");
    tooltip.append("rect").attr("width", 110).attr("height", 45).attr("fill", colors.tooltipBg).attr("stroke", "#059669").attr("stroke-width", 1.5).attr("rx", 8);
    const tipText = tooltip.append("text").attr("text-anchor", "middle").attr("x", 55).attr("fill", colors.text).style("font-family", "Inter, sans-serif").style("font-size", "10px").style("font-weight", "bold");

    const updateTooltip = (event: any, d: any) => {
      const [mx, my] = d3.pointer(event, svgRef.current);
      tooltip.attr("transform", `translate(${mx - 55}, ${my - 55})`);
      tipText.selectAll("tspan").remove();
      tipText.append("tspan").attr("x", 55).attr("dy", "1.6em").text(`Length: ${d.data.Length}nt`);
      tipText.append("tspan").attr("x", 55).attr("dy", "1.4em").text(`Frame ${d.frame}: ${d.data[d.frame].toLocaleString()}`);
    };

    g.append("g").selectAll("g").data(series).enter().append("g").attr("fill", (_, i) => colors.palette[i])
      .selectAll("rect").data(d => d.map((it: any) => ({ ...it, frame: d.key }))).enter().append("rect")
      .attr("x", d => x(String(d.data.Length))!)
      .attr("width", x.bandwidth()).attr("y", iHeight).attr("height", 0)
      .on("mouseover", (event, d) => { 
        tooltip.style("display", null); 
        updateTooltip(event, d);
      })
      .on("mouseout", () => tooltip.style("display", "none"))
      .on("mousemove", (event, d) => updateTooltip(event, d))
      .transition().duration(800).delay((_, i) => i * 20).attr("y", d => y(d[1])).attr("height", d => y(d[0]) - y(d[1]));

    const legend = svg.append("g").attr("transform", `translate(${width - 90}, ${margin.top})`);
    ["Frame 0", "Frame 1", "Frame 2"].forEach((label, i) => {
      const lg = legend.append("g").attr("transform", `translate(0, ${i * 22})`);
      lg.append("rect").attr("width", 10).attr("height", 10).attr("fill", colors.palette[i]).attr("rx", 2);
      lg.append("text").attr("x", 16).attr("y", 9).text(label).attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "9px").style("font-weight", "bold");
    });
  }, [data]);

  return <svg id={id} ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" />;
};

