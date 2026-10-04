/** Server-authoritative token entitlements and saved project usage. */
import { createContext, useContext, ReactNode, useMemo } from "react";
import { useMe } from "@/hooks/useMe";
import { useProjects } from "@/hooks/useProjects";
import { getPlan, type PlanTier, type PlanConfig } from "@/lib/plans";

/** A single metered resource: how much is used vs the plan cap. */
export interface UsageMetric {
  /** Units consumed, or `null` when the BE doesn't expose a counter yet. */
  used: number | null;
  /** Plan cap, or `null` for unlimited. */
  cap: number | null;
}

export interface BillingUsage {
  tokens: UsageMetric;
  savedProjects: UsageMetric;
}

interface BillingCtx {
  /** Subscription tier (free | pro | enterprise); "free" until /me resolves. */
  tier: PlanTier;
  /** Convenience flag for the (current) only self-serve tier. */
  isFree: boolean;
  /** The resolved plan entitlements for `tier`. */
  plan: PlanConfig;
  /** Best-effort usage vs caps (see file header for which `used` are known). */
  usage: BillingUsage;
  /** True while either /me or the projects list is still loading. */
  loading: boolean;
}

const BillingContext = createContext<BillingCtx | null>(null);

export function BillingProvider({ children }: { children: ReactNode }) {
  const { tier: rawTier, me, isLoading: meLoading } = useMe();
  const { projects, loading: projectsLoading } = useProjects();

  const value = useMemo<BillingCtx>(() => {
    const tier = (rawTier as PlanTier) || "free";
    const plan = { ...getPlan(tier), ...(me?.usage ? { ...me.usage.plan, monthlyTokenBudget: me.usage.limit, maxSavedProjects: me.usage.maxSavedProjects, seats: me.usage.seats } : {}) };
    return {
      tier,
      isFree: tier === "free",
      plan,
      usage: {
        tokens: { used: me?.usage?.used ?? null, cap: me?.usage?.limit ?? null },
        savedProjects: { used: projects.length, cap: plan.maxSavedProjects },
      },
      loading: meLoading || projectsLoading,
    };
  }, [rawTier, me?.usage, projects.length, meLoading, projectsLoading]);

  return <BillingContext.Provider value={value}>{children}</BillingContext.Provider>;
}

export function useBilling() {
  const ctx = useContext(BillingContext);
  if (!ctx) throw new Error("useBilling must be used within BillingProvider");
  return ctx;
}
