import { createProjectPdf } from "@/lib/projectPdf";
import { t } from "@/lib/i18n";
import type { Project } from "@/hooks/useProjects";
const svgExport = vi.hoisted(() => vi.fn().mockResolvedValue(undefined));
vi.mock("svg2pdf.js", () => ({ svg2pdf: svgExport }));
const api = vi.hoisted(() => ({ getRules: vi.fn() }));
vi.mock("@/services/sokolApi", () => ({ sokolApi: api, BuildingType: { residencial: 1, comercial: 2, industrial: 3 } }));

it("includes notes, every rules page and the saved electrical study and references in the project PDF", async () => {
  const rule = (title: string) => ({ standard: title, title, description: `${title} detail`, technical_requirements: ["Technical requirement"], installation_requirements: [], inspection_requirements: [], conditions: [], applies_to: [], failure_risks: [] });
  api.getRules.mockResolvedValueOnce({ data: [{ rules: [rule("NFPA 13")] }], pagination: { totalPages: 2 } })
    .mockResolvedValueOnce({ data: [{ rules: [rule("NFPA 72")] }], pagination: { totalPages: 2 } });
  const project = { id: "project", name: "Project report", notes: "Check north entrance", building_type: 2, usage: "Office", area_m2: 350, createdAt: "2026-10-04", requirements: ["Saved fire requirement"], reference: ["Fire reference"], contextCr: ["Local requirement"],
    electrical: { inputs: { occupancy: "comercial", area_m2: 350, service: "single_phase", special_loads: { other: [{ name: "Custom load", va: 2000 }] } }, topology: { nodes: [], edges: [] }, result: { installedVa: 2000, demandedVa: 1800, demandKva: 1.8, suggestedTransformerKva: 5, topology: { nodes: [], edges: [] }, loadTable: [{ description: "Office loads", connectedVa: 2000, demandedVa: 1800, demandFactor: 0.9 }], phaseBalance: [], mandatedProvisions: [{ code: "CECR", requirement: "Saved electrical requirement", reference: "Electrical reference", status: "required" }], assumptions: ["Electrical assumption"], references: ["Code reference"], disclaimer: "Preliminary study" } },
  } as Project;
  const pdf = await createProjectPdf(project, "en", t.en);
  const document = pdf.output();
  for (const text of ["Project report", "Check north entrance", "Saved fire requirement", "Local requirement", "NFPA 13", "NFPA 72", "CECR", "Electrical reference", "Custom load", "Office loads", "Electrical assumption", "Code reference"]) {
    expect(document).toContain(text);
  }
  expect(api.getRules).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1, area_m2: 350 }));
  expect(document).not.toContain("undefined");
});


it("embeds the latest saved diagram on a landscape page in the same report", async () => {
  api.getRules.mockResolvedValueOnce({ data: [], pagination: { totalPages: 1 } });
  const topology = { nodes: [{ id: "panel", type: "panel", label: "Saved panel", data: { rating: "100 A" } }], edges: [] };
  const project = { id: "diagram", name: "Diagram report", building_type: 2, usage: "Office", area_m2: 100, createdAt: "2026-10-04", electrical: {
    inputs: { occupancy: "comercial", service: "single_phase", area_m2: 100 }, topology,
    result: { installedVa: 1000, demandKva: 1, suggestedTransformerKva: 5, topology: { nodes: [], edges: [] }, loadTable: [], phaseBalance: [], mandatedProvisions: [], assumptions: [], references: [] },
  } } as Project;
  const pdf = await createProjectPdf(project, "en", t.en);
  expect(svgExport).toHaveBeenCalledOnce();
  const [svg, document, dimensions] = svgExport.mock.calls[0];
  expect(svg.textContent).toContain("Saved panel");
  expect(svg.textContent).toContain("100 A");
  expect(document).toBe(pdf);
  expect(dimensions.width).toBeGreaterThan(0);
  expect(pdf.internal.pageSize.getWidth()).toBeGreaterThan(pdf.internal.pageSize.getHeight());
});
