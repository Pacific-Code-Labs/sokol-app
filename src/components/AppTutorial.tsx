import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";
import { BookOpen, ChevronLeft, ChevronRight, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useLang } from "@/contexts/LangContext";
import { localizedPath, stripLangPrefix } from "@/lib/paths";
import { TutorialSpotlight } from "@/components/TutorialSpotlight";

type Status = "unseen" | "welcome" | "active" | "dismissed" | "complete";
type Progress = { status: Status; step: string };
interface Props { userId: string; ready: boolean; projects: boolean; evaluator: boolean; dashboard: boolean }
export const tutorialStorageKey = (userId: string) => `sokol-tutorial-v1:${userId}`;
function readProgress(key: string): Progress {
  try {
    const saved = JSON.parse(localStorage.getItem(key) ?? "null");
    if (saved && ["active", "dismissed", "complete"].includes(saved.status) && typeof saved.step === "string") return saved;
  } catch { /* Storage can be unavailable; the tour still works in memory. */ }
  return { status: "unseen", step: "dashboard" };
}

/** Read-only, user-scoped walkthrough. Navigation never submits forms or AI requests. */
export function AppTutorial({ userId, ready, projects, evaluator, dashboard }: Props) {
  const { lang, tr } = useLang();
  const location = useLocation();
  const navigate = useNavigate();
  const key = tutorialStorageKey(userId);
  const [progress, setProgress] = useState(() => readProgress(key));
  const steps = useMemo(() => [
    ...(dashboard ? [{ id: "dashboard", path: "/dashboard", title: tr.tour_dashboard_title, description: tr.tour_dashboard_desc }] : []),
    ...(projects ? [{ id: "projects", path: "/projects", title: tr.tour_projects_title, description: tr.tour_projects_desc }] : []),
    ...(evaluator ? [{ id: "evaluator", path: "/dashboard/evaluator", title: tr.tour_evaluator_title, description: tr.tour_evaluator_desc }] : []),
    ...(projects ? [{ id: "diagram", path: "/projects/electrical", title: tr.tour_diagram_title, description: tr.tour_diagram_desc }] : []),
    { id: "assistant", path: projects ? "/projects" : "/dashboard/profile", title: tr.tour_assistant_title, description: tr.tour_assistant_desc },
    { id: "profile", path: "/dashboard/profile", title: tr.tour_profile_title, description: tr.tour_profile_desc },
  ], [dashboard, projects, evaluator, tr]);
  const index = Math.max(0, steps.findIndex(step => step.id === progress.step));
  const step = steps[index];
  const save = (next: Progress) => {
    setProgress(next);
    try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep in-memory progress. */ }
  };
  useEffect(() => {
    if (ready && progress.status === "unseen" && stripLangPrefix(location.pathname).rest === "/dashboard") {
      setProgress({ status: "welcome", step: steps[0].id });
    }
  }, [ready, progress.status, location.pathname, steps]);
  const dismiss = () => save({ ...progress, status: "dismissed" });
  useEffect(() => {
    if (progress.status !== "active") return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !document.querySelector('[role="dialog"], [role="alertdialog"]')) {
        setProgress(current => {
          const next: Progress = { ...current, status: "dismissed" };
          try { localStorage.setItem(key, JSON.stringify(next)); } catch { /* Keep in-memory progress. */ }
          return next;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [progress.status, key]);
  const go = (nextIndex: number) => {
    const next = steps[nextIndex];
    save({ status: "active", step: next.id });
    navigate(localizedPath(lang, next.path));
  };
  const atStep = stripLangPrefix(location.pathname).rest === step.path;
  return <>
    <Button variant="ghost" size="icon" disabled={!ready} aria-label={tr.tour_replay} title={tr.tour_replay}
      onClick={() => setProgress({ status: "welcome", step: steps[0].id })}><BookOpen className="h-4 w-4" /></Button>
    <Dialog open={progress.status === "welcome"} onOpenChange={open => { if (!open) dismiss(); }}>
      <DialogContent>
        <DialogHeader><DialogTitle>{tr.tour_welcome_title}</DialogTitle><DialogDescription>{tr.tour_welcome_desc}</DialogDescription></DialogHeader>
        <p className="text-sm text-muted-foreground">{tr.tour_readonly}</p>
        <div className="flex justify-end gap-2"><Button variant="outline" onClick={dismiss}>{tr.tour_later}</Button><Button onClick={() => go(0)}>{tr.tour_start}</Button></div>
      </DialogContent>
    </Dialog>
    {progress.status === "active" && ready && createPortal(
      <TutorialSpotlight selector={atStep ? `[data-tour="${step.id}"]` : null} label={tr.tour_replay}>
        <div className="flex items-center justify-between gap-3">
          <span className="text-xs font-medium text-primary">{tr.tour_step.replace("{current}", String(index + 1)).replace("{total}", String(steps.length))}</span>
          <Button variant="ghost" size="icon" aria-label={tr.tour_close} onClick={dismiss}><X className="h-4 w-4" /></Button>
        </div>
        <div role="progressbar" aria-label={tr.tour_progress} aria-valuemin={0} aria-valuemax={steps.length} aria-valuenow={index + 1} className="mb-4 h-1 rounded-full bg-muted"><div className="h-full rounded-full bg-primary transition-all" style={{ width: `${((index + 1) / steps.length) * 100}%` }} /></div>
        <div aria-live="polite"><h2 className="font-semibold">{step.title}</h2><p className="mt-2 text-sm text-muted-foreground">{step.description}</p>
          {["projects", "evaluator", "diagram", "assistant"].includes(step.id) && (
            <div className="mt-3 space-y-2 rounded-lg border border-primary/20 bg-primary/5 p-3 text-sm">
              <p className="font-medium">{tr.tour_try_saying}</p>
              <p>{tr[`tour_${step.id}_example`]}</p>
              <p className="text-xs text-muted-foreground">{tr[`tour_${step.id}_outcome`]}</p>
            </div>
          )}
        </div>
        {!atStep && <Button variant="link" className="mt-2 px-0" onClick={() => go(index)}>{tr.tour_visit}</Button>}
        <Button variant="link" className="mt-2 h-auto whitespace-normal px-0 text-left" onClick={() => { dismiss(); navigate(localizedPath(lang, "/assistant-guide")); }}>{tr.guide_title}</Button>
        <div className="sticky bottom-0 mt-4 flex justify-between gap-2 bg-card pt-2">
          <Button variant="outline" disabled={index === 0} onClick={() => go(index - 1)}><ChevronLeft className="mr-1 h-4 w-4" />{tr.tour_previous}</Button>
          <Button onClick={() => index === steps.length - 1 ? save({ ...progress, status: "complete" }) : go(index + 1)}>{index === steps.length - 1 ? tr.tour_finish : tr.tour_next}<ChevronRight className="ml-1 h-4 w-4" /></Button>
        </div>
      </TutorialSpotlight>, document.body,
    )}
  </>;
}
