import { useSearchParams, useLocation } from "react-router-dom";
import { Drawer } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import NewProjectForm from "@/components/NewProjectForm";
import type { EvaluationProjectDraft } from "@/lib/assistantNavigation";
import { useProject } from "@/hooks/useProjects";

/** URL-backed drawer keeps creation over the current dashboard or project list. */
export function NewProjectDrawer() {
  const [params, setParams] = useSearchParams();
  const { tr } = useLang();
  const location = useLocation();
  const draft = (location.state as { projectDraft?: EvaluationProjectDraft } | null)?.projectDraft;
  const editId = params.get("edit") === "1" ? location.pathname.split("/").at(-1) : undefined;
  const { project, loading } = useProject(editId ?? "");
  const open = params.get("new") === "1" || !!editId;
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("new");
    next.delete("edit");
    setParams(next, { replace: true, state: { ...location.state, projectDraft: undefined } });
  };
  return <Drawer open={open} onClose={close} title={editId ? tr.project_edit : tr.new_project} subtitle={editId ? tr.project_edit_hint : draft ? tr.project_from_evaluation_hint : tr.save_run_eval}
    width={640} closeLabel={tr.close} bodyClassName="p-6">
      {open && (editId ? loading ? <p>{tr.loading}</p> : project ? <NewProjectForm key={project.id} onClose={close} project={project} /> : <p>{tr.project_not_found}</p> : <NewProjectForm onClose={close} draft={draft} />)}
  </Drawer>;
}
