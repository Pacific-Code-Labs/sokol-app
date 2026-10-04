import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { NewProjectDrawer } from "@/components/NewProjectDrawer";
import type { Project } from "@/hooks/useProjects";
import { t } from "@/lib/i18n";

const create = vi.hoisted(() => vi.fn());
const edit = vi.hoisted(() => ({ update: vi.fn(), project: undefined as Project | undefined }));
const evaluate = vi.hoisted(() => vi.fn().mockResolvedValue({ requirements: [], reference: [], contextCr: [] }));
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ create, update: edit.update }), useProject: () => ({ project: edit.project, loading: false }) }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "es", tr: t.es }) }));
vi.mock("@/components/UpgradeModal", () => ({ UpgradeModal: () => null }));
vi.mock("@/services/sokolApi", async original => ({
  ...await original<typeof import("@/services/sokolApi")>(),
  sokolApi: { evaluate },
}));

function Harness() {
  const location = useLocation();
  return <><p>Projects remain behind the drawer</p><output>{location.pathname + location.search}</output><NewProjectDrawer /></>;
}
beforeEach(() => { create.mockReset(); evaluate.mockClear(); edit.update.mockReset(); edit.project = undefined; });

it("opens over the current screen and cancels without creating a project", async () => {
  render(<MemoryRouter initialEntries={["/es/dashboard?new=1&filter=recent"]}><Harness /></MemoryRouter>);
  expect(screen.getByRole("dialog", { name: t.es.new_project })).toBeInTheDocument();
  expect(screen.getByText("Projects remain behind the drawer")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: t.es.cancel }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByText("/es/dashboard?filter=recent")).toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
});

it("asks for a project name and saves the selected evaluation without evaluating again", async () => {
  create.mockResolvedValue({ id: "from-evaluation" });
  const projectDraft = { request: { user_query: "Evaluate", building_type: 3, usage: "Warehouse", area_m2: 1200, floors: 2 },
    evaluation: { matchedRules: [], requirements: ["Saved requirement"], reference: ["NFPA 13"], contextCr: [], risk: "alto", foundryUsed: true } };
  render(<MemoryRouter initialEntries={[{ pathname: "/es/projects", search: "?new=1", state: { projectDraft } }]}><Harness /></MemoryRouter>);
  expect(screen.getByLabelText(`${t.es.project_name} *`)).toHaveValue("");
  expect(screen.getByLabelText(`${t.es.usage_label} *`)).toHaveValue("Warehouse");
  expect(screen.getByLabelText(`${t.es.area} *`)).toHaveValue(1200);
  fireEvent.change(screen.getByLabelText(`${t.es.project_name} *`), { target: { value: "Warehouse North" } });
  fireEvent.click(screen.getByRole("button", { name: t.es.create_project_btn }));
  await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({ name: "Warehouse North", area_m2: 1200, floors: 2, requirements: ["Saved requirement"], reference: ["NFPA 13"], risk: "high" })));
  expect(evaluate).not.toHaveBeenCalled();
});

it("leaves unknown required values blank and blocks saving until they are supplied", () => {
  const projectDraft = { request: { user_query: "Evaluate" }, evaluation: { matchedRules: [], requirements: [], reference: [], contextCr: [], risk: "medio", foundryUsed: true } };
  render(<MemoryRouter initialEntries={[{ pathname: "/es/projects", search: "?new=1", state: { projectDraft } }]}><Harness /></MemoryRouter>);
  expect(screen.getByLabelText(`${t.es.area} *`)).toHaveValue(null);
  expect(screen.getByLabelText(`${t.es.usage_label} *`)).toHaveValue("");
  expect(screen.getByRole("combobox")).toHaveTextContent(t.es.selectBuilding);
  fireEvent.submit(screen.getByLabelText(`${t.es.project_name} *`).closest("form")!);
  expect(screen.getByText(t.es.project_missing_details)).toBeInTheDocument();
  expect(create).not.toHaveBeenCalled();
});

it("saves from the drawer and opens the created project", async () => {
  create.mockResolvedValue({ id: "created-project" });
  render(<MemoryRouter initialEntries={["/es/projects?new=1"]}><Harness /></MemoryRouter>);
  fireEvent.change(screen.getByLabelText(`${t.es.project_name} *`), { target: { value: "Office" } });
  fireEvent.change(screen.getByLabelText(`${t.es.usage_label} *`), { target: { value: "Offices" } });
  fireEvent.click(screen.getByRole("button", { name: t.es.create_project_btn }));
  await waitFor(() => expect(create).toHaveBeenCalledOnce());
  await waitFor(() => expect(screen.getByText("/es/projects/created-project")).toBeInTheDocument());
  expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
});

it("focuses the drawer and supports Escape dismissal", async () => {
  render(<MemoryRouter initialEntries={["/es/projects?new=1"]}><Harness /></MemoryRouter>);
  const dialog = screen.getByRole("dialog");
  await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
  fireEvent.keyDown(document, { key: "Escape" });
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(create).not.toHaveBeenCalled();
});

it("edits and clears persisted notes while preserving saved evaluation and study fields", async () => {
  edit.project = { id: "saved", name: "Office", notes: "Original notes", usage: "Office", building_type: 2, area_m2: 200, createdAt: "2026-10-04" };
  edit.update.mockResolvedValue(edit.project);
  render(<MemoryRouter initialEntries={["/es/projects/saved?edit=1"]}><Harness /></MemoryRouter>);
  expect(screen.getByRole("dialog", { name: t.es.project_edit })).toBeInTheDocument();
  expect(screen.getByLabelText(t.es.project_notes)).toHaveValue("Original notes");
  fireEvent.change(screen.getByLabelText(t.es.project_notes), { target: { value: "" } });
  fireEvent.click(screen.getByRole("button", { name: t.es.project_save_changes }));
  await waitFor(() => expect(edit.update).toHaveBeenCalledWith("saved", expect.objectContaining({ notes: "", name: "Office" })));
  expect(edit.update.mock.calls[0][1]).not.toHaveProperty("electrical");
  expect(evaluate).not.toHaveBeenCalled();
});
