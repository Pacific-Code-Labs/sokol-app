import { Card, CardBody, CardHeader, CardTitle, CardDescription, Button, Skeleton } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { useMe } from "@/hooks/useMe";

export function RemainingUsagePanel() {
  const { lang, tr } = useLang();
  const { me, isLoading, isError, refetch, isFetching } = useMe();
  const usage = me?.usage;
  const format = (value: number) => value.toLocaleString(lang);
  return <Card className="mb-6">
    <CardHeader><CardTitle>{tr.profile_remaining_usage}</CardTitle><CardDescription>{tr.profile_usage_hint}</CardDescription></CardHeader>
    <CardBody>
      {isLoading ? <Skeleton className="h-24 w-full" /> : isError || !usage ? <p role="alert" className="text-sm text-muted-foreground">{tr.profile_usage_unavailable}</p> : <>
        {[...(usage.weekly ? [{ ...usage.weekly, label: tr.profile_weekly_quota }] : []), { ...usage, label: tr.profile_monthly_quota }].map((window) => <section key={window.label} className="mb-5">
          <h3 className="mb-3 font-semibold">{window.label}</h3>
          <dl className="grid gap-4 sm:grid-cols-3">
            <div><dt className="t-label">{tr.profile_tokens_remaining}</dt><dd className="text-2xl font-bold">{format(window.remaining)}</dd></div>
            <div><dt className="t-label">{tr.profile_tokens_used}</dt><dd className="text-xl font-semibold">{format(window.used)}</dd></div>
            <div><dt className="t-label">{tr.profile_tokens_allowance}</dt><dd className="text-xl font-semibold">{format(window.limit)}</dd></div>
          </dl>
          <progress className="mt-4 h-2 w-full accent-primary" aria-label={window.label} max={window.limit} value={Math.min(window.used, window.limit)} />
          <p className="mt-2 text-xs text-muted-foreground">{tr.profile_usage_resets.replace("{date}", new Date(window.reset).toLocaleString(lang, { timeZone: "UTC" }))}</p>
        </section>)}
      </>}
      <Button variant="outline" size="sm" className="mt-4" disabled={isFetching} onClick={() => void refetch()}>{tr.profile_usage_refresh}</Button>
    </CardBody>
  </Card>;
}
