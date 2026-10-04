import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { EvaluationCard } from "@/components/assistant/EvaluationCard";
import { BuildingSelector } from "@/components/BuildingSelector";
import { CategoryCard } from "@/components/CategoryCard";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { useAssistant } from "@/contexts/AssistantContext";
import { sokolApi, BuildingType, RuleCategory, type EvaluateResponse, type EvaluateRequest, type RuleGroupDTO } from "@/services/sokolApi";
import { cn } from "@/lib/utils";
import { tChrome, fmt } from "@/lib/chrome-i18n";
import { Printer, ShieldAlert, ListChecks, AlertTriangle, ChevronLeft, ChevronRight } from "lucide-react";

const PAGE_SIZE = 20;

const CAT_CSS: Record<string, string> = {
  iniciacion:    "initiation",
  notificacion:  "notification",
  monitoreo:     "monitoring",
  accionamiento: "actuation",
};

const CATEGORY_TABS: { type: string; value: RuleCategory }[] = [
  { type: "iniciacion",    value: RuleCategory.iniciacion },
  { type: "notificacion",  value: RuleCategory.notificacion },
  { type: "monitoreo",     value: RuleCategory.monitoreo },
  { type: "accionamiento", value: RuleCategory.accionamiento },
];

/**
 * Signed-in rules evaluator (/dashboard/evaluator): filter NFPA rules by building; the global
 * assistant (GlobalAssistant) is kept in sync with the inputs. The public demo is on the landing.
 */
export default function Evaluator() {
  const { tr, lang } = useLang();
  const chrome = tChrome(lang);
  const assistant = useAssistant();
  const location = useLocation();
  const incoming = location.state as { assistantEvaluation?: EvaluateResponse; assistantRequest?: EvaluateRequest } | null;
  const [evaluation, setEvaluation] = useState(incoming?.assistantEvaluation);
  useEffect(() => {
    setEvaluation(incoming?.assistantEvaluation);
    const request = incoming?.assistantRequest;
    if (!request) return;
    setBuilding(request.building_type ?? BuildingType.comercial);
    setContext(request.usage ?? "");
    setArea(request.area_m2 ?? 0);
    setFloors(request.floors ?? 0);
    setOccupants(request.occupants ?? 0);
    setCeilingHeight(request.ceiling_height_m ?? 0);
    setVolume(request.volume_m3 ?? 0);
    setPage(0);
    setSelectedCategory(null);
  }, [location.state]);

  const [building, setBuilding]         = useState<BuildingType>(BuildingType.comercial);
  const [area, setArea]                 = useState<number>(0);
  const [context, setContext]           = useState<string>("");
  const [floors, setFloors]             = useState<number>(0);
  const [occupants, setOccupants]       = useState<number>(0);
  const [ceilingHeight, setCeilingHeight] = useState<number>(0);
  const [volume, setVolume]             = useState<number>(0);
  const [page, setPage]                 = useState<number>(0);
  const [selectedCategory, setSelectedCategory] = useState<RuleCategory | null>(null);

  // Sync the evaluator inputs into the global assistant.
  useEffect(() => {
    const request = incoming?.assistantRequest;
    assistant.setInput(evaluation ? {
      buildingType: request?.building_type,
      usage: request?.usage,
      areaM2: request?.area_m2,
      floors: request?.floors,
      occupants: request?.occupants,
      ceilingHeight: request?.ceiling_height_m,
      volume: request?.volume_m3,
    } : {
      buildingType: building,
      usage: context,
      areaM2: area || undefined,
      floors: floors || undefined,
      occupants: occupants || undefined,
      ceilingHeight: ceilingHeight || undefined,
      volume: volume || undefined,
    });
    assistant.setPageContext({
      page: "evaluation",
      payload: evaluation ? { request, evaluation } : { building, usage: context, area, floors, occupants, ceilingHeight, volume },
    });
  }, [building, context, area, floors, occupants, ceilingHeight, volume, evaluation, location.state]); // eslint-disable-line react-hooks/exhaustive-deps

  const filters = { building, area, context, floors, occupants, ceilingHeight, volume };

  const { data, isLoading, isError } = useQuery({
    queryKey: ["rules", filters, page, selectedCategory, lang],
    queryFn: () =>
      sokolApi.getRules({
        building_type:    building   || undefined,
        area_m2:          area       || undefined,
        usage:            context    || undefined,
        floors:           floors     || undefined,
        occupants:        occupants  || undefined,
        ceiling_height_m: ceilingHeight || undefined,
        volume_m3:        volume     || undefined,
        category:         selectedCategory ?? undefined,
        page,
        page_size: PAGE_SIZE,
        language:         lang,
      }),
    staleTime: 30_000,
    enabled: !evaluation,
  });

  const appliedGroups = Object.values((evaluation?.matchedRules ?? []).reduce<Record<string, RuleGroupDTO>>((groups, rule) => {
    const group = groups[rule.category] ??= { type: rule.category, description: "", quantity: 0, rules: [] };
    group.rules.push(rule);
    group.quantity += 1;
    return groups;
  }, {}));
  const categoryType = CATEGORY_TABS.find(tab => tab.value === selectedCategory)?.type;
  const ruleGroups = evaluation ? appliedGroups.filter(group => !categoryType || group.type === categoryType) : data?.data ?? [];
  const pagination = evaluation ? undefined : data?.pagination;
  const totalRules = evaluation ? evaluation.matchedRules.length : pagination?.totalElements ?? 0;
  const highRisk    = ruleGroups.reduce(
    (acc, g) => acc + g.rules.filter((r) => r.risk.level === "alto").length, 0
  );

  const handleFilterChange = <T,>(setter: (v: T) => void) => (v: T) => {
    setter(v);
    setEvaluation(undefined);
    setPage(0);
  };

  const selectCategory = (cat: RuleCategory | null) => {
    setSelectedCategory(cat);
    setPage(0);
  };

  return (
    <>
    <div className="flex flex-col scanline">
      {/*
        Mobile:  flex-col, everything stacks, page scrolls normally.
        Desktop: flex-row, left col scrolls independently, right col (chat) is pinned.
      */}
      <main className={cn("container flex-1 px-4 flex flex-col gap-4", "py-2")}>
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start">

          {/* ── LEFT COLUMN ── */}
          <div className="flex flex-col gap-4 lg:flex-1">

            {/* Title + badge */}
            <section className={cn("space-y-1")}>
              <div className="inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-primary">
                <ShieldAlert className="h-3.5 w-3.5" /> {chrome.evaluator.badge}
              </div>
              <h1 className={cn("font-bold leading-tight", "text-lg sm:text-xl")}>
                {chrome.evaluator.heroTitlePrefix}
                <span className="text-primary">{chrome.evaluator.heroTitleHighlight}</span>
                {chrome.evaluator.heroTitleSuffix}
              </h1>
            </section>

            {evaluation && (
              <section className="panel space-y-3 p-4">
                <h2 className="font-semibold">{tr.assistant_evaluation_title}</h2>
                <p className="text-sm text-muted-foreground">{incoming?.assistantRequest?.user_query}</p>
                <EvaluationCard data={evaluation} />
                <Button variant="outline" onClick={() => setEvaluation(undefined)}>{tr.assistant_browse_rules}</Button>
              </section>
            )}

            {/* Filters */}
            {!evaluation && <BuildingSelector
              value={building}      onChange={handleFilterChange(setBuilding)}
              area={area}           onAreaChange={handleFilterChange(setArea)}
              context={context}     onContextChange={handleFilterChange(setContext)}
              floors={floors}       onFloorsChange={handleFilterChange(setFloors)}
              occupants={occupants} onOccupantsChange={handleFilterChange(setOccupants)}
              ceilingHeight={ceilingHeight} onCeilingHeightChange={handleFilterChange(setCeilingHeight)}
              volume={volume}       onVolumeChange={handleFilterChange(setVolume)}
            />}

            {/* Stats + category filter */}
            <section className="flex flex-wrap items-center justify-between gap-3 panel px-4 py-3">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <div className="flex items-center gap-1.5">
                  <ListChecks className="h-4 w-4 text-accent" />
                  <span className="text-muted-foreground">{chrome.evaluator.total}</span>
                  <span className="font-semibold">{isLoading ? "—" : totalRules}</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <ShieldAlert className="h-4 w-4 text-[hsl(var(--risk-high))]" />
                  <span className="text-muted-foreground">{chrome.evaluator.highRisk}:</span>
                  <span className="font-semibold text-[hsl(var(--risk-high))]">{isLoading ? "—" : highRisk}</span>
                </div>

                <div className="h-4 w-px bg-border mx-1" />

                {/* "Todas / All" clears the filter */}
                <button
                  onClick={() => selectCategory(null)}
                  className={cn(
                    "rounded-full border px-2.5 py-1 text-xs transition-colors",
                    selectedCategory === null
                      ? "border-primary/60 bg-primary/10 text-primary font-semibold"
                      : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                  )}
                >
                  {chrome.evaluator.allCategories}
                </button>

                {CATEGORY_TABS.map(({ type, value }) => {
                  const group    = ruleGroups.find((g) => g.type === type);
                  const isActive = selectedCategory === value;
                  return (
                    <button
                      key={type}
                      onClick={() => selectCategory(value)}
                      className={cn(
                        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs transition-colors",
                        isActive
                          ? "border-primary/60 bg-primary/10 text-primary font-semibold"
                          : "border-border text-muted-foreground hover:border-primary/40 hover:bg-primary/5"
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full shrink-0"
                        style={{ backgroundColor: `hsl(var(--cat-${CAT_CSS[type] ?? "initiation"}))` }}
                      />
                      {tr[type as keyof typeof tr]}
                      {group && (
                        <span className={cn("font-semibold", isActive ? "text-primary" : "")}>
                          {group.quantity}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>

              <Button onClick={() => window.print()} variant="outline" size="sm" className="no-print gap-2 shrink-0">
                <Printer className="h-4 w-4" /> {tr.print}
              </Button>
            </section>

            {/*
              Rules list:
              - Mobile:  natural height, page scrolls
              - Desktop: flex-1 + overflow-y-auto → only this div scrolls
            */}
            <div className="space-y-4 pb-4">
              {!evaluation && isError && (
                <div className="flex items-center gap-3 rounded-md border border-[hsl(var(--risk-high)/0.4)] bg-[hsl(var(--risk-high)/0.1)] p-4 text-sm text-[hsl(var(--risk-high))]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  {chrome.evaluator.loadError}
                </div>
              )}

              {isLoading ? (
                [1, 2, 3, 4].map((i) => (
                  <div key={i} className="panel overflow-hidden">
                    <div className="px-4 py-3 border-b border-border">
                      <Skeleton className="h-5 w-32" />
                    </div>
                    <div className="divide-y divide-border">
                      {[1, 2, 3].map((j) => (
                        <div key={j} className="px-4 py-3 space-y-2">
                          <Skeleton className="h-4 w-48" />
                          <Skeleton className="h-3 w-full" />
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              ) : (
                ruleGroups.map((group) => (
                  <CategoryCard key={group.type} group={group} />
                ))
              )}
            </div>

            {/* Pagination — stays below the scroll area */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between panel px-4 py-3 shrink-0">
                <span className="text-xs text-muted-foreground">
                  {fmt(chrome.evaluator.paginationStatus, {
                    page: pagination.page + 1,
                    total: pagination.totalPages,
                    count: pagination.totalElements,
                  })}
                </span>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline" size="icon" className="h-9 w-9"
                    disabled={pagination.page === 0 || isLoading}
                    onClick={() => setPage((p) => Math.max(0, p - 1))}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="min-w-[2rem] text-center text-xs font-semibold">
                    {pagination.page + 1}
                  </span>
                  <Button
                    variant="outline" size="icon" className="h-9 w-9"
                    disabled={pagination.page >= pagination.totalPages - 1 || isLoading}
                    onClick={() => setPage((p) => p + 1)}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </div>

        </div>

        <footer className="shrink-0 pt-2 pb-1 text-center text-xs text-muted-foreground no-print">
          {tr.disclaimer}
        </footer>
      </main>

    </div>
    </>
  );
}
