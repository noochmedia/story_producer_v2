import React, { useEffect, useRef } from 'react'
import * as d3 from 'd3'

interface Node {
  id: string
  label: string
  size: number
}

interface Link {
  source: string
  target: string
  value: number
}

interface ForceGraphProps {
  data: {
    nodes: Node[]
    links: Link[]
  }
  width: number
  height: number
}

export function ForceGraph({ data, width, height }: ForceGraphProps) {
  const svgRef = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (!svgRef.current) return

    const svg = d3.select(svgRef.current)
    svg.selectAll("*").remove() // Clear existing content

    const simulation = d3.forceSimulation(data.nodes)
      .force("link", d3.forceLink(data.links).id((d: any) => d.id))
      .force("charge", d3.forceManyBody())
      .force("center", d3.forceCenter(width / 2, height / 2))

    const link = svg.append("g")
      .selectAll("line")
      .data(data.links)
      .join("line")
      .attr("stroke", "#999")
      .attr("stroke-opacity", 0.6)
      .attr("stroke-width", (d) => Math.sqrt(d.value))

    const node = svg.append("g")
      .selectAll("circle")
      .data(data.nodes)
      .join("circle")
      .attr("r", (d) => d.size)
      .attr("fill", "#69b3a2")
      .call(drag(simulation) as any)

    const label = svg.append("g")
      .selectAll("text")
      .data(data.nodes)
      .join("text")
      .text((d) => d.label)
      .attr("font-size", 10)
      .attr("dx", 12)
      .attr("dy", 4)

    simulation.on("tick", () => {
      link
        .attr("x1", (d: any) => d.source.x)
        .attr("y1", (d: any) => d.source.y)
        .attr("x2", (d: any) => d.target.x)
        .attr("y2", (d: any) => d.target.y)

      node
        .attr("cx", (d: any) => d.x)
        .attr("cy", (d: any) => d.y)

      label
        .attr("x", (d: any) => d.x)
        .attr("y", (d: any) => d.y)
    })

    function drag(simulation: d3.Simulation<d3.SimulationNodeDatum, undefined>) {
      function dragstarted(event: any) {
        if (!event.active) simulation.alphaTarget(0.3).restart()
        event.subject.fx = event.subject.x
        event.subject.fy = event.subject.y
      }

      function dragged(event: any) {
        event.subject.fx = event.x
        event.subject.fy = event.y
      }

      function dragended(event: any) {
        if (!event.active) simulation.alphaTarget(0)
        event.subject.fx = null
        event.subject.fy = null
      }

      return d3.drag()
        .on("start", dragstarted)
        .on("drag", dragged)
        .on("end", dragended)
    }
  }, [data, width, height])

  return <svg ref={svgRef} width={width} height={height}></svg>
}

