import { afterEach, beforeEach, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DemoProject from "@/pages/DemoProject";
import { captureDemoDraft, pendingDemoDraft } from "@/lib/demoDraft";
import { t } from "@/lib/i18n";
const api = vi.hoisted(() => ({ claimDemoProject: vi.fn() }));
vi.mock("@/services/sokolApi", () => ({ sokolApi: api, QuotaError: class extends Error {} }));
vi.mock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: { userId: "test-user" } }) }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ lang: "es", tr: t.es }) }));
vi.mock("@pacific-code-labs/sokol-design-system", () => ({
  Button: ({ children, onClick }: { children: React.ReactNode; onClick: () => void }) => <button onClick={onClick}>{children}</button>,
  ShellSkeleton: ({ label }: { label: string }) => <p>{label}</p>,
}));
const id = "0f24de61-f193-4fbb-ae93-92802062d21b";
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); vi.resetAllMocks(); });
afterEach(cleanup);
function seed(expires = "2099-01-01T00:00:00Z") {
  history.replaceState({}, "", `/es/register?draft=${id}&expires=${encodeURIComponent(expires)}#claim=${"a".repeat(43)}`);
  captureDemoDraft();
}
function renderPage() {
  return render(<QueryClientProvider client={new QueryClient()}><MemoryRouter initialEntries={["/es/demo-project"]}>
    <Routes><Route path="/es/demo-project" element={<DemoProject />} />
      <Route path="/es/projects/:id" element={<p>Saved project detail</p>} />
    </Routes>
  </MemoryRouter></QueryClientProvider>);
}
it("opens the real saved-project ID and clears only on success", async () => {
  seed(); api.claimDemoProject.mockResolvedValue({ projectId: "saved-id" }); renderPage();
  expect(await screen.findByText("Saved project detail")).toBeInTheDocument();
  expect(pendingDemoDraft()).toBeNull();
  expect(api.claimDemoProject).toHaveBeenCalledOnce();
});
it("retains the draft after a network failure and succeeds on retry", async () => {
  seed(); api.claimDemoProject.mockRejectedValueOnce(new Error("offline")).mockResolvedValueOnce({ projectId: "saved-id" });
  renderPage(); expect(await screen.findByText(t.es.demo_draft_error)).toBeInTheDocument();
  expect(pendingDemoDraft()?.draftId).toBe(id);
  fireEvent.click(screen.getByRole("button", { name: t.es.demo_draft_retry }));
  expect(await screen.findByText("Saved project detail")).toBeInTheDocument();
  await waitFor(() => expect(api.claimDemoProject).toHaveBeenCalledTimes(2));
});
it("shows an expired state without trying to save", async () => {
  seed("2000-01-01T00:00:00Z"); renderPage();
  expect(await screen.findByText(t.es.demo_draft_expired)).toBeInTheDocument();
  expect(api.claimDemoProject).not.toHaveBeenCalled(); expect(pendingDemoDraft()).toBeNull();
});
