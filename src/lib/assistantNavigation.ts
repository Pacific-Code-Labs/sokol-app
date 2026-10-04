import type { NormalizedResponse } from "@/lib/assistantResponse";
import type { EvaluateRequest } from "@/services/sokolApi";

/** Only completed, typed results can select an app destination. */
export function assistantDestination(result: NormalizedResponse, request: EvaluateRequest) {
  switch (result.type) {
    case "evaluation":
      return { path: "/dashboard/evaluator", state: { assistantEvaluation: result.data, assistantRequest: request } };
    case "project_created":
      return { path: result.data.projectId ? `/projects/${encodeURIComponent(result.data.projectId)}` : "/projects" };
    case "electrical_load":
      if (!result.data.projectId) return null;
      return {
        path: "/projects/electrical" + (result.data.projectId ? `?projectId=${encodeURIComponent(result.data.projectId)}` : ""),
        state: { assistantElectrical: result.data, assistantRequest: request },
      };
    default:
      return null;
  }
}
