import { useState } from "react";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ChatPanel, type Msg } from "@/components/ChatPanel";
import { t } from "@/lib/i18n";

const api = vi.hoisted(() => ({ evaluate: vi.fn(), evaluateDemo: vi.fn() }));
vi.mock("@/services/sokolApi", () => ({ sokolApi: api, BuildingType: { residencial: 1, comercial: 2, industrial: 3 }, DemoLimitError: class extends Error {}, QuotaError: class extends Error {} }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "es", tr: t.es }) }));
vi.mock("@/components/UpgradeModal", () => ({ UpgradeModal: () => null }));
vi.mock("@/components/assistant/WelcomeState", () => ({ WelcomeState: () => null }));
vi.mock("@/components/assistant/AssistantAvatar", () => ({ AssistantAvatar: () => null }));
vi.mock("@/components/assistant/EvaluationCard", () => ({ EvaluationCard: () => null }));
vi.mock("@/components/assistant/ProjectCard", () => ({ ProjectCard: () => null }));
vi.mock("@/components/assistant/ElectricalLoadCard", () => ({ ElectricalLoadCard: () => null }));
Object.defineProperty(HTMLElement.prototype, "scrollTo", { configurable: true, value: vi.fn() });
afterEach(() => { cleanup(); vi.resetAllMocks(); });

function Harness({ demo = false, close = vi.fn() }) {
  const [messages, setMessages] = useState<Msg[]>([]);
  const location = useLocation();
  return <>
    <ChatPanel demo={demo} usage="restaurante" buildingType={2} areaM2={350} messages={messages} setMessages={setMessages} onClose={close} pageContext={{ page: "projects" }} />
    <output data-testid="destination">{location.pathname + location.search}</output>
    <output data-testid="result">{JSON.stringify(location.state)}</output>
  </>;
}
function mount(props = {}) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(<QueryClientProvider client={client}><MemoryRouter initialEntries={["/es/projects"]}><Harness {...props} /></MemoryRouter></QueryClientProvider>);
  fireEvent.change(screen.getByPlaceholderText(t.es.askPlaceholder), { target: { value: "Evalúa mi restaurante" } });
  fireEvent.submit(screen.getByPlaceholderText(t.es.askPlaceholder).closest("form")!);
}

it("opens the evaluator with the request while preserving the answer in conversation", async () => {
  const close = vi.fn();
  api.evaluate.mockResolvedValue({ type: "evaluation", data: { matchedRules: [{ id: "rule-1", title: "NFPA 13" }], requirements: [], reference: [], contextCr: [], risk: "medio", foundryUsed: true } });
  mount({ close });
  await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent("/es/dashboard/evaluator"));
  expect(screen.getByTestId("result")).not.toHaveTextContent("assistantEvaluation");
  expect(screen.getByTestId("result")).toHaveTextContent('"area_m2":350');
  expect(screen.getByText("Evalúa mi restaurante")).toBeInTheDocument();
  expect(close).toHaveBeenCalledOnce();
});

it.each([
  [{ type: "project_created", data: { projectId: "new-project", project: { name: "Restaurante" } } }, "/es/projects/new-project"],
  [{ type: "electrical_load", data: { projectId: "saved-project", demandKva: 12 } }, "/es/projects/electrical?projectId=saved-project"],
])("opens the workspace for a completed result", async (response, path) => {
  api.evaluate.mockResolvedValue(response);
  mount();
  await waitFor(() => expect(screen.getByTestId("destination").textContent).toBe(path));
});

it("keeps clarification and conversational answers on the current page", async () => {
  const close = vi.fn();
  api.evaluate.mockResolvedValue({ type: "needs_info", data: { questions: [{ key: "floors", label: "¿Cuántos pisos tiene?", type: "number", required: true }], context: {} } });
  mount({ close });
  expect(await screen.findAllByText("¿Cuántos pisos tiene?")).not.toHaveLength(0);
  expect(screen.getByTestId("destination")).toHaveTextContent("/es/projects");
  expect(close).not.toHaveBeenCalled();
});

it("does not navigate the public demo into signed-in pages", async () => {
  const close = vi.fn();
  api.evaluateDemo.mockResolvedValue({ type: "evaluation", data: { matchedRules: [], requirements: ["Rociadores"], reference: [], contextCr: [], risk: "medio", foundryUsed: true } });
  mount({ demo: true, close });
  await waitFor(() => expect(api.evaluateDemo).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getByPlaceholderText(t.es.askPlaceholder)).not.toBeDisabled());
  expect(screen.getByTestId("destination")).toHaveTextContent("/es/projects");
  expect(close).not.toHaveBeenCalled();
});

it("keeps an electrical result without a saved project in chat", async () => {
  const close = vi.fn();
  api.evaluate.mockResolvedValue({ type: "electrical_load", data: { demandKva: 12 } });
  mount({ close });
  await waitFor(() => expect(screen.getByPlaceholderText(t.es.askPlaceholder)).not.toBeDisabled());
  expect(screen.getByTestId("destination").textContent).toBe("/es/projects");
  expect(close).not.toHaveBeenCalled();
});
