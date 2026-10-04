import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { Project } from "@/hooks/useProjects";
import { sokolApi } from "@/services/sokolApi";
import { useLang } from "@/contexts/LangContext";
import { CategoryCard } from "@/components/CategoryCard";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/** Catalogue matches use persisted building data; electrical rules use the saved study. */
export function ProjectCodeRules({ project }: { project: Project }) {
  const { lang, tr } = useLang();
  const [page, setPage] = useState(0);
  const { data, isLoading, isError } = useQuery({
    queryKey: ["project-rules", project.id, project.updatedAt, project.building_type, project.usage, project.area_m2, project.floors, project.occupants, project.ceiling_height_m, project.volume_m3, page, lang],
    queryFn: () => sokolApi.getRules({ building_type: project.building_type, usage: project.usage,
      area_m2: project.area_m2 || undefined, floors: project.floors, occupants: project.occupants,
      ceiling_height_m: project.ceiling_height_m, volume_m3: project.volume_m3,
      page, page_size: 20, language: lang }),
    staleTime: 30_000,
  });
  const study = project.electrical?.result;
  return <section className="space-y-4">
    <Card>
      <CardHeader><CardTitle className="text-base">{tr.project_nfpa_rules_title}</CardTitle><CardDescription>{tr.project_nfpa_rules_desc}</CardDescription></CardHeader>
      <CardContent className="space-y-4">
        {isLoading && <p className="text-sm text-muted-foreground">{tr.loading}</p>}
        {isError && <p role="alert" className="text-sm text-destructive">{tr.project_rules_error}</p>}
        {!isLoading && !isError && !data?.data.some(group => group.rules.length) && <p className="text-sm text-muted-foreground">{tr.project_rules_empty}</p>}
        {data?.data.map(group => <CategoryCard key={group.type} group={group} />)}
        {data && data.pagination.totalPages > 1 && <div className="flex items-center justify-between gap-2">
          <Button variant="outline" size="sm" disabled={page === 0 || isLoading} onClick={() => setPage(current => current - 1)}>{tr.tour_previous}</Button>
          <span className="text-sm">{page + 1} / {data.pagination.totalPages}</span>
          <Button variant="outline" size="sm" disabled={page >= data.pagination.totalPages - 1 || isLoading} onClick={() => setPage(current => current + 1)}>{tr.tour_next}</Button>
        </div>}
      </CardContent>
    </Card>
    <Card>
      <CardHeader><CardTitle className="text-base">{tr.project_electrical_rules_title}</CardTitle><CardDescription>{tr.project_electrical_rules_desc}</CardDescription></CardHeader>
      <CardContent className="space-y-3 text-sm">
        {!study ? <p className="text-muted-foreground">{tr.project_electrical_rules_missing}</p> : <>
          {!study.mandatedProvisions?.length && <p className="text-muted-foreground">{tr.project_electrical_rules_empty}</p>}
          <ul className="space-y-3">{study.mandatedProvisions?.map((rule, index) => <li key={`${rule.code}-${index}`} className="rounded-lg border p-3">
            <div className="flex flex-wrap items-center justify-between gap-2"><span className="font-semibold">{rule.code}</span><span className="text-xs text-muted-foreground">{rule.status === "required" ? tr.elec_status_required : tr.elec_status_info}</span></div>
            <p className="mt-1">{rule.requirement}</p><p className="mt-1 text-xs text-muted-foreground">{rule.reference}</p>
          </li>)}</ul>
          {!!study.references?.length && <div className="space-y-1"><p className="font-medium">{tr.elec_references}</p><ul className="list-disc space-y-1 pl-5">{study.references.map(reference => <li key={reference}>{reference}</li>)}</ul></div>}
        </>}
      </CardContent>
    </Card>
  </section>;
}
