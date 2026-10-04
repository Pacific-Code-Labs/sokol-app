import { Card, CardBody, CardHeader, CardTitle, CardDescription, Button, Skeleton } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { useMe } from "@/hooks/useMe";

export function RemainingUsagePanel() {
  const { lang, tr } = useLang();
  const { me, isLoading, isError, refetch, isFetching } = useMe();
  const usage = me?.usage;
  return <Card className="mb-6">
    <CardHeader><CardTitle>{tr.profile_remaining_usage}</CardTitle><CardDescription>{tr.profile_usage_hint}</CardDescription></CardHeader>
    <CardBody>
      {isLoading ? <Skeleton className="h-24 w-full" /> : isError || !usage?.weekly ? <p role="alert" className="text-sm text-muted-foreground">{tr.profile_usage_unavailable}</p> : <>
        {[{ ...usage.weekly, label: tr.profile_weekly_quota }].map((window) => <section key={window.label} className="mb-5">
          <h3 className="mb-3 font-semibold">{window.label}</h3>
          <div className="flex items-center gap-3">
            <progress className="h-2 flex-1 accent-primary" aria-label={window.label} max={100} value={window.limit > 0 ? Math.min(100, Math.round(window.remaining / window.limit * 100)) : 0} />
            <span className="text-sm font-semibold tabular-nums">{window.limit > 0 ? Math.min(100, Math.round(window.remaining / window.limit * 100)) : 0}%</span>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">{tr.profile_usage_resets.replace("{date}", new Date(window.reset).toLocaleString(lang, { timeZone: "UTC" }))}</p>
        </section>)}
      </>}
      <Button variant="outline" size="sm" className="mt-4" disabled={isFetching} onClick={() => void refetch()}>{tr.profile_usage_refresh}</Button>
    </CardBody>
  </Card>;
}
