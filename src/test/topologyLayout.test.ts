import { flowToTopology, topologyToFlow } from "@/components/electrical/topologyLayout";

it("preserves professional engineering details through diagram editing and save", () => {
  const topology = { nodes: [{ id: "panel", type: "panel" as const, label: "Panel", data: { conductors: "2 × #8 AWG Cu THHN", conduit: "25 mm EMT", protection: "40 A / 2P", interruptingRating: "10 kA", grounding: "EGC #10 Cu; electrode pending", note: "Professional review required" } }], edges: [] };
  const flow = topologyToFlow(topology);
  expect(flowToTopology(flow.nodes, flow.edges).nodes[0].data).toMatchObject(topology.nodes[0].data);
});
