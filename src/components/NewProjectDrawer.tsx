import { useSearchParams } from "react-router-dom";
import { Drawer } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import NewProjectForm from "@/components/NewProjectForm";

/** URL-backed drawer keeps creation over the current dashboard or project list. */
export function NewProjectDrawer() {
  const [params, setParams] = useSearchParams();
  const { tr } = useLang();
  const open = params.get("new") === "1";
  const close = () => {
    const next = new URLSearchParams(params);
    next.delete("new");
    setParams(next, { replace: true });
  };
  return <Drawer open={open} onClose={close} title={tr.new_project} subtitle={tr.save_run_eval}
    width={640} closeLabel={tr.close} bodyClassName="p-6">
      {open && <NewProjectForm onClose={close} />}
  </Drawer>;
}
