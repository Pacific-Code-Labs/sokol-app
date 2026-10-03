/** Capture the private fragment before content/analytics bootstrap. One record per draft. */
import { localizedPath, type Lang } from "@/lib/paths";
export interface PendingDemoDraft { draftId: string; claimToken: string; expiresAt: string; }
const PREFIX = "sokol.demo-draft.v1.";
const ACTIVE = PREFIX + "active";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TOKEN = /^[A-Za-z0-9_-]{43}$/;

export function captureDemoDraft() {
  const url = new URL(window.location.href);
  const draftId = url.searchParams.get("draft");
  const claimToken = new URLSearchParams(url.hash.slice(1)).get("claim");
  if (!draftId || !claimToken) return;
  if (UUID.test(draftId) && TOKEN.test(claimToken)) {
    const expiry = url.searchParams.get("expires");
    const expiresAt = expiry && Number.isFinite(Date.parse(expiry))
      ? expiry : new Date(Date.now() + 86400000).toISOString();
    localStorage.setItem(PREFIX + draftId, JSON.stringify({ draftId, claimToken, expiresAt }));
    localStorage.setItem(ACTIVE, draftId);
    sessionStorage.setItem(ACTIVE, draftId);
  }
  url.hash = "";
  url.searchParams.delete("draft");
  url.searchParams.delete("expires");
  window.history.replaceState(window.history.state, "", url.pathname + url.search);
}

export function pendingDemoDraft(): PendingDemoDraft | null {
  const id = sessionStorage.getItem(ACTIVE) ?? localStorage.getItem(ACTIVE);
  if (!id) return null;
  try {
    const draft = JSON.parse(localStorage.getItem(PREFIX + id) ?? "null");
    if (draft && draft.draftId === id && UUID.test(id) && TOKEN.test(draft.claimToken)
        && Number.isFinite(Date.parse(draft.expiresAt))) return draft;
  } catch { /* A malformed record cannot authorize a claim. */ }
  return null;
}

export function clearDemoDraft(id: string) {
  localStorage.removeItem(PREFIX + id);
  if (localStorage.getItem(ACTIVE) === id) localStorage.removeItem(ACTIVE);
  if (sessionStorage.getItem(ACTIVE) === id) sessionStorage.removeItem(ACTIVE);
}

export function postAuthPath(lang: Lang, fallback = localizedPath(lang, "/dashboard")) {
  return pendingDemoDraft() ? localizedPath(lang, "/demo-project") : fallback;
}
