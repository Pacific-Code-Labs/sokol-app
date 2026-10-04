/**
 * useProjects (FCR-025) — server-backed project state on TanStack Query.
 *
 * Moved off localStorage onto the authenticated /projects* API. The hook keeps
 * the same surface the pages rely on (`projects`, `loading`, `create`, `remove`,
 * `get`, `update`) so Projects/NewProject/ProjectDetail/Dashboard keep working,
 * but `create`/`update`/`remove` are now async mutations and `get` returns from
 * the cached list (use `useProject(id)` for a guaranteed fresh single fetch).
 *
 * The page-facing `Project` shape stays stable: `building_type` is the numeric
 * `BuildingType` enum and timestamps are `createdAt`. Mapping to/from the BE
 * DTO (lowercase string building types + camelCase aliases) lives here.
 *
 * Quota: `create`/`update` surface the BE's HTTP 402 saved-projects limit as a
 * typed `QuotaError` (from sokolApi). Call sites catch it and open the
 * UpgradeModal (FCR-026).
 */
import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/AuthContext";
import {
  sokolApi,
  BuildingType,
  type ProjectResponse,
  type ProjectBuildingType,
  type ProjectCreateRequest,
  type ProjectUpdateRequest,
  type ElectricalSnapshot,
} from "@/services/sokolApi";

export type RiskLevel = "low" | "medium" | "high";

/** Page-facing project shape (numeric building_type, flat metric fields). */
export interface Project {
  id: string;
  name: string;
  notes?: string;
  building_type: BuildingType;
  usage: string;
  area_m2: number;
  floors?: number;
  occupants?: number;
  ceiling_height_m?: number;
  volume_m3?: number;
  risk?: RiskLevel;
  requirements?: string[];
  reference?: string[];
  contextCr?: string[];
  /** FCR-118: 'fire' (default) | 'electrical'. */
  projectType?: string;
  /** FCR-118: the saved electrical-study snapshot (electrical projects only). */
  electrical?: ElectricalSnapshot;
  createdAt: string;
  updatedAt?: string;
}

/** Fields a caller supplies when creating a project (no id/createdAt). */
export type NewProjectInput = Omit<Project, "id" | "createdAt" | "updatedAt">;

export const projectKeys = {
  all: ["projects"] as const,
  list: () => [...projectKeys.all, "list"] as const,
  detail: (id: string) => [...projectKeys.all, "detail", id] as const,
};

// ── BuildingType <-> backend string mapping ───────────────────────────────────

const BT_TO_STRING: Record<BuildingType, ProjectBuildingType> = {
  [BuildingType.residencial]: "residencial",
  [BuildingType.comercial]: "comercial",
  [BuildingType.industrial]: "industrial",
};

const STRING_TO_BT: Record<ProjectBuildingType, BuildingType> = {
  residencial: BuildingType.residencial,
  comercial: BuildingType.comercial,
  industrial: BuildingType.industrial,
};

function normalizeRisk(raw?: string | null): RiskLevel | undefined {
  if (!raw) return undefined;
  const r = raw.toLowerCase();
  if (r.includes("alto") || r.includes("high")) return "high";
  if (r.includes("medio") || r.includes("medium")) return "medium";
  if (r.includes("bajo") || r.includes("low")) return "low";
  return undefined;
}

/** BE ProjectResponse → page-facing Project. */
function fromResponse(r: ProjectResponse): Project {
  return {
    id: r.id,
    name: r.name,
    notes: r.notes ?? undefined,
    building_type: STRING_TO_BT[r.buildingType] ?? BuildingType.comercial,
    usage: r.usage,
    area_m2: r.areaM2 ?? 0,
    floors: r.floors ?? undefined,
    occupants: r.occupants ?? undefined,
    ceiling_height_m: r.ceilingHeightM ?? undefined,
    volume_m3: r.volumeM3 ?? undefined,
    risk: normalizeRisk(r.risk),
    requirements: r.requirements,
    reference: r.reference,
    contextCr: r.contextCr,
    projectType: r.projectType,
    electrical: r.electrical ?? undefined,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
  };
}

/** Page-facing NewProjectInput → BE ProjectCreate body. */
function toCreateBody(p: NewProjectInput): ProjectCreateRequest {
  return {
    name: p.name,
    notes: p.notes,
    building_type: BT_TO_STRING[p.building_type] ?? "comercial",
    usage: p.usage,
    area_m2: p.area_m2,
    floors: p.floors,
    occupants: p.occupants,
    ceiling_height_m: p.ceiling_height_m,
    volume_m3: p.volume_m3,
    requirements: p.requirements,
    reference: p.reference,
    context_cr: p.contextCr,
    // The BE requires a non-empty risk string; map our level back to a label.
    risk: p.risk ?? "indeterminado",
  };
}

/** Partial page-facing patch → BE ProjectUpdate body (only defined keys). */
function toUpdateBody(patch: Partial<Project>): ProjectUpdateRequest {
  const body: ProjectUpdateRequest = {};
  if (patch.notes !== undefined) body.notes = patch.notes;
  if (patch.name !== undefined) body.name = patch.name;
  if (patch.building_type !== undefined) body.building_type = BT_TO_STRING[patch.building_type];
  if (patch.usage !== undefined) body.usage = patch.usage;
  if (patch.area_m2 !== undefined) body.area_m2 = patch.area_m2;
  if (patch.floors !== undefined) body.floors = patch.floors;
  if (patch.occupants !== undefined) body.occupants = patch.occupants;
  if (patch.ceiling_height_m !== undefined) body.ceiling_height_m = patch.ceiling_height_m;
  if (patch.volume_m3 !== undefined) body.volume_m3 = patch.volume_m3;
  if (patch.requirements !== undefined) body.requirements = patch.requirements;
  if (patch.reference !== undefined) body.reference = patch.reference;
  if (patch.contextCr !== undefined) body.context_cr = patch.contextCr;
  if (patch.risk !== undefined) body.risk = patch.risk;
  return body;
}

/**
 * List + mutations. Keeps the legacy hook surface; `create`/`update`/`remove`
 * are now async and may throw `QuotaError` (402) which the caller surfaces via
 * the UpgradeModal.
 */
export function useProjects() {
  const qc = useQueryClient();
  // /projects is authenticated — only fetch when a Cognito user is present.
  // BillingProvider mounts this hook globally (incl. the public landing/demo
  // pages); without this gate a guest would fire /projects → 401.
  const { user } = useAuth();

  const listQuery = useQuery({
    queryKey: projectKeys.list(),
    queryFn: async () => {
      // BE caps page_size at 100; the workspace is small, fetch the first page.
      const res = await sokolApi.listProjects({ page: 0, page_size: 100 });
      return res.data.map(fromResponse);
    },
    enabled: !!user,
  });

  const createMut = useMutation({
    mutationFn: (input: NewProjectInput) => sokolApi.createProject(toCreateBody(input)),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });

  const updateMut = useMutation({
    mutationFn: ({ id, patch }: { id: string; patch: Partial<Project> }) =>
      sokolApi.updateProject(id, toUpdateBody(patch)),
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: projectKeys.list() });
      qc.invalidateQueries({ queryKey: projectKeys.detail(vars.id) });
    },
  });

  const deleteMut = useMutation({
    mutationFn: (id: string) => sokolApi.deleteProject(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: projectKeys.all }),
  });

  const projects = useMemo(() => listQuery.data ?? [], [listQuery.data]);

  /** Create a project; resolves to the created Project. May throw QuotaError. */
  const create = useCallback(
    (input: NewProjectInput) => createMut.mutateAsync(input).then(fromResponse),
    [createMut],
  );

  /** Update a project (partial). May throw QuotaError. */
  const update = useCallback(
    (id: string, patch: Partial<Project>) => updateMut.mutateAsync({ id, patch }).then(fromResponse),
    [updateMut],
  );

  /** Delete a project. */
  const remove = useCallback((id: string) => deleteMut.mutateAsync(id), [deleteMut]);

  /** Lookup from the cached list (sync). Use useProject(id) for a fresh fetch. */
  const get = useCallback((id: string) => projects.find((p) => p.id === id), [projects]);

  return {
    projects,
    loading: listQuery.isLoading,
    error: listQuery.error,
    create,
    update,
    remove,
    get,
    creating: createMut.isPending,
    updating: updateMut.isPending,
    deleting: deleteMut.isPending,
  };
}

/** Single-project detail query (guaranteed fresh fetch, null on 404). */
export function useProject(id: string) {
  const query = useQuery({
    queryKey: projectKeys.detail(id),
    queryFn: async () => {
      const res = await sokolApi.getProject(id);
      return res ? fromResponse(res) : null;
    },
    enabled: !!id,
  });
  return { project: query.data ?? undefined, loading: query.isLoading, error: query.error };
}
