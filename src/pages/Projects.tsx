import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { useLang } from "@/contexts/LangContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { RiskBadge } from "@/components/RiskBadge";
import { FolderKanban, Plus, Trash2, Eye, Zap } from "lucide-react";
import { BuildingType } from "@/services/sokolApi";
import { localizedPath } from "@/lib/paths";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@pacific-code-labs/sokol-design-system";

export default function Projects() {
  const { projects, loading, remove } = useProjects();
  const { lang, tr } = useLang();
  const { setPageContext, setInput } = useAssistant();

  useEffect(() => {
    setPageContext({ page: "projects", payload: { count: projects.length } });
    setInput({});
  }, [projects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildingLabel: Record<number, string> = {
    [BuildingType.residencial]: tr.bt_residential,
    [BuildingType.comercial]: tr.bt_commercial,
    [BuildingType.industrial]: tr.bt_industrial,
  };

  return (
    <>
      <div className="space-y-4">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="text-2xl font-bold tracking-tight">{tr.projects_title}</h2>
            <p className="text-sm text-muted-foreground">{tr.projects_subtitle}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="outline" className="gap-2">
              <Link to={localizedPath(lang, "/projects/electrical")}><Zap className="h-4 w-4" /> {tr.new_electrical}</Link>
            </Button>
            <Button asChild className="gap-2">
              <Link to={localizedPath(lang, "/projects/new")}><Plus className="h-4 w-4" /> {tr.new_project}</Link>
            </Button>
          </div>
        </div>

        <Card>
          <CardContent className="p-0">
            {loading ? (
              <p className="p-6 text-sm text-muted-foreground">{tr.loading}</p>
            ) : projects.length === 0 ? (
              <div className="text-center py-16">
                <FolderKanban className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">{tr.no_projects}</p>
                <Button asChild size="sm"><Link to={localizedPath(lang, "/projects/new")}>{tr.create_first}</Link></Button>
              </div>
            ) : (
              <>
              <ul className="grid gap-4 p-4 sm:grid-cols-2 xl:grid-cols-3">
                {projects.map((p) => (
                  <li key={p.id} className="flex flex-col rounded-xl border border-border bg-card p-5 shadow-sm">
                    <Link to={localizedPath(lang, `/projects/${p.id}`)} className="min-w-0 flex-1 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <FolderKanban className="h-6 w-6 shrink-0 text-primary" />
                        <RiskBadge level={p.risk} />
                      </div>
                      <h3 className="break-words text-lg font-semibold">{p.name}</h3>
                      <p className="text-sm text-muted-foreground">{buildingLabel[p.building_type]} · {p.usage}</p>
                      <p className="text-sm">{p.area_m2} m²</p>
                      <p className="text-xs text-muted-foreground">{new Date(p.createdAt).toLocaleDateString(lang)}</p>
                    </Link>
                    <div className="mt-4 flex items-center justify-between border-t border-border pt-3">
                      <Button asChild variant="outline" size="sm"><Link to={localizedPath(lang, `/projects/${p.id}`)}><Eye className="mr-2 h-4 w-4" />{tr.view}</Link></Button>
                      <AlertDialog>
                        <AlertDialogTrigger asChild><Button variant="ghost" size="icon" aria-label={tr.delete}><Trash2 className="h-4 w-4 text-destructive" /></Button></AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader><AlertDialogTitle>{tr.delete_project}</AlertDialogTitle><AlertDialogDescription>{tr.delete_confirm}</AlertDialogDescription></AlertDialogHeader>
                          <AlertDialogFooter><AlertDialogCancel>{tr.cancel}</AlertDialogCancel><AlertDialogAction onClick={() => remove(p.id)}>{tr.delete}</AlertDialogAction></AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  </li>
                ))}
              </ul>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
