import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import Evaluator from "@/pages/Evaluator";
import { t } from "@/lib/i18n";

const api = vi.hoisted(() => ({ getRules: vi.fn() }));
vi.mock("@/services/sokolApi", () => ({ sokolApi: api, BuildingType: { residencial: 1, comercial: 2, industrial: 3 }, RuleCategory: { iniciacion: 1, notificacion: 2, monitoreo: 3, accionamiento: 4 } }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "es", tr: t.es }) }));
vi.mock("@/contexts/AssistantContext", () => ({ useAssistant: () => ({ setInput: vi.fn(), setPageContext: vi.fn() }) }));
vi.mock("@/components/BuildingSelector", () => ({ BuildingSelector: () => null }));
vi.mock("@/components/CategoryCard", () => ({ CategoryCard: ({ group }: { group: { rules: { title: string }[] } }) => <div>{group.rules.map(rule => rule.title).join(", ")}</div> }));
vi.mock("@/components/assistant/EvaluationCard", () => ({ EvaluationCard: () => null }));

it("shows the actual applied NFPA rules rather than a default catalogue after assistant navigation", () => {
  const result = { matchedRules: [{ id: "sprinkler", title: "NFPA 13 — Rociadores", category: "accionamiento", risk: { level: "alto" } }], requirements: [], reference: [], contextCr: [], risk: "alto", foundryUsed: true };
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={[{ pathname: "/es/dashboard/evaluator", state: { assistantEvaluation: result, assistantRequest: { user_query: "Evalúa mi bodega", building_type: 3, area_m2: 1200 } } }]}><Evaluator /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByText("NFPA 13 — Rociadores")).toBeInTheDocument();
  expect(screen.getByText("Evalúa mi bodega")).toBeInTheDocument();
  expect(api.getRules).not.toHaveBeenCalled();
});
