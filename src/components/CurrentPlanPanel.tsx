/** Current plan and server-reported monthly AI token usage. */
import { Link } from "react-router-dom";
import {
  Badge,
  buttonVariants,
  Card,
  CardBody,
  CardHeader,
  CardTitle,
} from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { useBilling, type UsageMetric } from "@/contexts/BillingContext";
import type { Dict } from "@/lib/i18n";
import type { PlanTier } from "@/lib/plans";
import { localizedPath } from "@/lib/paths";

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

const NAME_KEY: Record<PlanTier, keyof Dict> = {
  free: "plan_free_name",
  pro: "plan_pro_name",
  enterprise: "plan_enterprise_name",
};

function usageText(metric: UsageMetric, tr: Dict): string {
  if (metric.cap === null && metric.used === null) return tr.profile_usage_unavailable;
  if (metric.cap === null) return tr.plan_panel_usage_unlimited;
  if (metric.used === null) return fill(tr.plan_panel_usage_cap_only, { cap: metric.cap });
  return fill(tr.plan_panel_usage_known, { used: metric.used, cap: metric.cap });
}

function pct(metric: UsageMetric): number {
  if (metric.cap === null || metric.cap === 0 || metric.used === null) return 0;
  return Math.min(100, Math.round((metric.used / metric.cap) * 100));
}

function UsageRow({ label, metric, tr }: { label: string; metric: UsageMetric; tr: Dict }) {
  const known = metric.used !== null && metric.cap !== null;
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-sm">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{usageText(metric, tr)}</span>
      </div>
      <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
        <div
          className="h-full rounded-full bg-primary transition-all"
          style={{ width: `${known ? pct(metric) : 0}%` }}
          aria-hidden
        />
      </div>
    </div>
  );
}

export function CurrentPlanPanel() {
  const { lang, tr } = useLang();
  const { tier, plan, usage } = useBilling();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle>{tr.plan_panel_title}</CardTitle>
          <p className="text-sm text-muted-foreground">{tr.plan_panel_subtitle}</p>
        </div>
        <Badge variant="success">{plan[`name_${lang}`] ?? tr[NAME_KEY[tier]]}</Badge>
      </CardHeader>
      <CardBody className="space-y-4">
        <UsageRow label={tr.plan_panel_evals} metric={usage.tokens} tr={tr} />
        <UsageRow label={tr.plan_panel_projects} metric={usage.savedProjects} tr={tr} />
        <Link
          to={localizedPath(lang, "/pricing")}
          className={`${buttonVariants({ variant: "outline", size: "sm" })} w-full`}
        >
          {tr.plan_panel_view_plans}
        </Link>
      </CardBody>
    </Card>
  );
}
