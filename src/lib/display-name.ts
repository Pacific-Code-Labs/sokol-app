import type { AuthUser } from "aws-amplify/auth";
import type { UserProfile } from "@/contexts/AuthContext";

export function displayName(profile: UserProfile | null, user: AuthUser | null): string {
  const preferred = profile?.username?.trim();
  if (preferred) return preferred;
  const name = [profile?.firstName, profile?.lastName].filter(Boolean).join(" ").trim();
  if (name) return name;
  const username = user?.username ?? "";
  if (username && !username.includes("@") && !/^[0-9a-f-]{36}$/i.test(username)) return username;
  return (user?.signInDetails?.loginId ?? username).split("@")[0];
}
