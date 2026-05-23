import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { Note, Flashcard } from '../types';

interface KnowledgeGraphProps {
  notes: Note[];
  cards: Flashcard[];
}

export const KnowledgeGraph: React.FC<KnowledgeGraphProps> = ({ notes, cards }) => {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    const width = 800;
    const height = 500;
    const svg = d3.select(svgRef.current);
    svg.selectAll("*").remove();

    const nodes: any[] = notes.map(n => ({ id: n.id, name: n.title, type: 'note', val: 10 }));
    const links: any[] = [];

    notes.forEach((n, i) => {
      notes.forEach((m, j) => {
        if (i < j) {
          links.push({ source: n.id, target: m.id });
        }
      });
    });

    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d: any) => d.id).distance(150))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(width / 2, height / 2));

    const link = svg.append("g")
      .attr("stroke", "rgba(255, 255, 255, 0.08)")
      .attr("stroke-opacity", 0.8)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("stroke-width", 1.5);

    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .call(d3.drag<any, any>()
        .on("start", (event, d) => {
          if (!event.active) simulation.alphaTarget(0.3).restart();
          d.fx = d.x;
          d.fy = d.y;
        })
        .on("drag", (event, d) => {
          d.fx = event.x;
          d.fy = event.y;
        })
        .on("end", (event, d) => {
          if (!event.active) simulation.alphaTarget(0);
          d.fx = null;
          d.fy = null;
        })
      );

    node.append("circle")
      .attr("r", 14)
      .attr("fill", "#0a84ff")
      .attr("stroke", "#1c1c1e")
      .attr("stroke-width", 3)
      .style("filter", "drop-shadow(0px 4px 10px rgba(10,132,255,0.4))");

    node.append("text")
      .text(d => d.name)
      .attr("fill", "rgba(255, 255, 255, 0.8)")
      .attr("font-size", "11px")
      .attr("font-weight", "500")
      .attr("letter-spacing", "-0.01em")
      .attr("dx", 20)
      .attr("dy", 4);

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y);

      node
        .attr("transform", (d: any) => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [notes, cards]);

  return (
    <div className="w-full h-full bg-[#1c1c1e]/40 backdrop-blur-md border border-white/5 rounded-2xl overflow-hidden flex flex-col relative shadow-2xl">
      <div className="absolute top-6 left-6 z-10">
        <h3 className="text-sm font-bold flex items-center gap-2 text-white tracking-tight">
          <i className="fas fa-project-diagram text-apple-blue"></i>
          神经元突触联动拓扑图谱
        </h3>
        <p className="text-[11px] text-zinc-500 mt-1 leading-normal">实时构建、测绘多维度知识集节点在空间层级的映射关联。</p>
      </div>
      <svg ref={svgRef} viewBox="0 0 800 500" className="w-full h-full" />
    </div>
  );
};
