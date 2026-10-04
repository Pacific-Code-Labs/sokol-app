import { render, screen } from "@testing-library/react";
import { RemainingUsagePanel } from "@/components/RemainingUsagePanel";

vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "es", tr: { profile_remaining_usage: "Uso restante", profile_weekly_quota: "Cuota semanal", profile_monthly_quota: "Cuota mensual", profile_usage_resets: "Reinicio {date}" } }) }));
vi.mock("@/hooks/useMe", () => ({ useMe: () => ({ me: { usage: { used: 1200, remaining: 8800, limit: 10000, weekly: { used: 750, remaining: 250, limit: 1000, reset: "2026-10-11T00:00:00Z" } } }, refetch: vi.fn() }) }));

it("shows only weekly remaining percentage without raw token quantities", () => {
  render(<RemainingUsagePanel />);
  expect(screen.getByText("25%")).toBeInTheDocument();
  expect(screen.getByRole("progressbar")).toHaveAttribute("value", "25");
  expect(screen.queryByText("Cuota mensual")).not.toBeInTheDocument();
  expect(document.body.textContent).not.toMatch(/10000|8800|1200|750|1000/);
});
