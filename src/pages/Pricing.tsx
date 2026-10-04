import { useQuery } from "@tanstack/react-query";
import { sokolApi } from "@/services/sokolApi";
/**
 * Pricing (FCR-028, public, card-free) — the 3-tier plan surface.
 *
 * Renders Free / Pro / Enterprise cards from the FE plan mirror (`lib/plans.ts`,
 * synced with BE `config/plans.py`). The signed-in user's tier is marked as
 * the current plan. Unavailable paid tiers are marked "Coming soon"
 * (NO checkout, NO PayPal, NO card fields). Bilingual via LangContext; DS
 * primitives (Card/Badge/Button) from `@pacific-code-labs/sokol-design-system`.
 */
import { Link, useNavigate } from "react-router-dom";
import {
  Badge,
  Button,
  buttonVariants,
  Card,
  CardBody,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@pacific-code-labs/sokol-design-system";
import { Check } from "lucide-react";
import { Header } from "@/components/Header";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { useBilling } from "@/contexts/BillingContext";
import { PLAN_ORDER, PLANS, type PlanConfig, type PlanTier } from "@/lib/plans";
import type { Dict } from "@/lib/i18n";
import { localizedPath } from "@/lib/paths";

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

const NAME_KEY: Record<PlanTier, keyof Dict> = {
  free: "plan_free_name",
  pro: "plan_pro_name",
  enterprise: "plan_enterprise_name",
};
const TAGLINE_KEY: Record<PlanTier, keyof Dict> = {
  free: "plan_free_tagline",
  pro: "plan_pro_tagline",
  enterprise: "plan_enterprise_tagline",
};

function quotaLabel(value: number | null, tr: Dict): string {
  return value === null ? tr.pricing_unlimited : String(value);
}

function seatsLabel(seats: number, tr: Dict): string {
  return fill(seats === 1 ? tr.pricing_seats_one : tr.pricing_seats_many, { count: seats });
}

function planFeatures(plan: PlanConfig, tr: Dict): string[] {
  return [
    tr.pricing_feat_evals,
    fill(tr.pricing_feat_projects, { value: quotaLabel(plan.maxSavedProjects, tr) }),
    seatsLabel(plan.seats, tr),
  ];
}

export default function Pricing() {
  const { lang, tr } = useLang();
  const plans = useQuery({ queryKey: ["plans"], queryFn: () => sokolApi.getPlans(), staleTime: 60_000 });
  const { user } = useAuth();
  const { tier, loading } = useBilling();
  const navigate = useNavigate();

  return (
    <div className={user ? "bg-background" : "min-h-[100dvh] bg-background"}>
      {!user && <Header />}
      <main className="container py-12">
        <div className="mx-auto max-w-2xl text-center">
          <h1 className="text-3xl font-bold tracking-tight">{user ? tr.profile_select_plan : tr.pricing_title}</h1>
          <p className="mt-2 text-muted-foreground">{user ? tr.profile_select_plan_hint : tr.pricing_subtitle}</p>
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-6 md:grid-cols-3">
          {PLAN_ORDER.map((t) => {
            const plan = plans.data?.find((p) => p.tier === t) ?? PLANS[t];
            const isCurrent = !!user && !loading && tier === t;
            const comingSoon = !plan.selfServe;
            return (
              <Card
                key={t}
                className={`flex flex-col ${isCurrent ? "border-primary/60 ring-1 ring-primary/30" : ""}`}
              >
                <CardHeader className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <CardTitle>{plan[`name_${lang}`] ?? tr[NAME_KEY[t]]}</CardTitle>
                    {isCurrent && <Badge variant="success">{tr.pricing_active_badge}</Badge>}
                    {comingSoon && !isCurrent && <Badge variant="info">{tr.pricing_coming_soon}</Badge>}
                  </div>
                  <p className="text-sm text-muted-foreground">{plan[`description_${lang}`] ?? tr[TAGLINE_KEY[t]]}</p>
                </CardHeader>

                <CardBody className="flex-1">
                  <ul className="space-y-2 text-sm">
                    {planFeatures(plan, tr).map((feat) => (
                      <li key={feat} className="flex items-start gap-2">
                        <Check className="mt-0.5 h-4 w-4 shrink-0 text-primary" aria-hidden />
                        <span>{feat}</span>
                      </li>
                    ))}
                  </ul>
                </CardBody>

                <CardFooter>
                  {isCurrent ? (
                    <Button variant="outline" disabled className="w-full">
                      {tr.pricing_free_cta_active}
                    </Button>
                  ) : t === "free" ? (
                    <Button
                      className="w-full"
                      onClick={() => navigate(localizedPath(lang, user ? "/dashboard" : "/register"))}
                    >
                      {user ? tr.pricing_back_dashboard : tr.pricing_free_cta_anon}
                    </Button>
                  ) : (
                    // Pro / Enterprise — NO checkout / PayPal yet (FCR-027 deferred).
                    <Button variant="outline" disabled className="w-full">
                      {tr.pricing_coming_soon}
                    </Button>
                  )}
                </CardFooter>
              </Card>
            );
          })}
        </div>

        {user && (
          <div className="mx-auto mt-8 max-w-5xl text-center">
            <Link to={localizedPath(lang, "/dashboard/profile")} className={buttonVariants({ variant: "ghost" })}>
              {tr.profile_back_to_profile}
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
