import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, useLocation } from "react-router-dom";
import { NewProjectDrawer } from "@/components/NewProjectDrawer";
import { t } from "@/lib/i18n";

const create = vi.hoisted(() => vi.fn());
vi.mock("@/hooks/useProjects", () => ({ useProjects: () => ({ create }) }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "es", tr: t.es }) }));
vi.mock("@/components/UpgradeModal", () => ({ UpgradeModal: () => null }));
vi.mock("@/services/sokolApi", async original => ({
  ...await original<typeof import("@/services/sokolApi")>(),
  sokolApi: { evaluate: vi.fn().mockResolvedValue({ requirements: [], reference: [], contextCr: [] }) },
}));

function Harness() {
  const location = useLocation();
  return <><p>Projects remain behind the drawer</p><output>{location.pathname + location.search}</output><NewProjectDrawer /></>;
}
beforeEach(() => create.mockReset());

it("opens over the current screen and cancels without creating a project", async () => {
  render(<MemoryRouter initialEntries={["/es/dashboard?new=1&filter=recent"]}><Harness /></MemoryRouter>);
  expect(screen.getByRole("dialog", { name: t.es.new_project })).toBeInTheDocument();
  expect(screen.getByText("Projects remain behind the drawer")).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: t.es.cancel }));
  await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  expect(screen.getByText("/es/dashboard?filter=recent")).toBeInTheDocument();
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
