/**
 * RBAC FE DTOs — mirror of sokol-api `src/dtos/rbac_dto.py` + `me_dto.py`
 * (FCR-023 / FCR-061). Response bodies are camelCase (the BE serializes via
 * `by_alias`); request bodies accept camelCase (the BE `populate_by_name`).
 *
 * Vocabulary (rbac-org-modules skill):
 *   - a *permission* is the flattened "module:submodule:action" string;
 *   - a *grant* row is { moduleId, submoduleId?, actionId } — submoduleId null
 *     means a module-wide grant;
 *   - the *available matrix* (O2) is the org-filtered grantable matrix, the
 *     ONLY source the FE renders the permission matrix from.
 */

/** GET /me — identity + tenancy context (MeResponse). */
export interface MeResponse {
  userId: string;
  organizationId: string;
  email: string | null;
  /** Platform role (e.g. "platform_admin") when applicable. */
  platformRole: string | null;
  /** The member's role name in the org (may be null). */
  role: string | null;
  /** Org subscription tier: free | pro | enterprise. */
  tier: string;
  usage?: { plan?: { name_es: string; name_en: string; description_es: string; description_en: string }; unit: "tokens"; used: number; limit: number; remaining: number; reset: string; maxSavedProjects: number | null; seats: number };
}

/** A role row (system template or org custom role) — RoleResponse. */
export interface RoleDto {
  id: string;
  organizationId: string | null;
  name: string;
  displayName: string;
  description: string | null;
  isSystem: boolean;
  isActive: boolean;
  createdAt: string | null;
  updatedAt: string | null;
}

/** RoleListResponse envelope (O3/O4). */
export interface RoleListResponse {
  data: RoleDto[];
  total: number;
}

/** A catalog action (global verb) — ActionResponse (O13). */
export interface ActionDto {
  id: string;
  name: string;
}

/** ActionListResponse envelope (O13). */
export interface ActionListResponse {
  data: ActionDto[];
  total: number;
}

/** A presence-based grant row. submoduleId null = module-wide grant. */
export interface PermissionGrantDto {
  moduleId: string;
  submoduleId: string | null;
  actionId: string;
}

/** RolePermissionsResponse (O9 / O10). */
export interface RolePermissionsResponse {
  roleId: string;
  permissions: PermissionGrantDto[];
}

/** SetRolePermissionsRequest body (O10). */
export interface SetRolePermissionsRequest {
  permissions: PermissionGrantDto[];
}

/** RoleCreate body (O6). */
export interface RoleCreateRequest {
  name: string;
  displayName: string;
  description?: string;
}

/** RoleUpdate body (O7) — all optional. */
export interface RoleUpdateRequest {
  displayName?: string;
  description?: string;
  isActive?: boolean;
}

/** My-permissions (O1) — FE nav/action gating (MyPermissionsResponse). */
export interface MyPermissionsDto {
  organizationId: string;
  role: RoleDto | null;
  /** role.name === 'owner' */
  isOwner: boolean;
  /** owner || admin */
  isAdmin: boolean;
  /** Module names available AND reachable by this role (nav gating). */
  modules: string[];
  /**
   * Flattened effective grants, format "module:submodule:action".
   * Module-wide grants are EXPANDED per available submodule by the backend.
   */
  permissions: string[];
}

/**
 * Available-matrix submodule (O2). NOTE the BE shape: `submoduleId` (not `id`)
 * and `actions` is a list of action NAME strings (not action objects) — the
 * grantable verbs come straight from submodule_actions by name.
 */
export interface MatrixSubmodule {
  name: string;
  displayName: string;
  submoduleId: string;
  /** Grantable action names (e.g. ["read","create",...]). */
  actions: string[];
}

export interface MatrixModule {
  name: string;
  displayName: string;
  moduleId: string;
  icon: string | null;
  submodules: MatrixSubmodule[];
}

/**
 * Org-scoped available matrix (O2) — already intersected with the org's module
 * assignment. Render ONLY what it returns.
 */
export interface AvailableMatrixDto {
  organizationId: string;
  modules: MatrixModule[];
}

/** SetMemberRoleRequest (O11). */
export interface SetMemberRoleRequest {
  roleId: string;
}

export interface UserRoleResponse {
  organizationId: string;
  userId: string;
  memberId: string;
  role: RoleDto | null;
}

/** CheckPermission (O14). */
export interface CheckPermissionRequest {
  module: string;
  action: string;
  submodule?: string;
}

export interface CheckPermissionResponse {
  allowed: boolean;
  module: string;
  action: string;
  submodule: string | null;
}
