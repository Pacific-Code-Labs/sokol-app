import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Evaluator from "@/pages/Evaluator";
import { t } from "@/lib/i18n";

const api = vi.hoisted(() => ({ getRules: vi.fn() }));
vi.mock("@/services/sokolApi", () => ({ sokolApi: api, BuildingType: { residencial: 1, comercial: 2, industrial: 3 }, RuleCategory: { iniciacion: 1, notificacion: 2, monitoreo: 3, accionamiento: 4 } }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "es", tr: t.es }) }));
vi.mock("@/contexts/AssistantContext", () => ({ useAssistant: () => ({ setInput: vi.fn(), setPageContext: vi.fn() }) }));
vi.mock("@/components/CategoryCard", () => ({ CategoryCard: ({ group }: { group: { rules: { title: string }[] } }) => <div>{group.rules.map(rule => rule.title).join(", ")}</div> }));
vi.mock("@/components/assistant/EvaluationCard", () => ({ EvaluationCard: () => <p>Assistant response must remain in chat</p> }));

it("fills the visible filters and loads matching rules automatically without duplicating the chat response", async () => {
  api.getRules.mockResolvedValue({ data: [{ type: "accionamiento", quantity: 1, rules: [{ title: "NFPA 13 — Rociadores", risk: { level: "alto" } }] }], pagination: { totalElements: 1, totalPages: 1, page: 0 } });
  const result = { matchedRules: [], requirements: ["Assistant-only requirement"], reference: [], contextCr: [], risk: "alto", foundryUsed: true };
  const request = { user_query: "Evalúa mi bodega", building_type: 3, usage: "Bodega industrial", area_m2: 1200, floors: 2, occupants: 50, ceiling_height_m: 6, volume_m3: 7200 };
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[{ pathname: "/es/dashboard/evaluator", state: { assistantEvaluation: result, assistantRequest: request } }]}><Evaluator /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByLabelText(t.es.area)).toHaveValue(1200);
  expect(screen.getByLabelText(t.es.usage_label)).toHaveValue("Bodega industrial");
  expect(screen.getByLabelText(t.es.floors)).toHaveValue(2);
  expect(screen.getByLabelText(t.es.occupants)).toHaveValue(50);
  expect(screen.getByLabelText(t.es.ceilingHeight)).toHaveValue(6);
  expect(screen.getByLabelText(t.es.volume)).toHaveValue(7200);
  expect(await screen.findByText("NFPA 13 — Rociadores")).toBeInTheDocument();
  expect(api.getRules).toHaveBeenCalledWith(expect.objectContaining({ building_type: 3, usage: "Bodega industrial", area_m2: 1200, floors: 2, occupants: 50, ceiling_height_m: 6, volume_m3: 7200 }));
  expect(api.getRules).toHaveBeenCalledOnce();
  expect(screen.queryByText("Assistant response must remain in chat")).not.toBeInTheDocument();
  expect(screen.queryByText("Evalúa mi bodega")).not.toBeInTheDocument();
  expect(screen.queryByRole("button", { name: t.es.assistant_browse_rules })).not.toBeInTheDocument();
  fireEvent.change(screen.getByLabelText(t.es.area), { target: { value: "1500" } });
  await waitFor(() => expect(api.getRules).toHaveBeenLastCalledWith(expect.objectContaining({ area_m2: 1500 })));
});
