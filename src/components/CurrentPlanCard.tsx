import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { Card, CardBody, CardHeader, CardTitle, CardDescription, Skeleton, buttonVariants } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { useMe } from "@/hooks/useMe";
import { getPlan } from "@/lib/plans";
import { localizedPath } from "@/lib/paths";

export function CurrentPlanCard() {
  const { lang, tr } = useLang();
  const { me, tier, isLoading, isError } = useMe();
  const plan = tier ? getPlan(tier) : undefined;
  const name = me?.usage?.plan?.[`name_${lang}`] || (plan && tr[`plan_${plan.tier}_name`]);
  const description = me?.usage?.plan?.[`description_${lang}`] || (plan && tr[`plan_${plan.tier}_tagline`]);
  return (
    <Card data-tour="profile" className="flex flex-col">
      <CardHeader><CardTitle>{tr.pricing_current_plan}</CardTitle><CardDescription>{tr.profile_plan_hint}</CardDescription></CardHeader>
      <CardBody className="flex flex-1 flex-col gap-4">
        {isLoading ? <Skeleton className="h-24 w-full" /> : isError || !plan ? (
          <p role="alert" className="text-sm text-muted-foreground">{tr.profile_plan_unavailable}</p>
        ) : <div className="space-y-2">
          <p className="text-3xl font-bold">{name}</p>
          <p className="text-sm text-muted-foreground">{description}</p>
          {me?.usage && <ul className="space-y-1 text-sm text-muted-foreground">
            <li>{tr.pricing_feat_projects.replace("{value}", me.usage.maxSavedProjects === null ? tr.pricing_unlimited : String(me.usage.maxSavedProjects))}</li>
            <li>{(me.usage.seats === 1 ? tr.pricing_seats_one : tr.pricing_seats_many).replace("{count}", String(me.usage.seats))}</li>
          </ul>}
        </div>}
        <Link to={localizedPath(lang, "/pricing")} className={`${buttonVariants()} mt-auto self-start gap-2`}>
          {tr.upgrade_cta}<ArrowUpRight className="h-4 w-4" aria-hidden />
        </Link>
      </CardBody>
    </Card>
  );
}
