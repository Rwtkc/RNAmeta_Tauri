// src/modules/QC/D3FrameChart.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface Props {
  id?: string;
  data: any[];
}

export const D3FrameChart: React.FC<Props> = ({ id, data }) => {
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

    const colors = {
      text: "#1e293b",
      subtext: "#64748b",
      grid: "rgba(0,0,0,0.05)",
      palette: ["#059669", "#34d399", "#a7f3d0"],
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
      .text("Triplet Periodicity Enrichment");

    svg.append("text")
      .attr("x", width/2)
      .attr("y", 65)
      .attr("text-anchor", "middle")
      .attr("fill", colors.subtext)
      .style("font-family", "Inter, sans-serif")
      .style("font-size", "12px")
      .text("Relative distribution of P-sites across reading frames by genomic region.");

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const regions = ["5' UTR", "CDS", "3' UTR"];
    const x0 = d3.scaleBand().domain(regions).rangeRound([0, iWidth]).paddingInner(0.2);
    const x1 = d3.scaleBand().domain(["0", "1", "2"]).rangeRound([0, x0.bandwidth()]).padding(0.05);
    const y = d3.scaleLinear().domain([0, (d3.max(data, d => d.perc) ?? 1) * 1.1]).nice().range([iHeight, 0]);

    g.append("g").attr("color", colors.grid).call(d3.axisLeft(y).ticks(5).tickSize(-iWidth).tickFormat(() => "").tickSizeOuter(0));
    g.append("g").attr("transform", `translate(0,${iHeight})`).call(d3.axisBottom(x0).tickSizeOuter(0)).attr("color", colors.subtext);
    g.append("g").call(d3.axisLeft(y).ticks(5, "%").tickSizeOuter(0)).attr("color", colors.subtext);

    g.append("text").attr("x", iWidth/2).attr("y", iHeight + 50).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "11px").style("font-style", "italic").text("Genomic Feature Category");
    g.append("text").attr("transform", "rotate(-90)").attr("y", -60).attr("x", -iHeight / 2).attr("text-anchor", "middle").attr("fill", colors.subtext).style("font-family", "Inter, sans-serif").style("font-size", "11px").style("font-style", "italic").text("P-site Frequency (%)");

    const tooltip = svg.append("g").style("display", "none").style("pointer-events", "none");
    tooltip.append("rect").attr("width", 120).attr("height", 50).attr("fill", colors.tooltipBg).attr("stroke", "#059669").attr("stroke-width", 1.5).attr("rx", 8);
    const tipText = tooltip.append("text").attr("text-anchor", "middle").attr("x", 60).attr("fill", colors.text).style("font-family", "Inter, sans-serif").style("font-size", "10px").style("font-weight", "bold");

    const updateTooltip = (event: any, d: any) => {
      const [mx, my] = d3.pointer(event, svgRef.current);
      tooltip.attr("transform", `translate(${mx - 60}, ${my - 65})`);
      tipText.selectAll("tspan").remove();
      tipText.append("tspan").attr("x", 60).attr("dy", "1.6em").text(`${d.region}`);
      tipText.append("tspan").attr("x", 60).attr("dy", "1.4em").text(`Frame ${d.frame}: ${(d.perc * 100).toFixed(2)}%`);
    };

    g.append("g").selectAll("g").data(regions).enter().append("g").attr("transform", d => `translate(${x0(d)},0)`)
      .selectAll("rect").data(r => data.filter(d => d.region === r)).enter().append("rect")
      .attr("x", d => x1(String(d.frame))!)
      .attr("width", x1.bandwidth())
      .attr("fill", d => colors.palette[d.frame])
      .attr("rx", 4).attr("y", iHeight).attr("height", 0)
      .on("mouseover", (event, d) => { 
        tooltip.style("display", null); 
        updateTooltip(event, d);
      })
      .on("mouseout", () => tooltip.style("display", "none"))
      .on("mousemove", (event, d) => updateTooltip(event, d))
      .transition().duration(1000).delay((_, i) => i * 50).attr("y", d => y(d.perc)).attr("height", d => iHeight - y(d.perc));

  }, [data]);

  return <svg id={id} ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" />;
};

