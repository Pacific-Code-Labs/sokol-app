/** Offline plan defaults; the server and admin-managed policy are authoritative.
 * Token budgets are provisional. Paid checkout remains coming soon.
 */
export type PlanTier = "free" | "pro" | "enterprise";

export interface PlanConfig {
  tier: PlanTier;
  name_es?: string; name_en?: string; description_es?: string; description_en?: string;
  /** Provisional monthly AI tokens; server configuration is authoritative. */
  monthlyTokenBudget: number | null;
  /** Saved projects cap; null = unlimited. */
  maxSavedProjects: number | null;
  /** Included seats. */
  seats: number;
  /** Whether this tier is self-serve today (only Free, card-free). */
  selfServe: boolean;
}

export const PLANS: Record<PlanTier, PlanConfig> = {
  free: {
    tier: "free",
    monthlyTokenBudget: 3_000_000,
    maxSavedProjects: 3,
    seats: 1,
    selfServe: true,
  },
  pro: {
    tier: "pro",
    monthlyTokenBudget: 30_000_000,
    maxSavedProjects: 100,
    seats: 1,
    selfServe: false,
  },
  enterprise: {
    tier: "enterprise",
    monthlyTokenBudget: 100_000_000,
    maxSavedProjects: null,
    seats: 5,
    selfServe: false,
  },
};

export const PLAN_ORDER: PlanTier[] = ["free", "pro", "enterprise"];

export function getPlan(tier: string): PlanConfig {
  return PLANS[(tier as PlanTier)] ?? PLANS.free;
}
