import { useMemo, useState } from "react";
import { Badge, Button, Card, Icon, Modal } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { useMe } from "@/hooks/useMe";
import { useDeleteRole, useOrgRoles, usePermissions } from "@/hooks/useRbac";
import { RoleInUseError } from "@/services/rbacApi";
import { RoleDrawerForm } from "@/components/roles/RoleDrawerForm";
import { roleDescription, roleLabel } from "@/lib/rbacI18n";
import type { RoleDto } from "@/types/rbac";

interface DrawerState {
  open: boolean;
  role: RoleDto | null;
  duplicateFrom: RoleDto | null;
  readOnly: boolean;
}

const DRAWER_CLOSED: DrawerState = {
  open: false,
  role: null,
  duplicateFrom: null,
  readOnly: false,
};

/**
 * RolesPage (FCR-061, route /dashboard/roles) — org-scoped roles management:
 * the org's custom roles plus the default system role templates (read-only
 * view + "duplicate as custom"). Route-gated on `can('admin','read','roles')`
 * once usePermissions is ready (fail-open during the RBAC log rollout).
 */
export default function RolesPage() {
  const { userId, organizationId: orgId, tier, isLoading } = useMe();
  const { tr } = useLang();

  const { can, isReady, isAdmin, isOwner } = usePermissions();
  const eligible = tier === "enterprise" && isReady && (isAdmin || isOwner);
  const rolesQuery = useOrgRoles(eligible ? userId : undefined, eligible ? orgId : undefined);
  const deleteRole = useDeleteRole();

  const [drawer, setDrawer] = useState<DrawerState>(DRAWER_CLOSED);
  const [actionError, setActionError] = useState<string | null>(null);
  const [pendingDelete, setPendingDelete] = useState<RoleDto | null>(null);

  // platform_admin is never org-assignable — hide it defensively even though
  // the backend excludes it from the templates list (V6).
  const visibleRoles = useMemo(
    () => (rolesQuery.data ?? []).filter((r) => r.name !== "platform_admin"),
    [rolesQuery.data]
  );
  const customRoles = useMemo(() => visibleRoles.filter((r) => !r.isSystem), [visibleRoles]);
  const systemRoles = useMemo(() => visibleRoles.filter((r) => r.isSystem), [visibleRoles]);

  const canRead = can("admin", "read", "roles");
  const canCreate = can("admin", "create", "roles");
  const canUpdate = can("admin", "update", "roles");
  const canDelete = can("admin", "delete", "roles");

  const openCreate = () => {
    setActionError(null);
    setDrawer({ open: true, role: null, duplicateFrom: null, readOnly: false });
  };
  const openEdit = (role: RoleDto) => {
    setActionError(null);
    setDrawer({ open: true, role, duplicateFrom: null, readOnly: false });
  };
  const openView = (role: RoleDto) => {
    setActionError(null);
    setDrawer({ open: true, role: null, duplicateFrom: role, readOnly: true });
  };
  const openDuplicate = (role: RoleDto) => {
    setActionError(null);
    setDrawer({ open: true, role: null, duplicateFrom: role, readOnly: false });
  };

  const confirmDelete = async () => {
    if (!userId || !orgId || !pendingDelete) return;
    setActionError(null);
    try {
      await deleteRole.mutateAsync({ userId, orgId, roleId: pendingDelete.id });
      setPendingDelete(null);
    } catch (err) {
      // 409 when organization_members still reference the role (O8).
      setActionError(err instanceof RoleInUseError ? tr.roles_delete_in_use : tr.roles_delete_failed);
      setPendingDelete(null);
    }
  };

  // Route gating — only enforced once my-permissions resolves (fail-open during
  // the RBAC log rollout).
  if (isLoading || (!isReady && tier === "enterprise")) return <p className="p-8 text-muted-foreground">{tr.loading}</p>;
  if (!eligible || !canRead) {
    return (
      <>
        <Card className="p-8 text-center max-w-md mx-auto mt-10">
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
            <Icon name="lock" size={20} className="text-muted-foreground" />
          </div>
          <h2 className="text-lg font-bold mb-1">{tr.roles_no_access_title}</h2>
          <p className="text-sm text-muted-foreground">{tr.roles_enterprise_admin_only}</p>
        </Card>
      </>
    );
  }

  const renderRoleCard = (role: RoleDto) => {
    const isSystem = role.isSystem;
    const label = roleLabel(tr, role.name, role.displayName);
    const descText = roleDescription(tr, role.name, role.description);
    return (
      <Card key={role.id} className="p-4 flex items-center gap-3.5 flex-wrap">
        <div
          className={`flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full ${
            isSystem ? "bg-muted text-muted-foreground" : "bg-primary/[0.12] text-primary"
          }`}
        >
          <Icon name="shield" size={18} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-sm font-semibold text-foreground truncate">{label}</span>
            <Badge variant={isSystem ? "secondary" : "default"}>
              {isSystem ? tr.roles_system_badge : tr.roles_custom_badge}
            </Badge>
            {!role.isActive && <Badge variant="warning">{tr.roles_inactive_badge}</Badge>}
          </div>
          {descText && <div className="text-[13px] text-muted-foreground truncate">{descText}</div>}
        </div>
        <div className="flex items-center gap-1.5 ml-auto">
          {isSystem ? (
            <>
              <Button variant="ghost" size="sm" icon="eye" onClick={() => openView(role)}>
                {tr.roles_view}
              </Button>
              {canCreate && (
                <Button variant="outline" size="sm" icon="copy" onClick={() => openDuplicate(role)}>
                  {tr.roles_duplicate}
                </Button>
              )}
            </>
          ) : (
            <>
              <Button
                variant="ghost"
                size="sm"
                icon={canUpdate ? "edit" : "eye"}
                onClick={() => (canUpdate ? openEdit(role) : openView(role))}
              >
                {canUpdate ? tr.roles_edit : tr.roles_view}
              </Button>
              {canCreate && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="copy"
                  aria-label={tr.roles_duplicate}
                  title={tr.roles_duplicate}
                  onClick={() => openDuplicate(role)}
                />
              )}
              {canDelete && (
                <Button
                  variant="ghost"
                  size="sm"
                  icon="trash"
                  className="text-destructive"
                  aria-label={tr.roles_delete}
                  title={tr.roles_delete}
                  onClick={() => setPendingDelete(role)}
                />
              )}
            </>
          )}
        </div>
      </Card>
    );
  };

  const renderSkeletons = (count: number) => (
    <div className="flex flex-col gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="p-4 flex items-center gap-3">
          <div className="h-10 w-10 rounded-full bg-muted animate-pulse" />
          <div className="flex-1">
            <div className="h-4 w-40 mb-2 rounded bg-muted animate-pulse" />
            <div className="h-3 w-56 rounded bg-muted/60 animate-pulse" />
          </div>
        </Card>
      ))}
    </div>
  );

  return (
    <>
      <div className="max-w-[1100px] mx-auto">
        {/* Header */}
        <div className="flex justify-between items-start mb-7 flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold mb-1.5">{tr.roles_title}</h1>
            <p className="text-sm text-muted-foreground">{tr.roles_subtitle}</p>
          </div>
          {canCreate && (
            <Button variant="primary" size="sm" icon="plus" onClick={openCreate}>
              {tr.roles_new}
            </Button>
          )}
        </div>

        {actionError && (
          <div className="mb-5 rounded-md border border-destructive/40 bg-destructive/[0.08] px-3 py-2.5">
            <span className="text-sm text-destructive">{actionError}</span>
          </div>
        )}

        {rolesQuery.isError ? (
          <div className="flex flex-col items-start gap-3">
            <div className="w-full rounded-md border border-destructive/40 bg-destructive/[0.08] px-3 py-2.5">
              <span className="text-sm text-destructive">{tr.roles_load_error}</span>
            </div>
            <Button variant="outline" size="sm" icon="refresh" onClick={() => rolesQuery.refetch()}>
              {tr.roles_retry}
            </Button>
          </div>
        ) : (
          <>
            {/* Custom org roles */}
            <div className="t-label mb-3 flex items-center gap-2">
              <Icon name="shield" size={13} />
              {tr.roles_custom_section}
            </div>
            {rolesQuery.isLoading ? (
              renderSkeletons(2)
            ) : customRoles.length === 0 ? (
              <Card className="p-6 text-center">
                <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
                  <Icon name="shield" size={20} className="text-muted-foreground" />
                </div>
                <h3 className="text-sm font-semibold mb-1">{tr.roles_no_custom_roles}</h3>
                <p className="text-sm text-muted-foreground mb-3">
                  {tr.roles_no_custom_roles_description}
                </p>
                {canCreate && (
                  <Button variant="primary" size="sm" icon="plus" onClick={openCreate}>
                    {tr.roles_new}
                  </Button>
                )}
              </Card>
            ) : (
              <div className="flex flex-col gap-3">{customRoles.map(renderRoleCard)}</div>
            )}

            {/* System role templates */}
            <div className="mt-10">
              <div className="t-label mb-3 flex items-center gap-2">
                <Icon name="lock" size={13} />
                {tr.roles_system_section}
              </div>
              {rolesQuery.isLoading ? (
                renderSkeletons(3)
              ) : systemRoles.length === 0 ? (
                <Card className="p-5 text-center">
                  <p className="text-sm text-muted-foreground">{tr.roles_no_system_roles}</p>
                </Card>
              ) : (
                <div className="flex flex-col gap-3">{systemRoles.map(renderRoleCard)}</div>
              )}
            </div>
          </>
        )}

        <RoleDrawerForm
          open={drawer.open}
          onClose={() => setDrawer(DRAWER_CLOSED)}
          role={drawer.role}
          duplicateFrom={drawer.duplicateFrom}
          readOnly={drawer.readOnly}
          onDuplicate={
            drawer.readOnly && drawer.duplicateFrom
              ? () => setDrawer((cur) => ({ ...cur, readOnly: false }))
              : undefined
          }
        />

        <Modal
          open={!!pendingDelete}
          onClose={() => setPendingDelete(null)}
          variant="destructive"
          icon="trash"
          title={tr.roles_delete_title}
          description={
            pendingDelete
              ? tr.roles_delete_confirm.replace("{name}", pendingDelete.displayName)
              : undefined
          }
          cancelLabel={tr.common_cancel}
          confirm={{
            label: tr.roles_delete,
            variant: "destructive",
            onClick: confirmDelete,
            loading: deleteRole.isPending,
          }}
        />
      </div>
    </>
  );
}
