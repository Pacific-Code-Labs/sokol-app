/**
 * Sóköl — API service
 *
 * All requests are SigV4-signed automatically via the Cognito Identity Pool
 * anonymous credentials configured in src/config/amplify.ts.
 * No login required — every visitor gets a unique anonymous IdentityId.
 *
 * Usage:
 *   import "../config/amplify";   // configure once in main.tsx
 *   const groups = await sokolApi.getRules({ building_type: "comercial" });
 */

import { get, post, put, del } from "aws-amplify/api";
import { authHeader } from "./authToken";

// ── DTOs matching the backend contract ───────────────────────────────────────

export interface RiskDTO {
  level: string;
  impact: string;
  consequence: string;
}

export interface RuleDTO {
  id: string;
  standard: string;
  title: string;
  category: string;
  description: string;
  risk: RiskDTO;
  technical_requirements: string[];
  installation_requirements: string[];
  inspection_requirements: string[];
  failure_risks: string[];
  applies_to: string[];
  conditions: string[];
  keywords: string[];
}

export interface RuleGroupDTO {
  type: string;
  description: string;
  quantity: number;
  rules: RuleDTO[];
}

export enum BuildingType {
  residencial = 1,
  comercial   = 2,
  industrial  = 3,
}

export enum RuleCategory {
  iniciacion    = 1,
  notificacion  = 2,
  monitoreo     = 3,
  accionamiento = 4,
}

export interface PaginationResponse {
  page: number;
  pageSize: number;
  totalElements: number;
  totalPages: number;
}

export interface RuleListResponse {
  data: RuleGroupDTO[];
  pagination: PaginationResponse;
}

export type Language = "es" | "en";

export interface GetRulesParams {
  building_type?: BuildingType;
  category?: RuleCategory;
  usage?: string;
  area_m2?: number;
  floors?: number;
  occupants?: number;
  ceiling_height_m?: number;
  volume_m3?: number;
  standard?: string;
  page?: number;
  page_size?: number;
  /** Dataset + label language (es | en). Defaults to "es" on the backend. */
  language?: Language;
}

/** A single prior conversation turn replayed to the agent (FCR-042). */
export interface ConversationTurn {
  role: "user" | "assistant";
  content: string;
}

/** Where the user is in the app when asking (FCR-042). The public demo uses "demo". */
export interface EvaluateContext {
  page: "dashboard" | "projects" | "project_detail" | "evaluation" | "demo" | "other";
  project?: Record<string, unknown> | null;
  /** FCR-109: guided-demo step (DEMO MODE only) — teaser | full_evaluation | project. */
  demo_step?: "teaser" | "full_evaluation" | "project";
}

export interface EvaluateRequest {
  /** FCR-044: optional — send the real selected value or omit; never fabricate. */
  building_type?: BuildingType;
  /** FCR-044: optional — send the real selected value or omit; never fabricate. */
  usage?: string;
  user_query: string;
  area_m2?: number;
  floors?: number;
  occupants?: number;
  ceiling_height_m?: number;
  volume_m3?: number;
  category?: RuleCategory;
  standard?: string;
  /** Response + dataset language (es | en). Defaults to "es" on the backend. */
  language?: Language;
  /** FCR-042: trimmed prior turns (most recent last), excludes current user_query. */
  conversation?: ConversationTurn[];
  /**
   * FCR-042: page + optional project for conversational continuity.
   * FCR-047: demo mode is derived from `context.page === "demo"` (no separate
   * flag) — the public /demo page sets it; the BE forces it on /demo/evaluate.
   */
  context?: EvaluateContext;
}

/**
 * 429 CTA payload returned by POST /demo/evaluate when a visitor exceeds the
 * daily demo evaluation cap (FCR-047). Surfaced to callers as DemoLimitError.
 */
export interface DemoLimitResponse {
  type: "demo_limit";
  message: string;
  limit: number;
  cta: string;
  ctaAction: "signup" | "upgrade";
  ctaHref: string;
}

/** Thrown by sokolApi.evaluateDemo on HTTP 429 (demo daily cap reached). */
export class DemoLimitError extends Error {
  readonly payload: DemoLimitResponse;
  constructor(payload: DemoLimitResponse) {
    super(payload.message);
    this.name = "DemoLimitError";
    this.payload = payload;
  }
}

/**
 * FCR-026: plan-quota payload. The backend returns this typed body on:
 *   - HTTP 402 from POST/PUT /projects (saved-projects limit reached), and
 *   - HTTP 429 from POST /evaluate (monthly evaluate quota reached) — there it
 *     also carries `remaining` + `reset` and is mirrored on X-Quota-* headers.
 * The FE renders it as the UpgradeModal call-to-action.
 */
export interface QuotaExceededBody {
  type: "quota_exceeded";
  message: string;
  limit: number;
  current?: number;
  /** "saved_projects" (402) | "evaluate" (429, from headers when body omits it). */
  resource?: string;
  tier?: string;
  remaining?: number;
  reset?: string;
  ctaAction?: "upgrade";
}

/**
 * Thrown by the authenticated project + evaluate methods when an org hits a
 * plan quota. `kind` tells the UI which limit was hit so the modal can tailor
 * its copy; `status` is the raw HTTP code (402 saved-projects | 429 evaluate).
 */
export class QuotaError extends Error {
  readonly payload: QuotaExceededBody;
  readonly kind: "saved_projects" | "evaluate";
  readonly status: 402 | 429;
  constructor(payload: QuotaExceededBody, status: 402 | 429) {
    super(payload.message);
    this.name = "QuotaError";
    this.payload = payload;
    this.status = status;
    this.kind = status === 402 ? "saved_projects" : "evaluate";
  }
}

// ── Project DTOs (mirror sokol-api src/dtos/project_dto.py) ────────────────

/** Backend stores building_type as a lowercase string enum. */
export type ProjectBuildingType = "residencial" | "comercial" | "industrial";

/** Request body for POST /projects (ProjectCreate). */
export interface ProjectCreateRequest {
  name: string;
  /** FCR-102: 'fire' (default) | 'electrical'. */
  project_type?: string;
  building_type: ProjectBuildingType;
  usage: string;
  area_m2?: number;
  floors?: number;
  occupants?: number;
  ceiling_height_m?: number;
  volume_m3?: number;
  requirements?: string[];
  reference?: string[];
  context_cr?: string[];
  /** FCR-102: { inputs, topology, result } snapshot for electrical projects. */
  electrical?: { inputs: ElectricalInputs; topology: Topology; result: ElectricalLoadData };
  risk: string;
}

/** FCR-118: the persisted electrical-study snapshot nested inside a project. */
export interface ElectricalSnapshot {
  inputs: ElectricalInputs;
  topology: Topology;
  result: ElectricalLoadData;
}

/** Request body for PUT /projects/{id} (ProjectUpdate) — all fields optional. */
export type ProjectUpdateRequest = Partial<ProjectCreateRequest>;

/** Response body for project operations (ProjectResponse, camelCase aliases). */
export interface ProjectResponse {
  id: string;
  name: string;
  buildingType: ProjectBuildingType;
  usage: string;
  areaM2?: number | null;
  floors?: number | null;
  occupants?: number | null;
  ceilingHeightM?: number | null;
  volumeM3?: number | null;
  requirements: string[];
  reference: string[];
  contextCr: string[];
  risk: string;
  /** FCR-102/118: 'fire' (default) | 'electrical'. */
  projectType?: string;
  /** FCR-118: present for electrical projects — the saved study snapshot. */
  electrical?: ElectricalSnapshot | null;
  createdAt: string;
  updatedAt: string;
}

/** Response body for GET /projects (ProjectListResponse). */
export interface ProjectListResponse {
  data: ProjectResponse[];
  total: number;
  page: number;
  pageSize: number;
}

export interface ListProjectsParams {
  page?: number;
  page_size?: number;
  building_type?: ProjectBuildingType;
  usage?: string;
}

/** Structured Costa-Rica regulatory context entry (FCR-043). */
export interface CrContextItem {
  topic: string;
  detail: string;
  authority?: string | null;
  reference?: string | null;
}

export interface EvaluateResponse {
  matchedRules: RuleDTO[];
  requirements: string[];
  reference: string[];
  /** FCR-043: structured. May still be string[] from older backends. */
  contextCr: CrContextItem[];
  risk: string;
  foundryUsed: boolean;
}

/** FCR-101: a single clarifying question the agent needs answered. */
export interface NeedsInfoQuestion {
  key: string;
  label: string;
  /** FCR-114: dynamic input types — `select` = one option, `multi_select` = many. */
  type?: "text" | "number" | "select" | "multi_select";
  required?: boolean;
  hint?: string;
  options?: string[];
}

/** FCR-101: `needs_info` response payload — structured questions + inferred context. */
export interface NeedsInfoData {
  questions: NeedsInfoQuestion[];
  context?: Record<string, unknown>;
}

// ── Electrical preliminary-load (FCR-102+) ───────────────────────────────────
// camelCase on the wire, mirroring ProjectResponse aliases. The agent emits
// ElectricalInputs in its action payload; the interactive editor posts
// { inputs, topology? } to POST /electrical/preliminary (authenticated,
// deterministic, no Foundry, NOT eval-quota-gated) and receives an
// ElectricalLoadData snapshot the FE uses to drive the load table / kVA.

export type ElectricalOccupancy =
  | "residencial"
  | "comercial"
  | "industrial"
  | "social_interest";

/** 1ph 120/240 ; 3-wire 120/208 ; 3ph. */
export type ElectricalServiceType =
  | "single_phase"
  | "network_3h"
  | "three_phase";

export interface ElectricalMotorLoad {
  name?: string;
  hp?: number;
  kw?: number;
  quantity?: number;
}

export interface ElectricalOtherLoad {
  name: string;
  va: number;
}

export interface ElectricalSpecialLoads {
  range_va?: number;
  water_heater_va?: number;
  ac_va?: number;
  other?: ElectricalOtherLoad[];
  motors?: ElectricalMotorLoad[];
}

/** Agent emits this in its action payload; the FE editor posts it. */
export interface ElectricalInputs {
  occupancy: ElectricalOccupancy;
  area_m2: number;
  floors?: number;
  service: ElectricalServiceType;
  voltage?: number;
  special_loads?: ElectricalSpecialLoads;
  /** Fraction e.g. 0.25; default 0. */
  growth_allowance?: number;
  language?: Language;
}

// ── Topology (editable single-line diagram) ──────────────────────────────────

export type TopologyNodeType =
  | "utility"
  | "meter"
  | "main_breaker"
  | "spd"
  | "panel"
  | "load";

export type TopologyPhase = "A" | "B" | "C" | "ABC";

export interface TopologyNodeData {
  va?: number;
  rating?: string;
  phase?: TopologyPhase;
  note?: string;
}

export interface TopologyNode {
  id: string;
  type: TopologyNodeType;
  label: string;
  data?: TopologyNodeData;
}

export interface TopologyEdge {
  id: string;
  source: string;
  target: string;
}

export interface Topology {
  nodes: TopologyNode[];
  edges: TopologyEdge[];
}

// ── ElectricalLoadResponse (BE -> FE, camelCase aliases) ──────────────────────

export interface LoadTableRow {
  description: string;
  connectedVa: number;
  demandFactor: number;
  demandedVa: number;
  phase?: string;
}

export interface MandatedProvision {
  code: string;
  requirement: string;
  reference: string;
  status: "required" | "info";
}

export interface PhaseBalanceEntry {
  phase: string;
  va: number;
}

export interface ElectricalLoadData {
  occupancy: string;
  serviceType: string;
  installedVa: number;
  demandedVa: number;
  demandKva: number;
  suggestedTransformerKva: number;
  loadTable: LoadTableRow[];
  phaseBalance: PhaseBalanceEntry[];
  topology: Topology;
  mandatedProvisions: MandatedProvision[];
  assumptions: string[];
  references: string[];
  disclaimer: string;
  notes?: string;
}

/** Request body for POST /electrical/preliminary. */
export interface ElectricalPreliminaryRequest {
  inputs: ElectricalInputs;
  topology?: Topology;
}

// ── API client ───────────────────────────────────────────────────────────────

const API_NAME = "SokolApi";

function toQueryString(params: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(params)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => [k, String(v)])
  );
}

async function resolveBody<T>(op: { response: Promise<{ body: { json: () => Promise<unknown> } }> }): Promise<T> {
  const resp = await op.response;
  return (await resp.body.json()) as T;
}

export const sokolApi = {
  /**
   * GET /rules — returns rules grouped by fire protection category.
   * All params are optional; omitting them returns all groups.
   */
  async getRules(params: GetRulesParams = {}): Promise<RuleListResponse> {
    return resolveBody<RuleListResponse>(
      get({
        apiName: API_NAME,
        path: "/rules",
        options: { queryParams: toQueryString(params as Record<string, unknown>) },
      })
    );
  },

  /**
   * GET /rules/{ruleId} — fetch a single rule by ID.
   * Returns null when the rule is not found (404).
   */
  async getRuleById(ruleId: string): Promise<RuleDTO | null> {
    try {
      return await resolveBody<RuleDTO>(
        get({ apiName: API_NAME, path: `/rules/${encodeURIComponent(ruleId)}` })
      );
    } catch (err: unknown) {
      if (isNotFound(err)) return null;
      throw err;
    }
  },

  /**
   * POST /evaluate — run deterministic filter + AI agent evaluation.
   * `foundryUsed` in the response indicates whether the AI was reached.
   * Authenticated route (FCR-010) — used by the signed-in dashboard assistant.
   */
  async evaluate(request: EvaluateRequest): Promise<EvaluateResponse> {
    // FCR-010: authenticated route — send the Cognito access token as a Bearer
    // header so API Gateway's User Pool authorizer accepts the call. Public
    // routes (/rules, /health, /demo/*) intentionally send no Authorization
    // header and keep the SigV4/guest path.
    const headers = await authHeader();
    try {
      return await resolveBody<EvaluateResponse>(
        post({
          apiName: API_NAME,
          path: "/evaluate",
          options: { headers, body: request as unknown as Record<string, unknown> as never },
        })
      );
    } catch (err: unknown) {
      // FCR-026: the evaluate-quota gate pre-blocks with HTTP 429 + a typed
      // quota_exceeded body (+ X-Quota-* headers). Surface it as QuotaError so
      // the assistant renders the UpgradeModal instead of a generic error.
      const quota = await parseQuota(err, 429);
      if (quota) throw quota;
      throw err;
    }
  },

  /**
   * POST /demo/evaluate — PUBLIC, throttled demo evaluation (FCR-047).
   *
   * Used by the public /demo page (not the authenticated /evaluate). The backend
   * forces demo mode (teaser answer, never creates a project) and caps successful
   * AI evals per visitor per day; on exceed it returns HTTP 429 with a sign-up CTA
   * payload, which this method rethrows as a typed DemoLimitError so the UI can
   * render the call-to-action instead of a generic error.
   */
  async evaluateDemo(request: EvaluateRequest): Promise<EvaluateResponse> {
    // Demo mode is signalled by context.page === "demo" (no flag). Force it here
    // too so the BE enters DEMO MODE even if a caller omitted the context.
    const body = {
      ...request,
      context: { ...(request.context ?? {}), page: "demo" as const, project: request.context?.project ?? null },
    } as unknown as Record<string, unknown>;
    try {
      return await resolveBody<EvaluateResponse>(
        post({
          apiName: API_NAME,
          path: "/demo/evaluate",
          options: { body: body as never },
        })
      );
    } catch (err: unknown) {
      const limit = await parseDemoLimit(err);
      if (limit) throw new DemoLimitError(limit);
      throw err;
    }
  },

  /**
   * POST /demo/electrical — PUBLIC, deterministic preliminary electrical study
   * for the guided demo's 4th step (FCR-118). No auth, no Foundry, no quota; the
   * same ElectricalCalcService that powers the authenticated editor. Sends no
   * Authorization header (keeps the SigV4/guest path like the other /demo/*).
   */
  async evaluateDemoElectrical(inputs: ElectricalInputs): Promise<ElectricalLoadData> {
    return resolveBody<ElectricalLoadData>(
      post({
        apiName: API_NAME,
        path: "/demo/electrical",
        options: { body: inputs as unknown as Record<string, unknown> as never },
      })
    );
  },

  // ── Projects (FCR-025) — AUTHENTICATED CRUD against /projects* ──────────────
  // All send Authorization: Bearer <accessToken> via authHeader(). The
  // saved-projects limit surfaces as HTTP 402 → QuotaError (FCR-026).

  /** GET /projects — paginated list, optional building_type/usage filters. */
  async listProjects(params: ListProjectsParams = {}): Promise<ProjectListResponse> {
    const headers = await authHeader();
    return resolveBody<ProjectListResponse>(
      get({
        apiName: API_NAME,
        path: "/projects",
        options: {
          headers,
          queryParams: toQueryString(params as Record<string, unknown>),
        },
      })
    );
  },

  /** GET /projects/{id} — single project, or null on 404. */
  async getProject(id: string): Promise<ProjectResponse | null> {
    const headers = await authHeader();
    try {
      return await resolveBody<ProjectResponse>(
        get({ apiName: API_NAME, path: `/projects/${encodeURIComponent(id)}`, options: { headers } })
      );
    } catch (err: unknown) {
      if (isNotFound(err)) return null;
      throw err;
    }
  },

  /** POST /projects — create. Throws QuotaError on HTTP 402 (saved-projects limit). */
  async claimDemoProject(body: { draftId: string; claimToken: string }): Promise<{ projectId: string }> {
    const headers = await authHeader();
    try {
      return await resolveBody<{ projectId: string }>(post({
        apiName: API_NAME, path: "/projects/from-demo-draft", options: { headers, body },
      }));
    } catch (err: unknown) {
      const quota = await parseQuota(err, 402);
      if (quota) throw quota;
      throw err;
    }
  },

  async createProject(body: ProjectCreateRequest): Promise<ProjectResponse> {
    const headers = await authHeader();
    try {
      return await resolveBody<ProjectResponse>(
        post({
          apiName: API_NAME,
          path: "/projects",
          options: { headers, body: body as unknown as Record<string, unknown> as never },
        })
      );
    } catch (err: unknown) {
      const quota = await parseQuota(err, 402);
      if (quota) throw quota;
      throw err;
    }
  },

  /** PUT /projects/{id} — partial update. Throws QuotaError on HTTP 402. */
  async updateProject(id: string, body: ProjectUpdateRequest): Promise<ProjectResponse> {
    const headers = await authHeader();
    try {
      return await resolveBody<ProjectResponse>(
        put({
          apiName: API_NAME,
          path: `/projects/${encodeURIComponent(id)}`,
          options: { headers, body: body as unknown as Record<string, unknown> as never },
        })
      );
    } catch (err: unknown) {
      const quota = await parseQuota(err, 402);
      if (quota) throw quota;
      throw err;
    }
  },

  /** DELETE /projects/{id} — permanent delete (204). */
  async deleteProject(id: string): Promise<void> {
    const headers = await authHeader();
    await del({
      apiName: API_NAME,
      path: `/projects/${encodeURIComponent(id)}`,
      options: { headers },
    }).response;
  },

  // ── Electrical preliminary-load (FCR-102+) — AUTHENTICATED, deterministic ────
  // POST /electrical/preliminary { inputs, topology? } -> ElectricalLoadData.
  // Authenticated like /evaluate (Bearer token via authHeader()) but NOT
  // eval-quota-gated and never reaches Foundry, so no QuotaError handling.

  /** POST /electrical/preliminary — deterministic preliminary load study. */
  async postElectricalPreliminary(
    body: ElectricalPreliminaryRequest,
  ): Promise<ElectricalLoadData> {
    const headers = await authHeader();
    return resolveBody<ElectricalLoadData>(
      post({
        apiName: API_NAME,
        path: "/electrical/preliminary",
        options: { headers, body: body as unknown as Record<string, unknown> as never },
      }),
    );
  },
};

// ── helpers ───────────────────────────────────────────────────────────────────

function isNotFound(err: unknown): boolean {
  if (err && typeof err === "object") {
    const e = err as { response?: { status?: number }; status?: number };
    return e.response?.status === 404 || e.status === 404;
  }
  return false;
}

function httpStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const e = err as { response?: { statusCode?: number; status?: number }; statusCode?: number; status?: number };
    return e.response?.statusCode ?? e.response?.status ?? e.statusCode ?? e.status;
  }
  return undefined;
}

function asDemoLimit(obj: unknown): DemoLimitResponse | null {
  if (!obj || typeof obj !== "object") return null;
  // FastAPI wraps HTTPException detail under `detail`; our payload may also be
  // returned at the top level. Accept either shape.
  const root = obj as Record<string, unknown>;
  const candidate = (root.detail && typeof root.detail === "object" ? root.detail : root) as Record<string, unknown>;
  if (candidate.type === "demo_limit" && typeof candidate.limit === "number") {
    return candidate as unknown as DemoLimitResponse;
  }
  return null;
}

/** Extract the typed demo-limit payload from an Amplify error, or null. */
async function parseDemoLimit(err: unknown): Promise<DemoLimitResponse | null> {
  if (httpStatus(err) !== 429) return null;
  // Amplify v6 surfaces the error body on err.response.body.json().
  const e = err as { response?: { body?: { json?: () => Promise<unknown> } } };
  try {
    const body = await e.response?.body?.json?.();
    const parsed = asDemoLimit(body);
    if (parsed) return parsed;
  } catch {
    /* fall through */
  }
  // Fallback: a minimal CTA so the UI never renders a raw 429.
  return {
    type: "demo_limit",
    // Empty copy: DemoLimitCard fills it from translations (services stay language-free).
    message: "",
    limit: 5,
    cta: "",
    ctaAction: "signup",
    ctaHref: "/login",
  };
}

/** Read a numeric response header from an Amplify error, tolerating header shapes. */
function responseHeader(err: unknown, name: string): string | undefined {
  if (!err || typeof err !== "object") return undefined;
  const headers = (err as { response?: { headers?: unknown } }).response?.headers;
  if (!headers) return undefined;
  // Fetch Headers instance.
  if (typeof (headers as Headers).get === "function") {
    return (headers as Headers).get(name) ?? undefined;
  }
  // Plain record (case-insensitive lookup).
  const rec = headers as Record<string, string>;
  const hit = Object.keys(rec).find((k) => k.toLowerCase() === name.toLowerCase());
  return hit ? rec[hit] : undefined;
}

function asQuotaBody(obj: unknown): QuotaExceededBody | null {
  if (!obj || typeof obj !== "object") return null;
  // FastAPI HTTPException wraps the detail under `detail`; the QuotaExceeded
  // handler returns the payload at the top level. Accept either shape.
  const root = obj as Record<string, unknown>;
  const candidate = (root.detail && typeof root.detail === "object" ? root.detail : root) as Record<string, unknown>;
  if (candidate.type === "quota_exceeded" && typeof candidate.limit === "number") {
    return candidate as unknown as QuotaExceededBody;
  }
  return null;
}

/**
 * Build a typed QuotaError from an Amplify error when the status matches, or
 * null. Parses the {type:"quota_exceeded",...} body and (for 429) backfills
 * limit/remaining/reset from the X-Quota-* headers when the body is missing.
 */
async function parseQuota(err: unknown, expected: 402 | 429): Promise<QuotaError | null> {
  if (httpStatus(err) !== expected) return null;
  const e = err as { response?: { body?: { json?: () => Promise<unknown> } } };
  let body: QuotaExceededBody | null = null;
  try {
    const json = await e.response?.body?.json?.();
    body = asQuotaBody(json);
  } catch {
    /* fall through to header/fallback */
  }
  if (!body) {
    // Backfill from X-Quota-* headers (sent on the 429 evaluate gate) or a
    // minimal payload so the UI never renders a raw quota error.
    const hdrLimit = responseHeader(err, "X-Quota-Limit");
    body = {
      type: "quota_exceeded",
      // Empty copy: the UpgradeModal renders its own translated text.
      message: "",
      limit: hdrLimit ? Number(hdrLimit) : 0,
      resource: expected === 402 ? "saved_projects" : "evaluate",
      remaining: Number(responseHeader(err, "X-Quota-Remaining") ?? 0),
      reset: responseHeader(err, "X-Quota-Reset"),
      ctaAction: "upgrade",
    };
  } else if (expected === 429 && !body.resource) {
    body.resource = "evaluate";
  }
  return new QuotaError(body, expected);
}
