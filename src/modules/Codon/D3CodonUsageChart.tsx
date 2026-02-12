// src/modules/Codon/D3CodonUsageChart.tsx
import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';

interface UsageData {
  codon: string;
  aminoacid: string;
  norm_codon_usage: number;
}

interface Props {
  id?: string;
  data: UsageData[];
  title: string;
  sortType: 'default' | 'desc' | 'asc';
}

export const D3CodonUsageChart: React.FC<Props> = ({ id, data, title, sortType }) => {
  const svgRef = useRef<SVGSVGElement>(null);
  const width = 1100;
  const height = 500;

  useEffect(() => {
    if (!svgRef.current || !data || data.length === 0) return;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const margin = { top: 80, right: 40, bottom: 100, left: 60 };
    const iWidth = width - margin.left - margin.right;
    const iHeight = height - margin.top - margin.bottom;

    const colors = {
      primary: "#059669",
      text: "#1e293b",
      subtext: "#64748b",
      grid: "rgba(0,0,0,0.05)",
      tooltipBg: "#ffffff",
      highlight: "#10b981",
      zebraWarm: "rgba(245, 158, 11, 0.08)",
      zebraCool: "rgba(100, 116, 139, 0.07)"
    };

    svg.append("rect")
       .attr("width", width).attr("height", height)
       .attr("fill", "#f9fafb");

    svg.append("text")
       .attr("x", width/2).attr("y", 35)
       .attr("text-anchor", "middle")
       .attr("fill", colors.text)
       .attr("font-family", "Times New Roman, serif")
       .attr("font-weight", "bold")
       .attr("font-style", "italic")
       .attr("font-size", "20px")
       .style("font-family", "Georgia, serif")
       .style("font-weight", "bold")
       .style("font-style", "italic")
       .style("font-size", "20px")
       .text(title);
    
    svg.append("text")
       .attr("x", width/2).attr("y", 58)
       .attr("text-anchor", "middle")
       .attr("fill", colors.subtext)
       .attr("font-family", "Arial, sans-serif")
       .attr("font-size", "12px")
       .style("font-family", "Inter, sans-serif")
       .style("font-size", "12px")
       .text("Normalized occupancy relative to gene average (Significance Threshold: 1.2)");

    let sortedData = [...data];
    if (sortType === 'desc') {
        sortedData.sort((a, b) => b.norm_codon_usage - a.norm_codon_usage);
    } else if (sortType === 'asc') {
        sortedData.sort((a, b) => a.norm_codon_usage - b.norm_codon_usage);
    } else {
        sortedData.sort((a, b) => {
            if (a.aminoacid === b.aminoacid) return a.codon.localeCompare(b.codon);
            return a.aminoacid.localeCompare(b.aminoacid);
        });
    }

    const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

    const x = d3.scaleBand().domain(sortedData.map(d => d.codon)).range([0, iWidth]).padding(0.6);
    const yMax = Math.max(2.0, d3.max(sortedData, d => d.norm_codon_usage || 0) || 0) * 1.1;
    const y = d3.scaleLinear().domain([0, yMax]).range([iHeight, 0]);

    if (sortType === 'default') {
        const aaGroups = d3.group(sortedData, d => d.aminoacid);
        const groupsArray = Array.from(aaGroups);
        const step = x.step();
        const halfGap = (step - x.bandwidth()) / 2;

        groupsArray.forEach(([aa, items], index) => {
            const firstCodon = items[0].codon;
            const lastCodon = items[items.length - 1].codon;
            let startX = x(firstCodon)! - halfGap;
            let endX = x(lastCodon)! + x.bandwidth() + halfGap;
            if (index === 0) startX = 0;
            if (index === groupsArray.length - 1) endX = iWidth;
            const groupWidth = endX - startX;
            
            g.append("rect")
             .attr("x", startX).attr("y", 0).attr("width", groupWidth).attr("height", iHeight)
             .attr("fill", index % 2 === 0 ? colors.zebraWarm : colors.zebraCool);

            g.append("text")
             .attr("x", startX + groupWidth / 2).attr("y", -5)
             .attr("text-anchor", "middle")
             .attr("font-family", "Arial, sans-serif")
             .attr("font-weight", "800")
             .attr("font-size", "11px")
             .attr("fill", colors.text)
             .style("font-family", "Inter, sans-serif")
             .style("font-weight", "800")
             .style("font-size", "11px")
             .text(aa);
        });
    }

    const yAxisGrid = d3.axisLeft(y).ticks(6).tickSize(-iWidth).tickFormat(d3.format(".1f"));
    g.append("g").attr("class", "grid").attr("color", colors.grid).call(yAxisGrid).selectAll("line").attr("stroke-dasharray", "3,3");

    const xAxisGenerator = d3.axisBottom(x).tickSize(0);
    if (sortType !== 'default') {
        xAxisGenerator.tickFormat(d => {
            const item = sortedData.find(s => s.codon === d);
            return item ? `${d}(${item.aminoacid})` : d;
        });
    }

    const xAxisG = g.append("g").attr("transform", `translate(0,${iHeight})`).call(xAxisGenerator).attr("color", colors.subtext);
    xAxisG.selectAll("text")
     .attr("transform", "rotate(-90)")
     .attr("x", -10).attr("y", 0).attr("dy", ".35em")
     .attr("font-family", "Arial, sans-serif")
     .attr("font-weight", "500")
     .attr("font-size", "10px")
     .style("text-anchor", "end")
     .style("font-family", "Inter, sans-serif")
     .style("font-weight", "500")
     .style("font-size", "10px")
     .attr("fill", colors.subtext);

    const yAxisG = g.append("g")
     .call(d3.axisLeft(y).ticks(6).tickSize(5).tickSizeOuter(0)) 
     .attr("color", colors.subtext);

    yAxisG.selectAll("text")
     .attr("font-family", "Arial, sans-serif")
     .attr("font-size", "10px")
     .style("font-family", "Inter, sans-serif")
     .style("font-size", "10px");

    g.append("line")
     .attr("x1", 0).attr("x2", iWidth)
     .attr("y1", y(1.2)).attr("y2", y(1.2))
     .attr("stroke", "#ef4444").attr("stroke-width", 1.5).attr("stroke-dasharray", "4,2");

    g.selectAll(".stem")
     .data(sortedData).enter().append("line")
     .attr("class", "stem")
     .attr("x1", d => x(d.codon)! + x.bandwidth()/2)
     .attr("x2", d => x(d.codon)! + x.bandwidth()/2)
     .attr("y1", iHeight).attr("y2", iHeight)
     .attr("stroke", colors.primary).attr("stroke-width", 1.5)
     .transition().duration(1000).delay((_, i) => i * 10)
     .attr("y2", d => y(d.norm_codon_usage || 0));

    const circles = g.selectAll("circle")
     .data(sortedData).enter().append("circle")
     .attr("cx", d => x(d.codon)! + x.bandwidth()/2)
     .attr("cy", d => y(d.norm_codon_usage || 0))
     .attr("r", 0) 
     .attr("fill", colors.primary)
     .attr("stroke", "#fff")
     .attr("stroke-width", 1);

    circles.transition().duration(800).delay((_, i) => 800 + i * 10).attr("r", 3.5);

    const tooltip = d3.select("body").append("div")
      .style("position", "absolute").style("display", "none")
      .style("background", colors.tooltipBg).style("border", `1.2px solid ${colors.primary}`)
      .style("padding", "8px 12px").style("border-radius", "10px")
      .style("pointer-events", "none").style("z-index", 100).style("box-shadow", "0 10px 20px rgba(0,0,0,0.15)");

    circles.on("mouseover", function(event, d) {
        d3.select(this).transition().duration(200).attr("r", 6).attr("fill", colors.highlight);
        const safeUsage = Number(d.norm_codon_usage || 0);
        tooltip.style("display", "block").html(`
            <div style="font-family: Inter, sans-serif;">
                <div style="font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Amino Acid / Codon</div>
                <div style="font-size: 15px; font-weight: 900; color: ${colors.text}; font-style: italic;">${d.aminoacid} (${d.codon})</div>
                <div style="margin-top: 6px; font-size: 9px; font-weight: 800; color: #94a3b8; text-transform: uppercase;">Occupancy</div>
                <div style="font-size: 16px; font-weight: 900; color: ${colors.primary};">${safeUsage.toFixed(3)}</div>
            </div>
        `).style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 60) + "px");
    })
    .on("mousemove", (event) => tooltip.style("left", (event.pageX + 15) + "px").style("top", (event.pageY - 60) + "px"))
    .on("mouseout", function() {
        d3.select(this).transition().duration(200).attr("r", 3.5).attr("fill", colors.primary);
        tooltip.style("display", "none");
    });

    g.append("text").attr("transform", "rotate(-90)").attr("y", -45).attr("x", -iHeight/2).attr("text-anchor", "middle")
     .attr("font-family", "Arial, sans-serif").attr("font-size", "11px").attr("font-style", "italic")
     .style("font-family", "Inter, sans-serif").style("font-size", "11px").style("font-style", "italic")
     .attr("fill", colors.subtext).text("Normalized Occupancy");

    return () => { tooltip.remove(); };
  }, [data, title, sortType]);

  return <svg id={id} ref={svgRef} viewBox={`0 0 ${width} ${height}`} className="w-full h-auto" />;
};

