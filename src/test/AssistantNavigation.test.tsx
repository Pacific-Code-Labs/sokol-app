import { useState } from "react";
import { fireEvent, render, screen, waitFor, cleanup } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter, useLocation } from "react-router-dom";
import { ChatPanel, type Msg } from "@/components/ChatPanel";
import { t } from "@/lib/i18n";
import { getDemoScenarios } from "@/lib/demoScenarios";

const api = vi.hoisted(() => ({ evaluate: vi.fn(), evaluateDemo: vi.fn() }));
vi.mock("@/services/sokolApi", () => ({ sokolApi: api, BuildingType: { residencial: 1, comercial: 2, industrial: 3 }, DemoLimitError: class extends Error {}, QuotaError: class extends Error {} }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "es", tr: t.es }) }));
vi.mock("@/components/UpgradeModal", () => ({ UpgradeModal: () => null }));
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

it("offers the evaluator without automatic navigation, preserving filters and the conversation", async () => {
  const close = vi.fn();
  api.evaluate.mockResolvedValue({ type: "evaluation", data: { matchedRules: [{ id: "rule-1", title: "NFPA 13" }], requirements: [], reference: [], contextCr: [], risk: "medio", foundryUsed: true } });
  mount({ close });
  const open = await screen.findByRole("button", { name: t.es.assistant_open_evaluator });
  expect(screen.getByTestId("destination").textContent).toBe("/es/projects");
  expect(close).not.toHaveBeenCalled();
  expect(screen.getByRole("button", { name: t.es.assistant_create_from_evaluation })).toBeInTheDocument();
  fireEvent.click(open);
  await waitFor(() => expect(screen.getByTestId("destination")).toHaveTextContent("/es/dashboard/evaluator"));
  expect(screen.getByTestId("result")).not.toHaveTextContent("assistantEvaluation");
  expect(screen.getByTestId("result")).toHaveTextContent('"area_m2":350');
  expect(screen.getByText("Evalúa mi restaurante")).toBeInTheDocument();
  expect(close).toHaveBeenCalledOnce();
});

it("offers project creation with the chosen evaluation and its known building details", async () => {
  api.evaluate.mockResolvedValue({ type: "evaluation", data: { matchedRules: [], requirements: ["Sprinklers"], reference: ["NFPA 13"], contextCr: [], risk: "alto", foundryUsed: true } });
  const close = vi.fn();
  mount({ close });
  fireEvent.click(await screen.findByRole("button", { name: t.es.assistant_create_from_evaluation }));
  expect(screen.getByTestId("destination").textContent).toBe("/es/projects?new=1");
  expect(screen.getByTestId("result")).toHaveTextContent('"projectDraft"');
  expect(screen.getByTestId("result")).toHaveTextContent('"area_m2":350');
  expect(screen.getByTestId("result")).toHaveTextContent("Sprinklers");
  expect(close).toHaveBeenCalledOnce();
});

it.each([
  [{ type: "project_created", data: { projectId: "new-project", project: { name: "Restaurante" } } }, "/es/projects/new-project", "assistant_open_project"],
  [{ type: "electrical_load", data: { projectId: "saved-project", demandKva: 12 } }, "/es/projects/electrical?projectId=saved-project", "assistant_open_electrical"],
])("offers the workspace for a saved result and opens it only on click", async (response, path, label) => {
  api.evaluate.mockResolvedValue(response);
  const close = vi.fn();
  mount({ close });
  const open = await screen.findByRole("button", { name: t.es[label] });
  expect(screen.getByTestId("destination").textContent).toBe("/es/projects");
  expect(close).not.toHaveBeenCalled();
  fireEvent.click(open);
  await waitFor(() => expect(screen.getByTestId("destination").textContent).toBe(path));
  expect(close).toHaveBeenCalledOnce();
  expect(screen.getByTestId("result")).not.toHaveTextContent("assistantElectrical");
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
  expect(screen.queryByRole("button", { name: t.es.assistant_open_evaluator })).not.toBeInTheDocument();
});

it("keeps an electrical result without a saved project in chat", async () => {
  const close = vi.fn();
  api.evaluate.mockResolvedValue({ type: "electrical_load", data: { demandKva: 12 } });
  mount({ close });
  await waitFor(() => expect(screen.getByPlaceholderText(t.es.askPlaceholder)).not.toBeDisabled());
  expect(screen.getByTestId("destination").textContent).toBe("/es/projects");
  expect(close).not.toHaveBeenCalled();
});

it("does not offer a saved-project action for an unsaved preview", async () => {
  api.evaluate.mockResolvedValue({ type: "project_created", data: { projectId: null, project: { name: "Preview" } } });
  mount();
  await waitFor(() => expect(screen.getByPlaceholderText(t.es.askPlaceholder)).not.toBeDisabled());
  expect(screen.queryByRole("button", { name: t.es.assistant_open_project })).not.toBeInTheDocument();
  expect(screen.getByTestId("destination").textContent).toBe("/es/projects");
});

it("keeps each evaluation button tied to its own request after later responses", async () => {
  api.evaluate.mockResolvedValue({ type: "evaluation", data: { matchedRules: [], requirements: [], reference: [], contextCr: [], risk: "medio", foundryUsed: true } });
  mount();
  await screen.findByRole("button", { name: t.es.assistant_open_evaluator });
  await waitFor(() => expect(screen.getByPlaceholderText(t.es.askPlaceholder)).not.toBeDisabled());
  fireEvent.change(screen.getByPlaceholderText(t.es.askPlaceholder), { target: { value: "Evalúa una vivienda de 120 m²" } });
  fireEvent.submit(screen.getByPlaceholderText(t.es.askPlaceholder).closest("form")!);
  await waitFor(() => expect(screen.getAllByRole("button", { name: t.es.assistant_open_evaluator })).toHaveLength(2));
  fireEvent.click(screen.getAllByRole("button", { name: t.es.assistant_open_evaluator })[0]);
  expect(screen.getByTestId("result")).toHaveTextContent('"area_m2":350');
  fireEvent.click(screen.getAllByRole("button", { name: t.es.assistant_open_evaluator })[1]);
  expect(screen.getByTestId("result")).toHaveTextContent('"area_m2":120');
});


it.each([false, true])("shows examples only in the demo and keeps a multiline composer (demo=%s)", demo => {
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><Harness demo={demo} /></MemoryRouter></QueryClientProvider>);
  const prompt = screen.getByRole("textbox", { name: t.es.askPlaceholder });
  expect(prompt.tagName).toBe("TEXTAREA");
  expect(prompt).toHaveAttribute("rows", "4");
  for (const scenario of getDemoScenarios(t.es)) {
    if (demo) expect(screen.getByRole("button", { name: scenario.label })).toBeInTheDocument();
    else expect(screen.queryByRole("button", { name: scenario.label })).not.toBeInTheDocument();
  }
  expect(screen.getByRole("button", { name: t.es.send })).toBeDisabled();
  fireEvent.change(prompt, { target: { value: "Evalúa mi restaurante\nÁrea: 350 m²\nDos pisos" } });
  expect(prompt).toHaveValue("Evalúa mi restaurante\nÁrea: 350 m²\nDos pisos");
  expect(screen.getByRole("button", { name: t.es.send })).toBeEnabled();
  expect(api.evaluate).not.toHaveBeenCalled();
});
