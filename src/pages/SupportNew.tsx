import { Select } from "@pacific-code-labs/sokol-design-system";
import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { DashboardLayout } from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useLang } from "@/contexts/LangContext";
import { supportKeys } from "@/hooks/useSupport";
import { getSupport } from "@/repositories/content.repository";
import { EVIDENCE_TYPES, MAX_EVIDENCE_BYTES, MAX_EVIDENCE_FILES, supportRepository } from "@/repositories/support.repository";
import { pickLang } from "@/lib/content-lang";
import { localizedPath } from "@/lib/paths";

const fieldCls = "w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring";
const labelCls = "text-sm font-medium";

/** New request. `?reference=<request id>&category=…&subject=…&from=…` prefill it from an error. */
export default function SupportNew() {
  const { lang, tr } = useLang();
  const content = getSupport();
  const { user } = useAuth();
  const client = useQueryClient();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const reference = params.get("reference") ?? "";
  const [category, setCategory] = useState(params.get("category") ?? content.categories[0].id);
  const [subject, setSubject] = useState(params.get("subject") ?? "");
  const [description, setDescription] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const pickFiles = (list: FileList | null) => {
    const picked = Array.from(list ?? []);
    const ok = picked.filter((f) => EVIDENCE_TYPES.includes(f.type) && f.size <= MAX_EVIDENCE_BYTES);
    setError(ok.length < picked.length ? tr.support_file_rules : null);
    setFiles([...files, ...ok].slice(0, MAX_EVIDENCE_FILES));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user) return;
    setBusy(true);
    setError(null);
    try {
      const ticket = await supportRepository.create(user.userId, {
        subject: subject.trim(),
        description: description.trim(),
        category,
        ...(reference && { incident_reference: reference }),
        context: {
          route: params.get("from") ?? "",
          user_agent: navigator.userAgent,
          language: lang,
          client: "web",
          app_version: import.meta.env.MODE,
        },
      });
      for (const file of files) await supportRepository.attach(user.userId, ticket.id, file);
      await client.invalidateQueries({ queryKey: supportKeys.list(user.userId) });
      navigate(localizedPath(lang, `/support/${ticket.id}`));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="mx-auto max-w-2xl space-y-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">{tr.support_new}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{pickLang(content.newIntro, lang)}</p>
        </div>
        <form className="space-y-4 rounded-lg border border-border bg-card p-5" onSubmit={submit}>
          {reference && (
            <p className="rounded-md bg-muted p-3 text-sm">
              {pickLang(content.referenceHint, lang)} <span className="font-mono text-xs">{reference}</span>
            </p>
          )}
          <label className="block space-y-1">
            <span className={labelCls}>{tr.support_category}</span>
            <Select className={fieldCls} value={category} onChange={(e) => setCategory(e.target.value)}>
              {content.categories.map((c) => (
                <option key={c.id} value={c.id}>
                  {pickLang(c.label, lang)}
                </option>
              ))}
            </Select>
          </label>
          <label className="block space-y-1">
            <span className={labelCls}>{tr.support_subject}</span>
            <input className={fieldCls} value={subject} onChange={(e) => setSubject(e.target.value)} maxLength={160} minLength={3} required />
          </label>
          <label className="block space-y-1">
            <span className={labelCls}>{tr.support_description}</span>
            <textarea className={fieldCls} rows={6} value={description} onChange={(e) => setDescription(e.target.value)} maxLength={10000} minLength={10} required />
          </label>
          <label className="block space-y-1">
            <span className={labelCls}>{tr.support_screenshots}</span>
            <input type="file" accept={EVIDENCE_TYPES.join(",")} multiple onChange={(e) => pickFiles(e.target.files)} className="block text-sm" />
            <span className="block text-xs text-muted-foreground">{files.length ? files.map((f) => f.name).join(", ") : tr.support_file_rules}</span>
          </label>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Button type="submit" disabled={busy} className="gap-2">
            {busy && <Loader2 className="h-4 w-4 animate-spin" />}
            {tr.support_send}
          </Button>
        </form>
      </div>
    </DashboardLayout>
  );
}
