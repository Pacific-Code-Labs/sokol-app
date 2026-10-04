import { Link } from "react-router-dom";
import { Plus } from "lucide-react";
import { Badge, ListSkeleton, type BadgeProps } from "@pacific-code-labs/sokol-design-system";
import { Button } from "@/components/ui/button";
import { useLang } from "@/contexts/LangContext";
import { useSupportTickets } from "@/hooks/useSupport";
import { getSupport } from "@/repositories/content.repository";
import type { TicketStatus } from "@/repositories/support.repository";
import { pickLang } from "@/lib/content-lang";
import { localizedPath } from "@/lib/paths";

export const STATUS_VARIANT: Record<TicketStatus, BadgeProps["variant"]> = {
  open: "warning",
  in_progress: "info",
  resolved: "success",
  closed: "outline",
};

export default function SupportList() {
  const { lang, tr } = useLang();
  const content = getSupport();
  const tickets = useSupportTickets();

  return (
    <>
      <div className="mx-auto max-w-3xl space-y-4">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">{pickLang(content.title, lang)}</h1>
            <p className="mt-1 text-sm text-muted-foreground">{pickLang(content.intro, lang)}</p>
          </div>
          <Button asChild className="gap-2">
            <Link to={localizedPath(lang, "/support/new")}>
              <Plus className="h-4 w-4" /> {tr.support_new}
            </Link>
          </Button>
        </div>
        {tickets.isLoading ? (
          <ListSkeleton rows={3} label={tr.loading} />
        ) : tickets.error ? (
          <p className="text-sm text-destructive">{tr.support_load_error}</p>
        ) : !tickets.data?.length ? (
          <p className="rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
            {pickLang(content.empty, lang)}
          </p>
        ) : (
          <ul className="space-y-2">
            {tickets.data.map((t) => (
              <li key={t.id}>
                <Link
                  to={localizedPath(lang, `/support/${t.id}`)}
                  className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-4 hover:border-primary/40"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{t.subject}</p>
                    <p className="text-xs text-muted-foreground">
                      {t.updated_at ? new Date(t.updated_at).toLocaleString(lang) : ""}
                    </p>
                  </div>
                  <Badge variant={STATUS_VARIANT[t.status]}>{tr[`support_status_${t.status}`]}</Badge>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}
