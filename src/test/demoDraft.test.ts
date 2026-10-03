import { beforeEach, expect, it } from "vitest";
import { captureDemoDraft, clearDemoDraft, pendingDemoDraft, postAuthPath } from "@/lib/demoDraft";
const id = "0f24de61-f193-4fbb-ae93-92802062d21b";
const token = "a".repeat(43);
beforeEach(() => { localStorage.clear(); sessionStorage.clear(); history.replaceState({}, "", "/es/register"); });
it("captures the private fragment and survives verification, reloads and sign-in routes", () => {
  history.replaceState({}, "", `/es/register?draft=${id}&source=demo#claim=${token}`);
  captureDemoDraft();
  expect(location.hash).toBe("");
  expect(location.search).toBe("?source=demo");
  expect(pendingDemoDraft()).toMatchObject({ draftId: id, claimToken: token });
  history.replaceState({}, "", "/es/verify-email"); captureDemoDraft();
  expect(postAuthPath("es")).toBe("/es/demo-project");
  expect(postAuthPath("en", "/en/dashboard/profile")).toBe("/en/demo-project");
  clearDemoDraft(id);
  expect(postAuthPath("en", "/en/dashboard/profile")).toBe("/en/dashboard/profile");
});
it("keeps other unfinished drafts when the active one is claimed", () => {
  history.replaceState({}, "", `/es/register?draft=${id}#claim=${token}`); captureDemoDraft();
  const other = "1f24de61-f193-4fbb-ae93-92802062d21b";
  history.replaceState({}, "", `/es/register?draft=${other}#claim=${token}`); captureDemoDraft();
  clearDemoDraft(other);
  expect(localStorage.getItem(`sokol.demo-draft.v1.${id}`)).not.toBeNull();
});
it("rejects malformed capabilities without changing normal signup redirects", () => {
  history.replaceState({}, "", `/es/register?draft=invalid#claim=${token}`); captureDemoDraft();
  expect(pendingDemoDraft()).toBeNull(); expect(location.hash).toBe("");
  expect(postAuthPath("es")).toBe("/es/dashboard");
});
