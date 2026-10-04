import { useEffect } from "react";
import { Link, useParams } from "react-router-dom";
import { useProject } from "@/hooks/useProjects";
import { useLang } from "@/contexts/LangContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/RiskBadge";
import { ArrowLeft, FileDown, ListChecks, BookOpen, MapPin, Zap, Pencil } from "lucide-react";
import { BuildingType } from "@/services/sokolApi";
import { ElectricalLoadCard } from "@/components/assistant/ElectricalLoadCard";
import { localizedPath } from "@/lib/paths";

function InfoRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="flex justify-between gap-4 py-2 border-b border-border last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <span className="text-sm font-medium text-right">{value ?? "—"}</span>
    </div>
  );
}

function ListBlock({ title, icon: Icon, items, emptyText }: { title: string; icon: typeof ListChecks; items?: string[]; emptyText: string }) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-sm flex items-center gap-2">
          <Icon className="h-4 w-4 text-primary" />
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {!items || items.length === 0 ? (
          <p className="text-sm text-muted-foreground">{emptyText}</p>
        ) : (
          <ul className="space-y-2">
            {items.map((it, i) => (
              <li key={i} className="text-sm flex gap-2">
                <span className="text-primary mt-0.5">•</span>
                <span>{it}</span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

export default function ProjectDetail() {
  const { id = "" } = useParams();
  const { project, loading } = useProject(id);
  const { lang, tr } = useLang();
  const { setPageContext, setInput } = useAssistant();

  const buildingLabel: Record<number, string> = {
    [BuildingType.residencial]: tr.bt_residential,
    [BuildingType.comercial]: tr.bt_commercial,
    [BuildingType.industrial]: tr.bt_industrial,
  };

  useEffect(() => {
    if (project) {
      setPageContext({ page: "project_detail", payload: { project } });
      setInput({
        buildingType: project.building_type,
        usage: project.usage,
        areaM2: project.area_m2 || undefined,
        floors: project.floors,
        occupants: project.occupants,
        ceilingHeight: project.ceiling_height_m,
        volume: project.volume_m3,
      });
    } else {
      setPageContext({ page: "project_detail", payload: { id } });
    }
  }, [id, project]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <div className="space-y-4">
        <Button asChild variant="ghost" size="sm" className="gap-1 -ml-2">
          <Link to={localizedPath(lang, "/projects")}><ArrowLeft className="h-4 w-4" /> {tr.back_to_projects}</Link>
        </Button>

        {loading ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-sm text-muted-foreground">{tr.loading}</p>
            </CardContent>
          </Card>
        ) : !project ? (
          <Card>
            <CardContent className="py-16 text-center">
              <p className="text-sm text-muted-foreground mb-4">{tr.project_not_found}</p>
              <Button asChild variant="outline"><Link to={localizedPath(lang, "/projects")}>{tr.back_to_projects}</Link></Button>
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex items-center gap-3 flex-wrap">
                  <h2 className="text-2xl font-bold tracking-tight">{project.name}</h2>
                  <RiskBadge level={project.risk} />
                </div>
                <p className="text-sm text-muted-foreground mt-1">
                  {tr.created} {new Date(project.createdAt).toLocaleString()}
                </p>
              </div>
              <Button variant="outline" disabled className="gap-2">
                <FileDown className="h-4 w-4" />
                {tr.export_pdf}
              </Button>
            </div>

            <div className="grid lg:grid-cols-3 gap-4">
              <Card className="lg:col-span-1">
                <CardHeader>
                  <CardTitle className="text-base">{tr.project_info}</CardTitle>
                  <CardDescription>{tr.building_characteristics}</CardDescription>
                </CardHeader>
                <CardContent>
                  <InfoRow label={tr.building_type} value={buildingLabel[project.building_type]} />
                  <InfoRow label={tr.usage_label} value={project.usage} />
                  <InfoRow label={tr.area} value={`${project.area_m2} m²`} />
                  <InfoRow label={tr.floors} value={project.floors} />
                  <InfoRow label={tr.occupants} value={project.occupants} />
                  <InfoRow label={tr.ceilingHeight} value={project.ceiling_height_m ? `${project.ceiling_height_m} m` : undefined} />
                  <InfoRow label={tr.volume} value={project.volume_m3 ? `${project.volume_m3} m³` : undefined} />
                </CardContent>
              </Card>

              <div className="lg:col-span-2 grid gap-4">
                {project.electrical?.result ? (
                  /* FCR-118: an electrical study is mapped INSIDE its project — render
                     the full study snapshot here, with a link back into the editor. */
                  <Card>
                    <CardHeader className="flex flex-row items-start justify-between gap-3 pb-3">
                      <div>
                        <CardTitle className="text-sm flex items-center gap-2">
                          <Zap className="h-4 w-4 text-primary" /> {tr.elec_title}
                        </CardTitle>
                        <CardDescription>{tr.elec_project_subtitle}</CardDescription>
                      </div>
                      <Button asChild variant="outline" size="sm" className="gap-1.5 shrink-0">
                        <Link to={localizedPath(lang, "/projects/electrical") + `?projectId=${project.id}`}>
                          <Pencil className="h-3.5 w-3.5" /> {tr.elec_edit_study}
                        </Link>
                      </Button>
                    </CardHeader>
                    <CardContent>
                      <ElectricalLoadCard data={project.electrical.result} />
                    </CardContent>
                  </Card>
                ) : null}
                {(!project.electrical?.result || project.projectType !== "electrical") && (
                  <>
                    <ListBlock title={tr.requirements} icon={ListChecks} items={project.requirements} emptyText={tr.no_data} />
                    <div className="grid sm:grid-cols-2 gap-4">
                      <ListBlock title={tr.references} icon={BookOpen} items={project.reference} emptyText={tr.no_data} />
                      <ListBlock title={tr.cr_context} icon={MapPin} items={project.contextCr} emptyText={tr.no_data} />
                    </div>

                    <Card>
                      <CardHeader className="pb-3">
                        <CardTitle className="text-sm">{tr.checklist}</CardTitle>
                        <CardDescription>{tr.coming_soon}</CardDescription>
                      </CardHeader>
                      <CardContent>
                        <p className="text-sm text-muted-foreground">
                          {tr.checklist_soon}
                        </p>
                      </CardContent>
                    </Card>
                  </>
                )}
              </div>
            </div>
          </>
        )}
      </div>
    </>
  );
}
