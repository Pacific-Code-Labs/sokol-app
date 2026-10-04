import { Select } from "@pacific-code-labs/sokol-design-system";
/**
 * ElectricalProject — signed-in preliminary electrical-load workspace (FCR-102/105).
 *
 * Structured inputs (occupancy / area / service / special loads) drive the
 * BACKEND-authoritative deterministic calc; the interactive single-line diagram
 * (ElectricalDiagramEditor) is the live, draggable, exportable visual where the
 * engineer can ADD supplemental custom loads (fed to the calc as
 * special_loads.other — additive, no double-count). Results (panel schedule,
 * kVA, transformer, phase balance, mandated provisions) render live and the
 * study can be saved as an `electrical` project.
 */
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation, Link, useSearchParams } from "react-router-dom";
import { toast } from "sonner";
import { ArrowLeft, Loader2, Save, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAssistant } from "@/contexts/AssistantContext";
import { useLang } from "@/contexts/LangContext";
import { useProject } from "@/hooks/useProjects";
import {
  sokolApi,
  type ElectricalInputs,
  type ElectricalLoadData,
  type Topology,
  type ProjectBuildingType,
} from "@/services/sokolApi";
import { ElectricalDiagramEditor } from "@/components/electrical/ElectricalDiagramEditor";
import { ElectricalLoadCard } from "@/components/assistant/ElectricalLoadCard";
import { localizedPath } from "@/lib/paths";

const EMPTY_TOPOLOGY: Topology = { nodes: [], edges: [] };

const OCCUPANCIES = ["residencial", "social_interest", "comercial", "industrial"] as const;
const SERVICES = ["single_phase", "network_3h", "three_phase"] as const;

/** Map the electrical occupancy onto the persisted project building_type. */
function toBuildingType(occupancy: string): ProjectBuildingType {
  if (occupancy === "comercial") return "comercial";
  if (occupancy === "industrial") return "industrial";
  return "residencial"; // residencial + social_interest
}

export default function ElectricalProject() {
  const { lang, tr } = useLang();
  const navigate = useNavigate();
  const location = useLocation();
  const incoming = location.state as { assistantElectrical?: ElectricalLoadData; assistantRequest?: { area_m2?: number; floors?: number } } | null;
  const { setPageContext, setInput } = useAssistant();
  // FCR-118: edit round-trip — `?projectId=<id>` loads a saved study to edit in
  // place (PUT) instead of creating a new project on save.
  const [searchParams] = useSearchParams();
  const editId = searchParams.get("projectId") ?? undefined;
  const { project: editProject } = useProject(editId ?? "");
  const sourceSnapshotKey = editProject ? JSON.stringify({ id: editId, updatedAt: editProject.updatedAt, electrical: editProject.electrical ?? null }) : null;
  const [editorRevision, setEditorRevision] = useState(0);

  const [inputs, setInputs] = useState<ElectricalInputs>({
    occupancy: "residencial",
    area_m2: 120,
    service: "single_phase",
    growth_allowance: 0,
    special_loads: {},
    language: lang,
  });
  const [seed, setSeed] = useState<ElectricalLoadData | null>(null);
  const [result, setResult] = useState<ElectricalLoadData | null>(null);
  const [snapshotTopology, setSnapshotTopology] = useState<Topology>(EMPTY_TOPOLOGY);
  const [name, setName] = useState("");
  const [saving, setSaving] = useState(false);

  // One initial compute to seed the editor's topology before it mounts. In edit
  // mode (?projectId) the seed comes from the saved snapshot instead (below).
  useEffect(() => {
    if (editId || incoming?.assistantElectrical) return;
    let alive = true;
    sokolApi
      .postElectricalPreliminary({ inputs })
      .then((r) => {
        if (!alive) return;
        setSeed(r);
        setResult(r);
        setSnapshotTopology(r.topology);
      })
      .catch(() => alive && setSeed({ topology: EMPTY_TOPOLOGY } as ElectricalLoadData));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // FCR-118: edit mode — once the project resolves, seed inputs + topology +
  // result from its saved electrical snapshot (or fall back to a fresh compute
  // if the id has no study, e.g. a stray link).
  useEffect(() => {
    if (!editId || editProject === undefined) return;
    // Query invalidation after an assistant save supplies a new snapshot.
    // Only backend snapshot changes reset the editor; local edits and language
    // changes keep the current graph and form state.
    let alive = true;
    const snap = editProject?.electrical;
    if (snap?.result) {
      setInputs({ ...snap.inputs, language: lang });
      setName(editProject.name ?? "");
      const topology = snap.topology?.nodes.length ? snap.topology : snap.result.topology;
      setSeed({ ...snap.result, topology });
      setResult(snap.result);
      setSnapshotTopology(topology);
      setEditorRevision(revision => revision + 1);
    } else {
      sokolApi
        .postElectricalPreliminary({ inputs })
        .then((r) => {
          if (!alive) return;
          setSeed(r);
          setResult(r);
          setSnapshotTopology(r.topology);
        })
        .catch(() => { if (alive) setSeed({ topology: EMPTY_TOPOLOGY } as ElectricalLoadData); });
    }
    return () => { alive = false; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, sourceSnapshotKey]);

  useEffect(() => {
    setPageContext(editProject ? { page: "project_detail", payload: { project: editProject } } : { page: "other" });
    setInput(incoming?.assistantElectrical && !editId ? { areaM2: incoming.assistantRequest?.area_m2, floors: incoming.assistantRequest?.floors } : { areaM2: inputs.area_m2, floors: inputs.floors });
  }, [editProject, inputs.area_m2, inputs.floors, location.state, editId, setPageContext, setInput]);

  const editorValue = useMemo(
    () => ({ inputs, topology: seed?.topology ?? EMPTY_TOPOLOGY }),
    [inputs, seed],
  );

  const patch = (p: Partial<ElectricalInputs>) => setInputs((i) => ({ ...i, ...p }));
  const patchSpecial = (p: Partial<NonNullable<ElectricalInputs["special_loads"]>>) =>
    setInputs((i) => ({ ...i, special_loads: { ...(i.special_loads ?? {}), ...p } }));

  const num = (v: string): number | undefined => (v === "" ? undefined : Number(v));

  const save = async () => {
    if (!result) return;
    setSaving(true);
    try {
      const projectName = name.trim() || tr.elec_default_name;
      const body = {
        name: projectName,
        project_type: "electrical",
        building_type: toBuildingType(inputs.occupancy),
        usage: tr.elec_project_usage,
        area_m2: inputs.area_m2,
        floors: inputs.floors,
        requirements: result.mandatedProvisions.map((p) => `${p.code}: ${p.requirement}`),
        reference: result.references,
        context_cr: [],
        risk: `${result.demandKva} kVA · ${result.suggestedTransformerKva} kVA ${tr.elec_transformer_short}`,
        electrical: { inputs, topology: snapshotTopology, result },
      };
      // FCR-118: edit in place when we loaded an existing study, else create.
      const saved = editId
        ? await sokolApi.updateProject(editId, editProject?.projectType === "electrical" ? body : { electrical: body.electrical })
        : await sokolApi.createProject(body);
      toast.success(tr.elec_saved);
      navigate(localizedPath(lang, `/projects/${saved.id}`));
    } catch {
      toast.error(tr.elec_save_error);
    } finally {
      setSaving(false);
    }
  };

  if (incoming?.assistantElectrical && !editId) return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold">{tr.tour_diagram_title}</h2>
      <ElectricalLoadCard data={incoming.assistantElectrical} />
      <Button variant="outline" onClick={() => navigate(localizedPath(lang, "/projects/electrical"), { state: null })}>{tr.assistant_edit_electrical}</Button>
    </section>
  );

  return (
    <>
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2">
          <Link to={localizedPath(lang, "/projects")}><ArrowLeft className="h-4 w-4" /> {tr.back_to_projects}</Link>
        </Button>
        <div className="flex items-center gap-2">
          <Zap className="h-5 w-5 text-primary" />
          <h1 className="text-lg font-semibold">{tr.elec_project_title}</h1>
        </div>
        <p className="max-w-2xl text-sm text-muted-foreground">{tr.elec_project_subtitle}</p>

        {/* Structured inputs — the deterministic calc drivers */}
        <div className="grid gap-3 rounded-lg border border-border bg-card p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          <Field label={tr.elec_occupancy}>
            <Select
              value={inputs.occupancy}
              onChange={(e) => patch({ occupancy: e.target.value as ElectricalInputs["occupancy"] })}
              className="h-9 w-full rounded-md border border-input bg-background pl-2 pr-10 text-sm"
            >
              {OCCUPANCIES.map((o) => (
                <option key={o} value={o}>
                  {tr[`elec_occ_${o}` as keyof typeof tr] as string}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`${tr.elec_area} (m²)`}>
            <Input
              type="number"
              value={inputs.area_m2 ?? ""}
              onChange={(e) => patch({ area_m2: Number(e.target.value) || 0 })}
              className="h-9"
            />
          </Field>
          <Field label={tr.elec_service_type}>
            <Select
              value={inputs.service}
              onChange={(e) => patch({ service: e.target.value as ElectricalInputs["service"] })}
              className="h-9 w-full rounded-md border border-input bg-background pl-2 pr-10 text-sm"
            >
              {SERVICES.map((s) => (
                <option key={s} value={s}>
                  {tr[`elec_svc_${s}` as keyof typeof tr] as string}
                </option>
              ))}
            </Select>
          </Field>
          <Field label={`${tr.elec_growth} (%)`}>
            <Input
              type="number"
              value={inputs.growth_allowance != null ? Math.round(inputs.growth_allowance * 100) : ""}
              onChange={(e) => patch({ growth_allowance: (Number(e.target.value) || 0) / 100 })}
              className="h-9"
            />
          </Field>
          <Field label={`${tr.elec_range} (VA)`}>
            <Input
              type="number"
              value={inputs.special_loads?.range_va ?? ""}
              onChange={(e) => patchSpecial({ range_va: num(e.target.value) })}
              className="h-9"
            />
          </Field>
          <Field label={`${tr.elec_water_heater} (VA)`}>
            <Input
              type="number"
              value={inputs.special_loads?.water_heater_va ?? ""}
              onChange={(e) => patchSpecial({ water_heater_va: num(e.target.value) })}
              className="h-9"
            />
          </Field>
          <Field label={`${tr.elec_ac} (VA)`}>
            <Input
              type="number"
              value={inputs.special_loads?.ac_va ?? ""}
              onChange={(e) => patchSpecial({ ac_va: num(e.target.value) })}
              className="h-9"
            />
          </Field>
        </div>

        {/* Interactive single-line diagram */}
        <div className="rounded-lg border border-border bg-card p-3">
          <div className="mb-2 text-sm font-semibold">{tr.elec_single_line}</div>
          {seed ? (
            <ElectricalDiagramEditor
              key={`${editId ?? "new"}:${editorRevision}`}
              value={editorValue}
              onChange={({ topology, inputs: updatedInputs, result: r }) => {
                setInputs(updatedInputs);
                if (r) setResult(r);
                setSnapshotTopology(topology);
              }}
            />
          ) : (
            <div className="flex h-40 items-center justify-center text-sm text-muted-foreground">
              <Loader2 className="mr-2 h-4 w-4 animate-spin" /> {tr.elec_recalculating}
            </div>
          )}
        </div>

        {/* Live results (panel schedule + kVA + provisions); diagram suppressed here. */}
        {result && (
          <div className="rounded-lg border border-border bg-card p-3">
            <ElectricalLoadCard data={{ ...result, topology: EMPTY_TOPOLOGY }} />
          </div>
        )}

        {/* Save */}
        <div className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-card p-3">
          <Field label={tr.elec_project_name}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={tr.elec_default_name}
              className="h-9 w-64"
            />
          </Field>
          <Button onClick={save} disabled={saving || !result}>
            {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
            {editId ? tr.elec_update : tr.elec_save}
          </Button>
        </div>
      </div>
    </>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1 text-xs text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  );
}
