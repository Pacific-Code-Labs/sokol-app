/**
 * UpgradeModal (FCR-026) — the plan-quota call-to-action.
 *
 * Opened when an authenticated request is rejected for hitting a plan limit:
 *   - HTTP 402 from /projects (saved-projects limit), or
 *   - HTTP 429 from /evaluate (monthly evaluate quota).
 * Both surface as a typed `QuotaError` from `sokolApi`; pass it as `quota`.
 *
 * Built on the DS `Modal` primitive (FCR-003). All copy is bilingual via
 * LangContext — no hardcoded user-facing strings.
 *
 * The CTA routes to `/pricing` (FCR-028): the public, card-free plan surface.
 */
import { useNavigate } from "react-router-dom";
import { Modal } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { localizedPath } from "@/lib/paths";
import type { QuotaError } from "@/services/sokolApi";

function fill(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
}

interface Props {
  /** The quota error to surface; when null the modal is closed. */
  quota: QuotaError | null;
  onClose: () => void;
}

export function UpgradeModal({ quota, onClose }: Props) {
  const { lang, tr } = useLang();
  const navigate = useNavigate();

  const payload = quota?.payload;
  const tier = payload?.tier ?? tr.upgrade_tier_current;
  const limit = payload?.limit ?? 0;

  const description = !quota
    ? ""
    : quota.kind === "saved_projects"
    ? fill(tr.upgrade_projects_desc, { tier, limit })
    : quota.kind === "evaluate"
    ? fill(tr.upgrade_evaluate_desc, { tier, limit })
    : tr.upgrade_generic_desc;

  const usageLine =
    payload && payload.unit !== "tokens" && typeof payload.current === "number"
      ? fill(tr.upgrade_current_usage, { current: payload.current, limit })
      : null;

  const resetLine =
    quota?.kind === "evaluate" && payload?.reset
      ? fill(tr.upgrade_resets, { date: new Date(payload.reset).toLocaleDateString() })
      : null;

  const handleUpgrade = () => {
    onClose();
    // FCR-028: the public pricing surface (card-free) is the upgrade landing.
    navigate(localizedPath(lang, "/pricing"));
  };

  return (
    <Modal
      open={!!quota}
      onClose={onClose}
      variant="warning"
      icon="warning"
      title={tr.upgrade_title}
      description={description}
      confirm={{ label: tr.upgrade_cta, onClick: handleUpgrade }}
      cancel={{ label: tr.upgrade_dismiss, onClick: onClose }}
    >
      {(usageLine || resetLine) && (
        <div className="rounded-[var(--radius)] border border-border bg-muted/40 px-3 py-2 text-center text-xs text-muted-foreground">
          {usageLine && <div>{usageLine}</div>}
          {resetLine && <div>{resetLine}</div>}
        </div>
      )}
    </Modal>
  );
}
