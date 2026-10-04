import { evaluatorRequest } from "@/lib/evaluatorRequest";
import type { NormalizedResponse } from "@/lib/assistantResponse";
import type { EvaluateRequest, EvaluateResponse } from "@/services/sokolApi";

export interface EvaluationProjectDraft {
  request: EvaluateRequest;
  evaluation: EvaluateResponse;
}

export interface AssistantDestination {
  path: string;
  label: "assistant_open_evaluator" | "assistant_open_project" | "assistant_open_electrical";
  state?: { assistantRequest: EvaluateRequest };
}

/** Completed results offer destinations; opening them is a user action. */
export function assistantDestination(result: NormalizedResponse, request: EvaluateRequest): AssistantDestination | null {
  switch (result.type) {
    case "evaluation":
      return { path: "/dashboard/evaluator", label: "assistant_open_evaluator", state: { assistantRequest: evaluatorRequest(request) } };
    case "project_created":
      return result.data.projectId ? { path: `/projects/${encodeURIComponent(result.data.projectId)}`, label: "assistant_open_project" } : null;
    case "electrical_load":
      if (!result.data.projectId) return null;
      return {
        path: `/projects/electrical?projectId=${encodeURIComponent(result.data.projectId)}`,
        label: "assistant_open_electrical",
      };
    default:
      return null;
  }
}
