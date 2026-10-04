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
        <dl className="grid gap-4 sm:grid-cols-3">
          <div><dt className="t-label">{tr.profile_tokens_remaining}</dt><dd className="text-2xl font-bold">{format(usage.remaining)}</dd></div>
          <div><dt className="t-label">{tr.profile_tokens_used}</dt><dd className="text-xl font-semibold">{format(usage.used)}</dd></div>
          <div><dt className="t-label">{tr.profile_tokens_budget}</dt><dd className="text-xl font-semibold">{format(usage.limit)}</dd></div>
        </dl>
        <progress className="mt-4 h-2 w-full accent-primary" aria-label={tr.profile_tokens_used} max={usage.limit} value={Math.min(usage.used, usage.limit)} />
        <p className="mt-2 text-xs text-muted-foreground">{tr.profile_usage_resets.replace("{date}", new Date(usage.reset).toLocaleDateString(lang, { timeZone: "UTC" }))}</p>
      </>}
      <Button variant="outline" size="sm" className="mt-4" disabled={isFetching} onClick={() => void refetch()}>{tr.profile_usage_refresh}</Button>
    </CardBody>
  </Card>;
}
