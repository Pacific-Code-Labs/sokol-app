/**
 * useMe (FCR-061) — TanStack Query over GET /me.
 *
 * Resolves the signed-in caller's identity + tenancy context (userId, the
 * Cognito sub; organizationId; org role/tier; platformRole) so the RBAC hooks
 * can build the org-scoped routes (/users/{userId}/organization/{orgId}/...).
 *
 * Shared cache key ["me"] — the sidebar, the roles page and usePermissions all
 * read the same single fetch. Enabled only while a Cognito user is present
 * (signed-out callers would just get a 401).
 */
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import { rbacApi } from "@/services/rbacApi";
import type { MeResponse } from "@/types/rbac";

export const meKeys = {
  me: ["me"] as const,
};

export function useMe() {
  const { user } = useAuth();
  const query = useQuery<MeResponse>({
    queryKey: meKeys.me,
    queryFn: () => rbacApi.getMe(),
    enabled: !!user,
    staleTime: 30_000,
    refetchInterval: 30_000,
    retry: 1,
  });

  const data = query.data;
  return {
    me: data,
    refetch: query.refetch,
    isFetching: query.isFetching,
    userId: data?.userId,
    organizationId: data?.organizationId,
    role: data?.role ?? null,
    tier: data?.tier,
    platformRole: data?.platformRole ?? null,
    isLoading: query.isLoading,
    isError: query.isError,
  };
}
