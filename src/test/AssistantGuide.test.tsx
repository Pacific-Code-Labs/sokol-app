import { fireEvent, render, screen } from "@testing-library/react";
import AssistantGuide from "@/pages/AssistantGuide";
import { t } from "@/lib/i18n";

const assistant = vi.hoisted(() => ({ setPageContext: vi.fn(), setInput: vi.fn(), setChatInput: vi.fn(), setOpen: vi.fn() }));
vi.mock("@/contexts/LangContext", () => ({ useLang: () => ({ tr: t.es }) }));
vi.mock("@/contexts/AssistantContext", () => ({ useAssistant: () => assistant }));

it("provides task-specific guidance and prepares an editable prompt without submitting it", () => {
  render(<AssistantGuide />);
  for (const topic of ["evaluate", "project", "electrical", "followup"]) {
    expect(screen.getByText(t.es[`guide_${topic}_prompt`])).toBeInTheDocument();
  }
  fireEvent.click(screen.getAllByRole("button", { name: t.es.guide_try })[0]);
  expect(assistant.setChatInput).toHaveBeenCalledWith(t.es.guide_evaluate_prompt);
  expect(assistant.setOpen).toHaveBeenCalledWith(true);
  expect(screen.getByText(t.es.guide_try_hint)).toBeInTheDocument();
});
