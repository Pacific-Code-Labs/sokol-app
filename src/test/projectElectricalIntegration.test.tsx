import { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import ElectricalProject from "@/pages/ElectricalProject";
import ProjectDetail from "@/pages/ProjectDetail";
import { t } from "@/lib/i18n";

const fixture = vi.hoisted(() => ({
  withoutStudy: false,
  compute: vi.fn(),
  remove: vi.fn().mockResolvedValue(undefined),
  update: vi.fn().mockResolvedValue({id:"project-one"}),
  project: {id:"project-one",name:"Fire study",projectType:"fire",building_type:1,usage:"Office",area_m2:80,requirements:["Existing fire requirement"],reference:["Existing fire reference"],contextCr:[],createdAt:"2026-10-03",updatedAt:"2026-10-03T00:00:00Z",electrical:{inputs:{occupancy:"comercial",area_m2:80,service:"single_phase"},topology:{nodes:[],edges:[]},result:{topology:{nodes:[],edges:[]},installedVa:1000,demandedVa:1000,demandKva:1,suggestedTransformerKva:5,loadTable:[],phaseBalance:[],mandatedProvisions:[],assumptions:[],references:[],disclaimer:"Preliminary"}}},
}));
vi.mock("@/hooks/useProjects", () => ({useProject:()=>({project:fixture.withoutStudy ? {...fixture.project,electrical:undefined} : fixture.project,loading:false}),useProjects:()=>({remove:fixture.remove,deleting:false})}));
vi.mock("@/contexts/LangContext", () => ({useLang:()=>({lang:"es",tr:t.es})}));
const assistant = {setPageContext:vi.fn(),setInput:vi.fn()};
vi.mock("@/contexts/AssistantContext", () => ({useAssistant:()=>assistant}));
vi.mock("@/services/sokolApi", async importOriginal => ({...await importOriginal<typeof import("@/services/sokolApi")>(),sokolApi:{updateProject:fixture.update,postElectricalPreliminary:fixture.compute}}));
vi.mock("@/components/electrical/ElectricalDiagramEditor", () => ({ElectricalDiagramEditor:({value}:{value:{topology:{nodes:{label:string}[]}}})=> {
  const [initial, setInitial] = useState(value);
  return <><p>Diagram editor {initial.topology.nodes.map(node=>node.label).join(", ")}</p><button onClick={()=>setInitial({topology:{nodes:[{label:"Local draft"}]}})}>Edit local diagram</button></>;
}}));
vi.mock("@/components/assistant/ElectricalLoadCard", () => ({ElectricalLoadCard:()=> <p>Electrical study</p>}));

it("saving an attached electrical study preserves the original project's fire metadata", async () => {
  render(<MemoryRouter initialEntries={["/es/projects/electrical?projectId=project-one"]}><ElectricalProject /></MemoryRouter>);
  fireEvent.click(await screen.findByRole("button",{name:t.es.elec_update}));
  await waitFor(()=>expect(fixture.update).toHaveBeenCalledOnce());
  expect(fixture.update.mock.calls[0][0]).toBe("project-one");
  expect(Object.keys(fixture.update.mock.calls[0][1])).toEqual(["electrical"]);
});

it("shows the fire requirements alongside the attached electrical study", () => {
  render(<MemoryRouter><ProjectDetail /></MemoryRouter>);
  expect(screen.getByText("Electrical study")).toBeInTheDocument();
  expect(screen.getByText("Existing fire requirement")).toBeInTheDocument();
  expect(screen.getByText("Existing fire reference")).toBeInTheDocument();
});


it("updates an already-open editor after the assistant's saved snapshot is fetched", async () => {
  const view = render(<MemoryRouter initialEntries={["/es/projects/electrical?projectId=project-one"]}><ElectricalProject /></MemoryRouter>);
  await screen.findByText("Diagram editor");
  const topology = {nodes:[{id:"panel",type:"panel",label:"Updated panel",data:{}}],edges:[]};
  fixture.project = {...fixture.project, electrical: JSON.parse(JSON.stringify({...fixture.project.electrical,topology,result:{...fixture.project.electrical.result,topology}}))};
  view.rerender(<MemoryRouter initialEntries={["/es/projects/electrical?projectId=project-one"]}><ElectricalProject /></MemoryRouter>);
  expect(await screen.findByText("Diagram editor Updated panel")).toBeInTheDocument();
});


it("replaces a local draft even when the saved diagram content is unchanged", async () => {
  const topology = {nodes:[{id:"panel",type:"panel",label:"Updated panel",data:{}}],edges:[]};
  fixture.project = {...fixture.project, electrical:JSON.parse(JSON.stringify({...fixture.project.electrical,topology,result:{...fixture.project.electrical.result,topology}}))};
  const view = render(<MemoryRouter initialEntries={["/es/projects/electrical?projectId=project-one"]}><ElectricalProject /></MemoryRouter>);
  await screen.findByText("Diagram editor Updated panel");
  fireEvent.click(screen.getByRole("button",{name:"Edit local diagram"}));
  expect(screen.getByText("Diagram editor Local draft")).toBeInTheDocument();
  fixture.project = {...fixture.project, updatedAt:"2026-10-03T00:01:00Z"};
  view.rerender(<MemoryRouter initialEntries={["/es/projects/electrical?projectId=project-one"]}><ElectricalProject /></MemoryRouter>);
  expect(await screen.findByText("Diagram editor Updated panel")).toBeInTheDocument();
});


it("deletes from project details and returns to the project grid after saving", async () => {
  fixture.remove.mockClear();
  fixture.remove.mockResolvedValue(undefined);
  render(<MemoryRouter initialEntries={["/es/projects/project-one"]}><Routes>
    <Route path="/es/projects/:id" element={<ProjectDetail />} />
    <Route path="/es/projects" element={<p>Project grid</p>} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", {name:t.es.delete}));
  fireEvent.click(screen.getByRole("button", {name:t.es.delete, hidden:false}));
  await screen.findByText("Project grid");
  expect(fixture.remove).toHaveBeenCalledWith("project-one");
});

it("keeps the confirmation open when deleting a project fails", async () => {
  fixture.remove.mockClear();
  fixture.remove.mockRejectedValueOnce(new Error("Save failed"));
  render(<MemoryRouter initialEntries={["/es/projects/project-one"]}><Routes>
    <Route path="/es/projects/:id" element={<ProjectDetail />} />
    <Route path="/es/projects" element={<p>Project grid</p>} />
  </Routes></MemoryRouter>);
  fireEvent.click(screen.getByRole("button", {name:t.es.delete}));
  fireEvent.click(screen.getByRole("button", {name:t.es.delete, hidden:false}));
  await waitFor(()=>expect(fixture.remove).toHaveBeenCalledWith("project-one"));
  expect(screen.getByRole("alertdialog")).toBeInTheDocument();
  expect(screen.queryByText("Project grid")).not.toBeInTheDocument();
});

it("redirects an unscoped electrical URL to projects without opening the editor", () => {
  render(<MemoryRouter initialEntries={["/es/projects/electrical"]}><Routes>
    <Route path="/es/projects/electrical" element={<ElectricalProject />} />
    <Route path="/es/projects" element={<p>Select an existing project</p>} />
  </Routes></MemoryRouter>);
  expect(screen.getByText("Select an existing project")).toBeInTheDocument();
  expect(screen.queryByText(/Diagram editor/)).not.toBeInTheDocument();
});

it("starts a study from saved building data and attaches it without creating another project", async () => {
  fixture.withoutStudy = true;
  fixture.compute.mockResolvedValue(fixture.project.electrical.result);
  fixture.update.mockClear();
  try {
    render(<MemoryRouter initialEntries={["/es/projects/electrical?projectId=project-one"]}><ElectricalProject /></MemoryRouter>);
    await waitFor(() => expect(fixture.compute).toHaveBeenCalledOnce());
    expect(fixture.compute.mock.calls[0][0].inputs).toMatchObject({ occupancy: "residencial", area_m2: 80 });
    fireEvent.click(await screen.findByRole("button", { name: t.es.elec_update }));
    await waitFor(() => expect(fixture.update).toHaveBeenCalledOnce());
    expect(fixture.update.mock.calls[0][0]).toBe("project-one");
    expect(Object.keys(fixture.update.mock.calls[0][1])).toEqual(["electrical"]);
  } finally {
    fixture.withoutStudy = false;
  }
});
