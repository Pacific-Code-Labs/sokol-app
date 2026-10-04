import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ProjectCodeRules } from "@/components/ProjectCodeRules";
import type { Project } from "@/hooks/useProjects";
import { t } from "@/lib/i18n";
const api = vi.hoisted(() => ({ getRules: vi.fn() }));
vi.mock("@/services/sokolApi", () => ({ sokolApi: api }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "es", tr: t.es }) }));
vi.mock("@/components/CategoryCard", () => ({ CategoryCard: ({ group }: { group: { rules: { title: string }[] } }) => <p>{group.rules.map(rule => rule.title).join(", ")}</p> }));
const project = { id: "saved", name: "Office", building_type: 2, usage: "Office", area_m2: 350, floors: 2, occupants: 40, createdAt: "2026-10-04" } as Project;

it("loads NFPA rules using saved parameters with pagination and displays recorded electrical provisions", async () => {
  api.getRules.mockResolvedValueOnce({ data: [{ type: "accionamiento", rules: [{ title: "NFPA 13" }] }], pagination: { totalPages: 2 } })
    .mockResolvedValueOnce({ data: [{ type: "notificacion", rules: [{ title: "NFPA 72" }] }], pagination: { totalPages: 2 } });
  const electrical = { result: { mandatedProvisions: [{ code: "CECR", requirement: "Saved electrical provision", reference: "NEC reference", status: "required" }], references: ["Costa Rica code reference"] } } as Project["electrical"];
  render(<QueryClientProvider client={new QueryClient()}><ProjectCodeRules project={{ ...project, electrical }} /></QueryClientProvider>);
  expect(await screen.findByText("NFPA 13")).toBeInTheDocument();
  expect(api.getRules).toHaveBeenCalledWith(expect.objectContaining({ building_type: 2, usage: "Office", area_m2: 350, floors: 2, occupants: 40, page: 0 }));
  expect(screen.getByText("Saved electrical provision")).toBeInTheDocument();
  expect(screen.getByText("Costa Rica code reference")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: t.es.tour_next }));
  expect(await screen.findByText("NFPA 72")).toBeInTheDocument();
  await waitFor(() => expect(api.getRules).toHaveBeenLastCalledWith(expect.objectContaining({ page: 1 })));
});

it("does not claim applied electrical rules before a study exists", () => {
  api.getRules.mockResolvedValue({ data: [], pagination: { totalPages: 1 } });
  render(<QueryClientProvider client={new QueryClient()}><ProjectCodeRules project={project} /></QueryClientProvider>);
  expect(screen.getByText(t.es.project_electrical_rules_missing)).toBeInTheDocument();
});
