import { createPortal } from "react-dom";
import { AssistantAvatar } from "@/components/assistant/AssistantAvatar";
import { ChatPanel } from "@/components/ChatPanel";
import { AssistantDrawer } from "@/components/assistant/AssistantDrawer";
import { useAssistant } from "@/contexts/AssistantContext";
import { useLang } from "@/contexts/LangContext";

/**
 * Dashboard floating launcher + assistant drawer (FCR-113).
 *
 * The FAB is portaled to <body> (createPortal) so its `position: fixed` resolves
 * against the viewport, not the `.page-enter` transformed page wrapper (that was
 * the "FAB in the page corner, not the screen corner" bug). The panel is the
 * shared AssistantDrawer (also portaled), which fixes the mobile scroll bug.
 */
export function GlobalAssistant() {
  const { open, setOpen, messages, setMessages, input, pageContext } = useAssistant();
  const { tr } = useLang();

  const fab =
    !open && typeof document !== "undefined"
      ? createPortal(
          <button
            data-tour="assistant"
            onClick={() => setOpen(true)}
            aria-label={tr.assistant}
            className="fixed bottom-5 right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 transition hover:scale-105 hover:shadow-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            <AssistantAvatar className="h-10 w-10 brightness-0 invert" />
          </button>,
          document.body,
        )
      : null;

  return (
    <>
      {fab}
      <AssistantDrawer open={open} onOpenChange={setOpen} title={tr.assistant}>
        <ChatPanel
          buildingType={input.buildingType}
          usage={input.usage ?? ""}
          areaM2={input.areaM2}
          floors={input.floors}
          occupants={input.occupants}
          ceilingHeight={input.ceilingHeight}
          volume={input.volume}
          onClose={() => setOpen(false)}
          messages={messages}
          setMessages={setMessages}
          pageContext={pageContext}
        />
      </AssistantDrawer>
    </>
  );
}
