import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Button, ShellSkeleton } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { useAuth } from "@/contexts/AuthContext";
import { clearDemoDraft, pendingDemoDraft } from "@/lib/demoDraft";
import { localizedPath } from "@/lib/paths";
import { sokolApi, QuotaError } from "@/services/sokolApi";

// React effects and tabs may repeat. The server also locks and deduplicates claims.
const inFlight = new Map<string, Promise<{ projectId: string }>>();
export default function DemoProject() {
  const { lang, tr } = useLang();
  const { user } = useAuth();
  const navigate = useNavigate();
  const queries = useQueryClient();
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [canRetry, setCanRetry] = useState(true);

  useEffect(() => {
    let cancelled = false;
    const draft = pendingDemoDraft();
    if (!draft) { navigate(localizedPath(lang, "/projects"), { replace: true }); return; }
    if (Date.parse(draft.expiresAt) <= Date.now()) {
      clearDemoDraft(draft.draftId);
      setCanRetry(false); setError(tr.demo_draft_expired); return;
    }
    setError(null);
    const key = `${user?.userId}:${draft.draftId}`;
    let promise = inFlight.get(key);
    if (!promise) {
      promise = sokolApi.claimDemoProject({ draftId: draft.draftId, claimToken: draft.claimToken });
      inFlight.set(key, promise);
      void promise.finally(() => inFlight.delete(key)).catch(() => {});
    }
    void promise.then(({ projectId }) => {
      if (cancelled) return;
      clearDemoDraft(draft.draftId);
      void queries.invalidateQueries({ queryKey: ["projects"] });
      navigate(localizedPath(lang, `/projects/${encodeURIComponent(projectId)}`), { replace: true });
    }).catch((err: unknown) => {
      if (cancelled) return;
      const status = (err as { response?: { statusCode?: number }; status?: number })?.response?.statusCode
        ?? (err as { status?: number })?.status;
      if (status === 410) {
        clearDemoDraft(draft.draftId); setCanRetry(false); setError(tr.demo_draft_expired);
      } else if (status === 404 || status === 409) {
        setCanRetry(false); setError(tr.demo_draft_unavailable);
      } else {
        setCanRetry(true); setError(err instanceof QuotaError ? tr.demo_draft_quota : tr.demo_draft_error);
      }
    });
    return () => { cancelled = true; };
  }, [lang, navigate, queries, retry, tr, user?.userId]);

  if (!error) return <ShellSkeleton label={tr.demo_draft_saving} />;
  return <main className="mx-auto max-w-xl p-8 space-y-4">
    <h1 className="text-xl font-semibold">{tr.demo_draft_title}</h1>
    <p role="alert">{error}</p>
    {canRetry && <Button onClick={() => setRetry((value) => value + 1)}>{tr.demo_draft_retry}</Button>}
    <Button variant="ghost" onClick={() => navigate(localizedPath(lang, "/projects"))}>{tr.nav_projects}</Button>
  </main>;
}
