import { displayName } from "@/lib/display-name";
import { useEffect } from "react";
import { Link } from "react-router-dom";
import { useProjects } from "@/hooks/useProjects";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { RiskBadge } from "@/components/RiskBadge";
import { FolderKanban, Plus, Sparkles, ArrowRight } from "lucide-react";
import { BuildingType } from "@/services/sokolApi";
import { localizedPath } from "@/lib/paths";

export default function Dashboard() {
  const { projects, loading } = useProjects();
  const { user, profile } = useAuth();
  const { lang, tr } = useLang();
  const { setPageContext, setInput } = useAssistant();
  const name = displayName(profile, user);
  const recent = projects.slice(0, 5);

  useEffect(() => {
    setPageContext({ page: "dashboard", payload: { totalProjects: projects.length } });
    setInput({});
  }, [projects.length]); // eslint-disable-line react-hooks/exhaustive-deps

  const buildingLabel: Record<number, string> = {
    [BuildingType.residencial]: tr.bt_residential,
    [BuildingType.comercial]: tr.bt_commercial,
    [BuildingType.industrial]: tr.bt_industrial,
  };

  return (
    <>
      <div className="premium-dashboard space-y-6">
        <div className="workspace-intro">
          <h2 className="text-2xl font-bold tracking-tight">{tr.welcome_back}</h2>
          <p className="text-sm text-muted-foreground">{name}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Card className="workspace-stat flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-2 space-y-0">
              <CardTitle className="text-sm font-medium">{tr.total_projects}</CardTitle>
              <FolderKanban className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{loading ? "—" : projects.length}</div>
              <p className="text-xs text-muted-foreground mt-1">{tr.stored_workspace}</p>
            </CardContent>
            <CardContent className="mt-auto">
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to={localizedPath(lang, "/dashboard?new=1")}>
                  <Plus className="h-4 w-4" />
                  {tr.new_project}
                </Link>
              </Button>
            </CardContent>
          </Card>

          <Card data-tour="dashboard" className="workspace-stat workspace-stat--accent flex flex-col border-primary/30">
            <CardHeader>
              <CardTitle className="text-sm font-medium">{tr.new_evaluation}</CardTitle>
              <CardDescription>{tr.run_evaluator}</CardDescription>
            </CardHeader>
            <CardContent className="mt-auto">
              <Button asChild className="w-full gap-2">
                <Link to={localizedPath(lang, "/dashboard/evaluator")}>
                  <Sparkles className="h-4 w-4" />
                  {tr.open_evaluator}
                </Link>
              </Button>
            </CardContent>
          </Card>

        </div>

        <Card className="workspace-collection">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle>{tr.recent_projects}</CardTitle>
              <CardDescription>{tr.latest_evaluations}</CardDescription>
            </div>
            <Button asChild variant="ghost" size="sm" className="gap-1">
              <Link to={localizedPath(lang, "/projects")}>{tr.view_all} <ArrowRight className="h-4 w-4" /></Link>
            </Button>
          </CardHeader>
          <CardContent>
            {loading ? (
              <p className="text-sm text-muted-foreground">{tr.loading}</p>
            ) : recent.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-border rounded-md">
                <FolderKanban className="h-10 w-10 text-muted-foreground mx-auto mb-3" />
                <p className="text-sm text-muted-foreground mb-4">{tr.no_projects}</p>
                <Button asChild size="sm">
                  <Link to={localizedPath(lang, "/dashboard?new=1")}>{tr.create_first}</Link>
                </Button>
              </div>
            ) : (
              <ul className="divide-y divide-border">
                {recent.map((p) => (
                  <li key={p.id}>
                    <Link
                      to={localizedPath(lang, `/projects/${p.id}`)}
                      className="flex items-center justify-between py-3 hover:bg-muted/30 px-2 -mx-2 rounded"
                    >
                      <div className="min-w-0">
                        <div className="font-medium truncate">{p.name}</div>
                        <div className="text-xs text-muted-foreground truncate">
                          {buildingLabel[p.building_type]} · {p.usage} · {p.area_m2} m²
                        </div>
                      </div>
                      <RiskBadge level={p.risk} />
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
