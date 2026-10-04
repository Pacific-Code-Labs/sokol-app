import { useState } from "react";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChatPanel, type Msg } from "@/components/ChatPanel";
import { BuildingType, QuotaError, sokolApi } from "@/services/sokolApi";
import { t } from "@/lib/i18n";

vi.mock("@/contexts/LangContext", () => ({useLang:()=>({lang:"es",tr:t.es})}));
vi.mock("@/components/assistant/WelcomeState", () => ({WelcomeState:()=>null}));
vi.mock("@/components/assistant/AssistantAvatar", () => ({AssistantAvatar:()=>null}));
vi.mock("@/services/sokolApi", async importOriginal => ({...await importOriginal<typeof import("@/services/sokolApi")>(),sokolApi:{evaluate:vi.fn()}}));
function Conversation() {
  const [messages,setMessages]=useState<Msg[]>([]);
  return <ChatPanel buildingType={BuildingType.comercial} usage="Oficina" messages={messages} setMessages={setMessages} pageContext={{page:"projects"}} />;
}
it("keeps a clear quota denial in the conversation and never renders a created-project card", async () => {
  HTMLElement.prototype.scrollTo=vi.fn();
  vi.mocked(sokolApi.evaluate).mockRejectedValueOnce(new QuotaError({type:"quota_exceeded",unit:"tokens",message:"Allowance exhausted",limit:750000,current:750000,remaining:0,tier:"free",reset:"2026-10-11T00:00:00Z"},429));
  render(<QueryClientProvider client={new QueryClient()}><MemoryRouter><Conversation /></MemoryRouter></QueryClientProvider>);
  fireEvent.change(screen.getByPlaceholderText(t.es.askPlaceholder),{target:{value:"Crea un nuevo proyecto para una oficina"}});
  fireEvent.submit(screen.getByPlaceholderText(t.es.askPlaceholder).closest("form")!);
  await screen.findByText(t.es.chat_usage_quota_blocked);
  expect(document.body.textContent).not.toContain("750000");
  fireEvent.click(screen.getByRole("button",{name:t.es.upgrade_dismiss}));
  expect(screen.getByText(t.es.chat_usage_quota_blocked)).toBeInTheDocument();
  expect(screen.queryByText(t.es.chat_project_created_toast)).not.toBeInTheDocument();
  expect(vi.mocked(sokolApi.evaluate)).toHaveBeenCalledOnce();
});
