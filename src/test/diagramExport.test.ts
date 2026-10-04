import { diagramSvg } from "@/components/electrical/downloadDiagram";
import type { ElectricalRFNode } from "@/components/electrical/electricalNodes";

it("exports the complete graph with engineering details, escaped text and pending fields", () => {
  const nodes: ElectricalRFNode[] = [
    { id: "panel", type: "panel", position: {x:0,y:0}, data: {kind:"panel",label:"Panel <A&B>", conductors:"2 × #8 AWG Cu THHN", protection:"40 A / 2P", grounding:"EGC pending"} },
    { id: "load", type: "load", position: {x:50000,y:50000}, data: {kind:"load",label:"Carga remota", va:1500} },
  ];
  const result = diagramSvg(nodes, [{source:"panel",target:"load"}], "PRELIMINARY — professional review required", { title:"Diagrama unifilar", conductors:"Conductors",protection:"Protection",grounding:"Grounding",conduit:"Raceway",feederLength:"Length",interruptingRating:"Fault current",pending:"Pending validation" });
  const xml = new DOMParser().parseFromString(result.source,"image/svg+xml");
  expect(xml.querySelector("parsererror")).toBeNull();
  expect(result.source).toContain("Panel &lt;A&amp;B&gt;");
  expect(xml.documentElement.textContent).toContain("2 × #8 AWG Cu THHN");
  expect(xml.documentElement.textContent).toContain("Carga remota");
  expect(xml.documentElement.textContent).toContain("Pending validation");
  expect(xml.documentElement.textContent).toContain("professional review required");
  expect(result.width).toBeLessThan(2000);
  expect(result.source).not.toMatch(/foreignObject|href="https?:/);
});
