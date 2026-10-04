import { FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { useLang } from "@/contexts/LangContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@pacific-code-labs/sokol-design-system";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { sokolApi, BuildingType, QuotaError } from "@/services/sokolApi";
import type { RiskLevel, Project } from "@/hooks/useProjects";
import { Loader2 } from "lucide-react";
import { Alert, AlertDescription } from "@pacific-code-labs/sokol-design-system";
import { UpgradeModal } from "@/components/UpgradeModal";
import { localizedPath } from "@/lib/paths";
import type { EvaluationProjectDraft } from "@/lib/assistantNavigation";

function normalizeRisk(raw?: string): RiskLevel | undefined {
  if (!raw) return undefined;
  const r = raw.toLowerCase();
  if (r.includes("alto") || r.includes("high")) return "high";
  if (r.includes("medio") || r.includes("medium")) return "medium";
  if (r.includes("bajo") || r.includes("low")) return "low";
  return undefined;
}

export default function NewProjectForm({ onClose, draft, project }: { onClose: () => void; draft?: EvaluationProjectDraft; project?: Project }) {
  const navigate = useNavigate();
  const { create, update } = useProjects();
  const { lang, tr } = useLang();

  const initial = project ?? draft?.request;
  const [name, setName] = useState(project?.name ?? "");
  const [notes, setNotes] = useState(project?.notes ?? "");
  const [buildingType, setBuildingType] = useState<BuildingType | undefined>(initial ? initial.building_type : BuildingType.comercial);
  const [usage, setUsage] = useState(initial?.usage ?? "");
  const [area, setArea] = useState<number | "">(initial ? initial.area_m2 ?? "" : 100);
  const [floors, setFloors] = useState<number | "">(initial?.floors ?? "");
  const [occupants, setOccupants] = useState<number | "">(initial?.occupants ?? "");
  const [ceiling, setCeiling] = useState<number | "">(initial?.ceiling_height_m ?? "");
  const [volume, setVolume] = useState<number | "">(initial?.volume_m3 ?? "");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [quota, setQuota] = useState<QuotaError | null>(null);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !buildingType || !usage.trim() || area === "" || area <= 0) {
      setError(tr.project_missing_details);
      return;
    }
    setError(null);
    setSubmitting(true);
    try {
      if (project) {
        await update(project.id, { name: name.trim(), notes: notes.trim(), building_type: buildingType,
          usage: usage.trim(), area_m2: area, floors: floors === "" ? undefined : floors,
          occupants: occupants === "" ? undefined : occupants, ceiling_height_m: ceiling === "" ? undefined : ceiling,
          volume_m3: volume === "" ? undefined : volume });
        onClose();
        return;
      }
      let evalResult: Awaited<ReturnType<typeof sokolApi.evaluate>> | null = draft?.evaluation ?? null;
      if (!evalResult) try {
        evalResult = await sokolApi.evaluate({
          building_type: buildingType,
          usage,
          user_query: `Save evaluation for project: ${name}`,
          area_m2: area,
          floors: floors === "" ? undefined : Number(floors),
          occupants: occupants === "" ? undefined : Number(occupants),
          ceiling_height_m: ceiling === "" ? undefined : Number(ceiling),
          volume_m3: volume === "" ? undefined : Number(volume),
        });
      } catch (evalErr) {
        // The evaluate quota (429) blocks the project too — surface the upgrade
        // CTA instead of silently saving an un-evaluated project.
        if (evalErr instanceof QuotaError) {
          setQuota(evalErr);
          return;
        }
        // Otherwise the backend evaluation is optional; project still saves.
      }

      const created = await create({
        name: name.trim(),
        notes: notes.trim(),
        building_type: buildingType,
        usage: usage.trim(),
        area_m2: area,
        floors: floors === "" ? undefined : Number(floors),
        occupants: occupants === "" ? undefined : Number(occupants),
        ceiling_height_m: ceiling === "" ? undefined : Number(ceiling),
        volume_m3: volume === "" ? undefined : Number(volume),
        risk: normalizeRisk(evalResult?.risk),
        requirements: evalResult?.requirements,
        reference: evalResult?.reference,
        // FCR-043: projects persist plain strings; flatten structured items.
        contextCr: (evalResult?.contextCr ?? []).map((c) =>
          typeof c === "string"
            ? c
            : [c.topic ? `${c.topic}: ${c.detail}` : c.detail, [c.authority, c.reference].filter(Boolean).join(" · ")]
                .filter(Boolean)
                .join(" ")
        ),
      });

      navigate(localizedPath(lang, `/projects/${created.id}`), { replace: true });
    } catch (e) {
      // FCR-026: saved-projects limit (402) → open the upgrade CTA.
      if (e instanceof QuotaError) {
        setQuota(e);
      } else {
        setError(e instanceof Error ? e.message : tr.failed_create);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      <div className="max-w-2xl space-y-4">
        <form onSubmit={onSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="name">{tr.project_name} *</Label>
            <Input id="name" required value={name} onChange={(e) => setName(e.target.value)} />
          </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="project-building-type">{tr.building_type} *</Label>
                  <Select value={buildingType ? String(buildingType) : ""} onValueChange={(v) => setBuildingType(Number(v) as BuildingType)}>
                    <SelectTrigger id="project-building-type"><SelectValue placeholder={tr.selectBuilding} /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value={String(BuildingType.residencial)}>{tr.bt_residential}</SelectItem>
                      <SelectItem value={String(BuildingType.comercial)}>{tr.bt_commercial}</SelectItem>
                      <SelectItem value={String(BuildingType.industrial)}>{tr.bt_industrial}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="usage">{tr.usage_label} *</Label>
                  <Input id="usage" required value={usage} onChange={(e) => setUsage(e.target.value)} />
                </div>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="area">{tr.area} *</Label>
                  <Input id="area" type="number" min={1} required value={area} onChange={(e) => setArea(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="floors">{tr.floors}</Label>
                  <Input id="floors" type="number" min={0} value={floors} onChange={(e) => setFloors(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="occupants">{tr.occupants}</Label>
                  <Input id="occupants" type="number" min={0} value={occupants} onChange={(e) => setOccupants(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ceiling">{tr.ceilingHeight}</Label>
                  <Input id="ceiling" type="number" step="0.1" min={0} value={ceiling} onChange={(e) => setCeiling(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="volume">{tr.volume}</Label>
                  <Input id="volume" type="number" min={0} value={volume} onChange={(e) => setVolume(e.target.value === "" ? "" : Number(e.target.value))} />
                </div>
              </div>

              {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}

              <div className="space-y-2">
                <Label htmlFor="project-notes">{tr.project_notes}</Label>
                <Textarea id="project-notes" value={notes} onChange={event => setNotes(event.target.value)} maxLength={10000} rows={4} placeholder={tr.project_notes_hint} />
              </div>

              <div className="flex justify-end gap-2">
                <Button type="button" variant="outline" onClick={onClose}>{tr.cancel}</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  {project ? tr.project_save_changes : tr.create_project_btn}
                </Button>
              </div>
            </form>
      </div>
      <UpgradeModal quota={quota} onClose={() => setQuota(null)} />
    </>
  );
}
