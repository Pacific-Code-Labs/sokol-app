import { useId } from "react";
import { ArrowRight, Flame } from "lucide-react";
import { useLang } from "@/contexts/LangContext";
import { getDemoScenarios, type DemoScenario } from "@/lib/demoScenarios";
import { AssistantAvatar } from "./AssistantAvatar";

interface Props {
  /** Tap handler — applies the scenario (grounds the agent + fills the inputs). */
  onPick: (scenario: DemoScenario) => void;
  showExamples?: boolean;
}

/**
 * The assistant's first impression: brand mark + value line + curated capability
 * cards. Each card carries a full building scenario (type/usage/area/floors/…)
 * so the tap grounds the agent and returns a rich evaluation — the very first
 * tap showcases the agent's depth. Cards reveal with a stagger.
 */
export function WelcomeState({ onPick, showExamples = false }: Props) {
  const { tr } = useLang();
  const scenarios = getDemoScenarios(tr);
  const uid = useId();

  return (
    <div className="assistant-welcome flex flex-col items-center gap-4 px-1 py-3 text-center duration-500 animate-in fade-in-50">
      <AssistantAvatar className="h-12 w-12 [&>svg]:h-6 [&>svg]:w-6" />

      <div className="space-y-1.5">
        <h3 className="text-balance text-base font-bold leading-snug">{tr.demoWelcomeTitle}</h3>
        <p className="text-pretty text-sm text-muted-foreground">{tr.demoWelcomeSubtitle}</p>
      </div>

      {showExamples && <div className="grid w-full gap-2 sm:grid-cols-2">
        {scenarios.map((s, i) => (
          <button
            key={s.label}
            type="button"
            onClick={() => onPick(s)}
            aria-label={s.label}
            aria-describedby={`${uid}-${i}-description`}
            style={{ animationDelay: `${i * 70}ms`, animationFillMode: "backwards" }}
            className="assistant-example group flex flex-col gap-3 rounded-xl border border-border p-4 text-left transition-colors duration-200 animate-in fade-in-50 slide-in-from-bottom-2 hover:border-primary/50 hover:bg-primary/5"
          >
            <span className="assistant-example-heading flex w-full items-center gap-2.5">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-primary/15 bg-primary/5 text-primary">
                <s.icon className="h-4 w-4" aria-hidden="true" />
              </span>
              <span className="min-w-0 flex-1 text-xs font-semibold leading-snug">{s.label}</span>
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary/60 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </span>
            <span id={`${uid}-${i}-description`} className="block text-xs leading-relaxed text-muted-foreground">{s.query}</span>
          </button>
        ))}
      </div>}

      <div className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        <Flame className="h-3 w-3 text-primary" />
        {tr.capabilities}
      </div>
    </div>
  );
}
