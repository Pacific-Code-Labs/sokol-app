import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ArrowLeft, Loader2, Paperclip } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import { Badge, cn, DetailSkeleton } from "@pacific-code-labs/sokol-design-system";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { supportKeys, useSupportTicket } from "@/hooks/useSupport";
import { getSupport } from "@/repositories/content.repository";
import { EVIDENCE_TYPES, MAX_EVIDENCE_BYTES, MAX_EVIDENCE_FILES, supportRepository } from "@/repositories/support.repository";
import { pickLang } from "@/lib/content-lang";
import { localizedPath } from "@/lib/paths";
import { STATUS_VARIANT } from "./SupportList";

export default function SupportDetail() {
  const { id = "" } = useParams();
  const { lang, tr } = useLang();
  const content = getSupport();
  const { user } = useAuth();
  const client = useQueryClient();
  const ticket = useSupportTicket(id);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const refresh = () => client.invalidateQueries({ queryKey: supportKeys.list(user?.userId) });

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await action();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  const date = (value: string | null) => (value ? new Date(value).toLocaleString(lang) : "");
  const tk = ticket.data;

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-4">
        <Link to={localizedPath(lang, "/support")} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> {pickLang(content.title, lang)}
        </Link>
        {ticket.isLoading ? (
          <DetailSkeleton label={tr.loading} />
        ) : !tk ? (
          <p className="text-sm text-destructive">{tr.support_load_error}</p>
        ) : (
          <>
            <div className="flex items-start justify-between gap-4">
              <div>
                <h1 className="text-2xl font-bold tracking-tight">{tk.subject}</h1>
                <p className="mt-1 text-sm text-muted-foreground">{date(tk.created_at)}</p>
              </div>
              <Badge variant={STATUS_VARIANT[tk.status]}>{tr[`support_status_${tk.status}`]}</Badge>
            </div>
            <p className="whitespace-pre-wrap rounded-lg border border-border bg-card p-4 text-sm">{tk.description}</p>
            {tk.incident_reference && (
              <p className="text-xs text-muted-foreground">
                {tr.support_reference}: <span className="font-mono">{tk.incident_reference}</span>
              </p>
            )}
            {!!tk.evidence?.length && (
              <div className="flex flex-wrap gap-2">
                {tk.evidence.map((e) => (
                  <Button
                    key={e.id}
                    variant="outline"
                    size="sm"
                    className="gap-1"
                    onClick={async () =>
                      window.open((await supportRepository.evidenceUrl(user!.userId, tk.id, e.id)).download_url, "_blank", "noopener,noreferrer")
                    }
                  >
                    <Paperclip className="h-4 w-4" /> {e.file_name}
                  </Button>
                ))}
              </div>
            )}
            <div className="space-y-2">
              {tk.messages?.map((m) => (
                <div key={m.id} className={cn("max-w-[85%] rounded-lg p-3 text-sm", m.is_staff ? "bg-primary/10" : "ml-auto bg-muted")}>
                  <p className="whitespace-pre-wrap">{m.body}</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {m.is_staff ? tr.support_team : tr.support_you} · {date(m.created_at)}
                  </p>
                </div>
              ))}
            </div>
            {tk.status === "closed" ? (
              <p className="rounded-md bg-muted p-3 text-sm">
                {pickLang(content.closedNotice, lang)}{" "}
                <Link to={localizedPath(lang, "/support/new")} className="text-primary underline">
                  {tr.support_new}
                </Link>
              </p>
            ) : (
              <form
                className="space-y-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void run(async () => {
                    await supportRepository.reply(user!.userId, tk.id, reply.trim());
                    setReply("");
                  });
                }}
              >
                <textarea
                  className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={reply}
                  onChange={(e) => setReply(e.target.value)}
                  placeholder={tr.support_reply_placeholder}
                  maxLength={10000}
                  rows={3}
                />
                <div className="flex flex-wrap items-center gap-3">
                  <Button type="submit" disabled={busy || !reply.trim()} className="gap-2">
                    {busy && <Loader2 className="h-4 w-4 animate-spin" />}
                    {tr.support_send_reply}
                  </Button>
                  {(tk.evidence?.length ?? 0) < MAX_EVIDENCE_FILES && (
                    <label className="cursor-pointer text-sm text-primary underline">
                      {tr.support_add_screenshot}
                      <input
                        type="file"
                        className="sr-only"
                        accept={EVIDENCE_TYPES.join(",")}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          e.target.value = "";
                          if (!file) return;
                          if (!EVIDENCE_TYPES.includes(file.type) || file.size > MAX_EVIDENCE_BYTES) return setError(tr.support_file_rules);
                          void run(() => supportRepository.attach(user!.userId, tk.id, file));
                        }}
                      />
                    </label>
                  )}
                </div>
                {error && <p className="text-sm text-destructive">{error}</p>}
              </form>
            )}
          </>
        )}
      </div>
    </>
  );
}
