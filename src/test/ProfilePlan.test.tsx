import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { CurrentPlanCard } from "@/components/CurrentPlanCard";
import Pricing from "@/pages/Pricing";
import { PLANS } from "@/lib/plans";
import { t } from "@/lib/i18n";

const state = vi.hoisted(() => ({ tier: "pro", loading: false, error: false }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "en", tr: t.en }) }));
vi.mock("@/hooks/useMe", () => ({ useMe: () => ({ tier: state.loading ? undefined : state.tier, isLoading: state.loading, isError: state.error, me: { usage: { plan: { name_en: "Professional", description_en: "Your organization plan" }, maxSavedProjects: 100, seats: 1 } } }) }));
vi.mock("@/contexts/BillingContext", () => ({ useBilling: () => ({ tier: state.tier, loading: state.loading }) }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { userId: "signed-in-user" } }) }));
vi.mock("@/services/sokolApi", () => ({ sokolApi: { getPlans: () => Promise.resolve(Object.values(PLANS)) } }));
vi.mock("@/components/Header", () => ({ Header: () => null }));
afterEach(() => { cleanup(); state.tier = "pro"; state.loading = false; state.error = false; });

it("shows the account's current plan and links Upgrade to the localized plan selection page", () => {
  render(<MemoryRouter><CurrentPlanCard /></MemoryRouter>);
  expect(screen.getByText("Professional")).toBeInTheDocument();
  expect(screen.getByText("100 saved projects")).toBeInTheDocument();
  expect(screen.getByRole("link", { name: t.en.upgrade_cta })).toHaveAttribute("href", "/en/pricing");
});

it("does not display a default Free subscription while the actual plan is loading", () => {
  state.loading = true;
  render(<MemoryRouter><CurrentPlanCard /></MemoryRouter>);
  expect(screen.queryByText("Professional")).not.toBeInTheDocument();
  expect(screen.queryByText(t.en.plan_free_name)).not.toBeInTheDocument();
});

it.each(["free", "pro", "enterprise"])("marks the correct current tier on the selection page: %s", async tier => {
  state.tier = tier;
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><Pricing /></MemoryRouter></QueryClientProvider>);
  expect(screen.getByRole("heading", { name: t.en.profile_select_plan })).toBeInTheDocument();
  const current = await screen.findByRole("button", { name: t.en.pricing_free_cta_active });
  expect(current).toBeDisabled();
  expect(current.closest(".flex.flex-col")).toHaveTextContent(t.en[`plan_${tier}_name`]);
  expect(screen.getByRole("link", { name: t.en.profile_back_to_profile })).toHaveAttribute("href", "/en/dashboard/profile");
});
