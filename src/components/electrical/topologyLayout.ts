/**
 * Shared helpers to convert between the wire Topology shape and @xyflow/react
 * nodes/edges, plus a @dagrejs/dagre top-down auto-layout. Used by both the
 * interactive editor and the read-only ElectricalLoadCard so layout stays
 * consistent.
 */
import dagre from "@dagrejs/dagre";
import { MarkerType, type Edge } from "@xyflow/react";
import type { Topology, TopologyNode } from "@/services/sokolApi";
import type { ElectricalRFNode } from "./electricalNodes";

const NODE_W = 280;
const NODE_H = 250;

/** Map a wire TopologyNode to a React Flow node (type = its topology kind). */
export function toRFNode(n: TopologyNode): ElectricalRFNode {
  return {
    id: n.id,
    type: n.type,
    position: { x: 0, y: 0 },
    data: {
      ...n.data,
      label: n.label,
      kind: n.type,
      va: n.data?.va,
      rating: n.data?.rating,
      phase: n.data?.phase,
      note: n.data?.note,
    },
  };
}

/** Map wire edges to React Flow step edges. */
export function toRFEdges(topology: Topology): Edge[] {
  return topology.edges.map((e) => ({
    id: e.id,
    source: e.source,
    target: e.target,
    type: "step",
    markerEnd: { type: MarkerType.ArrowClosed },
  }));
}

/** Top-down dagre layout; returns nodes with computed positions. */
export function layoutNodes(nodes: ElectricalRFNode[], edges: Edge[]): ElectricalRFNode[] {
  const g = new dagre.graphlib.Graph();
  g.setDefaultEdgeLabel(() => ({}));
  g.setGraph({ rankdir: "TB", nodesep: 40, ranksep: 56 });

  nodes.forEach((n) => g.setNode(n.id, { width: NODE_W, height: NODE_H }));
  edges.forEach((e) => g.setEdge(e.source, e.target));

  dagre.layout(g);

  return nodes.map((n) => {
    const pos = g.node(n.id);
    return {
      ...n,
      position: pos
        ? { x: pos.x - NODE_W / 2, y: pos.y - NODE_H / 2 }
        : n.position,
    };
  });
}

/** Build laid-out React Flow nodes + edges from a wire Topology. */
export function topologyToFlow(topology: Topology): {
  nodes: ElectricalRFNode[];
  edges: Edge[];
} {
  const edges = toRFEdges(topology);
  const nodes = layoutNodes(topology.nodes.map(toRFNode), edges);
  return { nodes, edges };
}

/** Convert current React Flow nodes/edges back to the wire Topology shape. */
export function flowToTopology(nodes: ElectricalRFNode[], edges: Edge[]): Topology {
  return {
    nodes: nodes.map<TopologyNode>((n) => ({
      id: n.id,
      type: n.data.kind,
      label: n.data.label,
      data: {
        conductors: n.data.conductors,
        conduit: n.data.conduit,
        feederLength: n.data.feederLength,
        protection: n.data.protection,
        interruptingRating: n.data.interruptingRating,
        grounding: n.data.grounding,
        va: n.data.va,
        rating: n.data.rating,
        phase: n.data.phase,
        note: n.data.note,
      },
    })),
    edges: edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
    })),
  };
}
