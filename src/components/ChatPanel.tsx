import { useAssistantRuntimeRef, useAssistantChatState } from "@/contexts/AssistantContext";
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { Send, Sparkles, Loader2, Trash2, X, ArrowRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@pacific-code-labs/sokol-design-system";
import { useLang } from "@/contexts/LangContext";
import { fmt } from "@/lib/chrome-i18n";
import { sokolApi, BuildingType, DemoLimitError, QuotaError, type ConversationTurn, type DemoLimitResponse, type EvaluateResponse, type NeedsInfoQuestion, type ElectricalInputs, type ElectricalOccupancy } from "@/services/sokolApi";
import { UpgradeModal } from "@/components/UpgradeModal";
import { localizedPath } from "@/lib/paths";
import type { PageContext } from "@/contexts/AssistantContext";
import {
  normalizeAssistantResponse,
  type AssistantResponseType,
  type ProjectCreatedData,
  type MessageData,
  type NeedsInfoData,
  type ElectricalLoadData,
} from "@/lib/assistantResponse";
import { TextMessage } from "@/components/assistant/TextMessage";
import { EvaluationCard } from "@/components/assistant/EvaluationCard";
import { ProjectCard } from "@/components/assistant/ProjectCard";
import { ElectricalLoadCard } from "@/components/assistant/ElectricalLoadCard";
import { DemoLimitCard } from "@/components/assistant/DemoLimitCard";
import { AssistantMessage } from "@/components/assistant/AssistantMessage";
import { AssistantAvatar } from "@/components/assistant/AssistantAvatar";
import { WelcomeState } from "@/components/assistant/WelcomeState";
import { TypingIndicator } from "@/components/assistant/TypingIndicator";
import { ChoicePrompt } from "@/components/assistant/ChoicePrompt";
import { NeedsInfoForm } from "@/components/assistant/NeedsInfoForm";
import { type DemoScenario, type DemoScenarioParams } from "@/lib/demoScenarios";
import { getAssistantCapabilities } from "@/lib/assistantCapabilities";
import { cn } from "@/lib/utils";
import { errorReference } from "@/lib/error-reference";
import { ReportProblemLink } from "@/components/ReportProblemLink";
import { assistantDestination, type AssistantDestination, type EvaluationProjectDraft } from "@/lib/assistantNavigation";
import { evaluatorRequest } from "@/lib/evaluatorRequest";
import type { EvaluateRequest } from "@/services/sokolApi";

/** Read the HTTP status off an Amplify/fetch error, tolerating shapes. */
function readErrorStatus(err: unknown): number | undefined {
  if (err && typeof err === "object") {
    const e = err as {
      response?: { statusCode?: number; status?: number };
      statusCode?: number;
      status?: number;
    };
    return e.response?.statusCode ?? e.response?.status ?? e.statusCode ?? e.status;
  }
  return undefined;
}

export type MsgType = "message" | "evaluation" | "project" | "error" | "demo_limit" | "prompt" | "needs_info" | "electrical" | "question";

/** FCR-100/118: which guided-demo step a quick-reply prompt drives. */
export type PromptKind = "see_eval" | "create_project" | "see_electrical" | "create_account";

export interface PromptPayload {
  kind: PromptKind;
  prompt: string;
  options: { label: string; value: string }[];
}

export interface Msg {
  role: "user" | "assistant";
  /** Free-text fallback / summary line */
  text: string;
  /** Discriminator for assistant payload rendering */
  type?: MsgType;
  /** Legacy: full evaluation response (kept for backward compat) */
  answer?: EvaluateResponse;
  /** New polymorphic payload */
  payload?: EvaluateResponse | ProjectCreatedData | MessageData | DemoLimitResponse | PromptPayload | NeedsInfoData | ElectricalLoadData;
  /** For a one-at-a-time "question" turn: the submit button label. */
  submitLabel?: string;
  /** Server-error reference (X-Request-Id) for "Report this problem". */
  reference?: string;
  /** Retained with this result so earlier responses open their own scenario. */
  destination?: AssistantDestination;
  projectDraft?: EvaluationProjectDraft;
}

interface Props {
  buildingType?: BuildingType;
  usage: string;
  areaM2?: number;
  floors?: number;
  occupants?: number;
  ceilingHeight?: number;
  volume?: number;
  onClose?: () => void;
  messages: Msg[];
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  /** FCR-042: page/project context forwarded to the agent for continuity. */
  pageContext?: PageContext;
  /**
   * FCR-047: when true this is the PUBLIC demo assistant — calls the throttled
   * public /demo/evaluate (teaser answers, never creates projects) and renders a
   * sign-up CTA on the 429 daily-cap response. FCR-100: it also drives the
   * guided 3-step demo (teaser → full evaluation → project preview → sign-up).
   */
  demo?: boolean;
  /**
   * Demo only: apply a curated scenario's building params to the page's inputs
   * (the BuildingSelector) so a tapped capability card visibly fills the inputs.
   * Provided by the /demo page.
   */
  onApplyScenario?: (params: DemoScenarioParams) => void;
}

/** Cap replayed history to the most recent N turns (FCR-042 token budget). */
const MAX_CONVERSATION_TURNS = 10;

/**
 * FCR-115: detect a "create the project" intent in a typed demo message so it
 * proceeds with the project flow (preview / genuine needs_info) instead of a
 * teaser. Conservative keyword match (es/en).
 */
const CREATE_PROJECT_PATTERNS = [
  /\bcrea(r|me|)\b.*\bproyecto\b/i,
  /\bproyecto\b.*\bcrea/i,
  /\b(guardar|genera(r|)|arma(r|)|haz(me|)|hacer)\b.*\bproyecto\b/i,
  /\bcreate\b.*\bproject\b/i,
  /\b(save|generate|make|build|start|new)\b.*\bproject\b/i,
];
function isCreateProjectIntent(text: string): boolean {
  return CREATE_PROJECT_PATTERNS.some((re) => re.test(text));
}

/** Map the running assistant message list to the agent {role,content} contract. */
function toConversation(messages: Msg[]): ConversationTurn[] {
  return messages
    .filter(
      (m) =>
        m.type !== "error" &&
        m.type !== "prompt" &&
        m.type !== "needs_info" &&
        (m.text?.trim()?.length ?? 0) > 0,
    )
    .map<ConversationTurn>((m) => ({ role: m.role, content: m.role === "assistant" && m.payload && ["evaluation", "project", "electrical"].includes(m.type ?? "") ? JSON.stringify(m.payload, (key, value) => key === "matchedRules" && Array.isArray(value) ? value.map((r) => ({ id: r.id, standard: r.standard, title: r.title })) : value) : m.text }))
    .slice(-MAX_CONVERSATION_TURNS);
}

/** Options passed to ask(). FCR-100 guided-demo controls. */
interface AskOptions {
  /** A tapped scenario's params ground this request immediately (bypasses the setState race). */
  overrides?: DemoScenarioParams;
  /** Teaser step: omit building params so the agent returns a short message, not a full eval. */
  teaser?: boolean;
  /** After a successful (non-needs_info) demo response, show this guided prompt next. */
  demoNext?: PromptKind;
  /**
   * FCR-109: guided-demo step signal sent to the agent (`context.demo_step`) so
   * it returns the right shape per stage: "teaser" → short message + hook;
   * "full_evaluation" → complete evaluation; "project" → create_project preview.
   */
  demoStep?: "teaser" | "full_evaluation" | "project";
  /** FCR-114: don't render a user bubble for this request (quick-reply choices). */
  silent?: boolean;
}

export function ChatPanel({ buildingType, usage, areaM2, floors, occupants, ceilingHeight, volume, onClose, messages, setMessages, pageContext, demo = false, onApplyScenario }: Props) {
  const { lang, tr } = useLang();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  // FCR-118: capabilities are resolved per variant (demo vs internal) so each
  // assistant's available functions are controlled from one declarative place.
  const caps = getAssistantCapabilities(demo);
  const { input, setInput, isLoading, setIsLoading } = useAssistantChatState();
  // FCR-026: the authenticated /evaluate quota gate returns 402/429 → QuotaError.
  // The public demo path keeps using DemoLimitError; this is the signed-in path.
  const [quota, setQuota] = useState<QuotaError | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // FCR-100 guided-demo state (refs avoid re-render churn / setState races).
  const demoNextRef = useAssistantRuntimeRef<PromptKind | null>("demoNextRef", null);
  const activeScenarioRef = useAssistantRuntimeRef<DemoScenario | null>("activeScenarioRef", null);
  const lastRequestRef = useAssistantRuntimeRef<string>("lastRequestRef", "");
  const activeQueryRef = useAssistantRuntimeRef<string>("activeQueryRef", "");
  const demoEndedRef = useAssistantRuntimeRef<boolean>("demoEndedRef", false);
  const projectReofferedRef = useAssistantRuntimeRef<boolean>("projectReofferedRef", false); // FCR-115: re-offer the project once on decline
  const projectCreatedRef = useAssistantRuntimeRef<boolean>("projectCreatedRef", false); // FCR-116: a project preview already shown → stop offering "create project", go to sign-up
  // FCR-114: a conversational, one-question-at-a-time flow (intake + agent needs_info).
  const questionFlowRef = useRef<{
    qs: NeedsInfoQuestion[];
    idx: number;
    collected: string[];
    submitLabel?: string;
    onComplete: (summary: string) => void;
  } | null>(null);

  useEffect(() => {
    // Follow the conversation; the empty welcome state stays at the top.
    if (messages.length === 0 && !isLoading) return;
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, isLoading]);

  /** Render the agent response and return its normalized type (for guided flow). */
  const handleResponse = async (raw: unknown, request: EvaluateRequest): Promise<AssistantResponseType> => {
    const norm = normalizeAssistantResponse(raw);
    const destination = demo ? undefined : assistantDestination(norm, request) ?? undefined;

    switch (norm.type) {
      case "evaluation": {
        const data = norm.data;
        let summary: string;
        if (data.matchedRules.length > 0) {
          summary =
            lang === "es"
              ? `Encontré ${data.matchedRules.length} norma(s) aplicable(s).`
              : `Found ${data.matchedRules.length} applicable standard(s).`;
        } else if (data.foundryUsed && data.requirements.length > 0) {
          // No deterministic rule match, but the agent returned requirements —
          // a clean intro line (the full requirements render in the card below).
          summary = tr.evalFullSummary;
        } else {
          summary = tr.chat_no_rules;
        }

        setMessages((m) => [
          ...m,
          { role: "assistant", text: summary, type: "evaluation", payload: data, answer: data, destination,
            projectDraft: demo ? undefined : { request: evaluatorRequest(request), evaluation: data } },
        ]);
        break;
      }
      case "message": {
        setMessages((m) => [
          ...m,
          { role: "assistant", text: norm.data.message, type: "message", payload: norm.data },
        ]);
        break;
      }
      case "project_created": {
        // FCR-116: a project was created/previewed (by the guided step OR a manual
        // message) — from here on don't offer "create project" again, only sign-up.
        projectCreatedRef.current = true;
        const name = norm.data.project?.name || tr.chat_project_fallback;
        const isPreview = norm.data.projectId == null;
        setMessages((m) => [
          ...m,
          {
            role: "assistant",
            text: fmt(isPreview ? tr.chat_project_preview_msg : tr.chat_project_created_msg, { name }),
            type: "project",
            payload: norm.data,
            destination,
          },
        ]);
        if (!isPreview) {
          await queryClient.invalidateQueries({ queryKey: ["projects"] });
          toast.success(tr.chat_project_created_toast);
        }
        break;
      }
      case "needs_info": {
        // FCR-114: ask the agent's clarifying questions ONE AT A TIME
        // (conversational), then resend the collected answers.
        const qs = norm.data.questions ?? [];
        if (qs.length > 0) {
          const originalQuery = lastRequestRef.current;
          startQuestionFlow(qs, (summary) =>
            ask(`${originalQuery}\n${summary}`, { overrides: activeScenarioRef.current?.params }),
          );
        }
        break;
      }
      case "electrical_load": {
        if (norm.data.projectId) await queryClient.invalidateQueries({ queryKey: ["projects"] });
        const summary = fmt(tr.chat_load_study, {
          kva: norm.data.demandKva?.toLocaleString?.() ?? norm.data.demandKva,
        });
        setMessages((m) => [
          ...m,
          { role: "assistant", text: summary, type: "electrical", payload: norm.data, destination },
        ]);
        break;
      }
    }
    return norm.type;
  };

  const handleDemoLimit = (payload: DemoLimitResponse) => {
    setMessages((m) => [
      ...m,
      { role: "assistant", text: payload.message, type: "demo_limit", payload },
    ]);
  };

  const handleError = (err?: unknown) => {
    // FCR-118: differentiate the real cause instead of always blaming the
    // connection. The authenticated /evaluate path commonly fails with 401
    // (expired/missing Cognito access token) or 5xx (backend) — telling the
    // user "check your connection" for those is misleading and unactionable.
    const status = readErrorStatus(err);
    let text: string;
    if (status === 401 || status === 403) {
      text = tr.chat_err_session;
    } else if (status !== undefined && status >= 500) {
      text = tr.chat_err_server;
    } else {
      text = tr.chat_err_network;
    }
    // Only server failures carry a reference worth reporting (4xx are the user's to fix).
    const reference = status !== undefined && status >= 500 ? errorReference(err) : undefined;
    setMessages((m) => [...m, { role: "assistant", type: "error", text, reference }]);
    if (err) console.error("Assistant error:", err, "status:", status);
  };

  /** Append a guided-demo quick-reply prompt for the given step (FCR-100). */
  const appendPrompt = (kind: PromptKind) => {
    const byKind: Record<PromptKind, PromptPayload> = {
      see_eval: {
        kind,
        prompt: tr.demoStep2Q,
        options: [
          { label: tr.demoSeeEval, value: "yes" },
          { label: tr.demoNo, value: "no" },
        ],
      },
      create_project: {
        kind,
        prompt: tr.demoStep3Q,
        options: [
          { label: tr.demoYes, value: "yes" },
          { label: tr.demoNo, value: "no" },
        ],
      },
      see_electrical: {
        kind,
        prompt: tr.demoStep4Q,
        options: [
          { label: tr.demoSeeElectrical, value: "yes" },
          { label: tr.demoNo, value: "no" },
        ],
      },
      create_account: {
        kind,
        prompt: tr.demoAccountQ,
        options: [
          { label: tr.demoCreateAccount, value: "yes" },
          { label: tr.demoNotNow, value: "no" },
        ],
      },
    };
    const payload = byKind[kind];
    setMessages((m) => [...m, { role: "assistant", text: payload.prompt, type: "prompt", payload }]);
  };

  /** Soft-end: invite to sign up (message + register CTA), keep the chat open. */
  const appendInvite = () => {
    demoEndedRef.current = true;
    setMessages((m) => [
      ...m,
      { role: "assistant", text: tr.demoInvite, type: "message", payload: { message: tr.demoInvite } },
    ]);
    appendPrompt("create_account");
  };

  /**
   * Send a query. `opts.overrides` ground the building params for THIS request
   * (bypassing the setState race); `opts.teaser` omits building params so the
   * demo's step-1 answer is a short teaser; `opts.demoNext` is the guided prompt
   * to append after a successful (non-needs_info) demo response.
   */
  const ask = async (text: string, opts: AskOptions = {}) => {
    if (!text.trim() || isLoading) return;
    lastRequestRef.current = text;
    const { overrides, teaser, demoNext, demoStep, silent } = opts;
    if (demoNext !== undefined) demoNextRef.current = demoNext;

    // Prior turns BEFORE appending the current question (FCR-042). The current
    // query is sent separately as user_query, so it is excluded here.
    const conversation = toConversation(messages);
    // FCR-114: quick-reply choices send silently (no raw user bubble — the locked
    // ChoicePrompt already shows the chosen option). Typed/real answers DO show.
    if (!silent) setMessages((m) => [...m, { role: "user", text, type: "message" }]);
    setInput("");
    setIsLoading(true);

    // The public demo sends context.page="demo" and hits the throttled public
    // /demo/evaluate; the dashboard assistant uses the authenticated /evaluate.
    // FCR-044: send REAL selected values (or omit). A tapped scenario's overrides
    // win; a teaser step omits building params so the agent gives a short answer.
    const requestBody = {
      building_type: teaser ? undefined : (overrides?.building_type ?? buildingType ?? undefined),
      usage: teaser ? undefined : (overrides?.usage ?? usage ?? undefined),
      user_query: text,
      area_m2: teaser ? undefined : (overrides?.area_m2 ?? areaM2 ?? undefined),
      floors: teaser ? undefined : (overrides?.floors ?? floors ?? undefined),
      occupants: teaser ? undefined : (overrides?.occupants ?? occupants ?? undefined),
      ceiling_height_m: teaser ? undefined : (overrides?.ceiling_height_m ?? ceilingHeight ?? undefined),
      volume_m3: teaser ? undefined : (overrides?.volume_m3 ?? volume ?? undefined),
      language: lang,
      conversation,
      context: demo
        ? { page: "demo" as const, project: null, demo_step: demoStep }
        : pageContext
        ? { page: pageContext.page, project: pageContext.payload ?? null }
        : undefined,
    };

    try {
      const result = caps.throttledDemoEndpoint
        ? await sokolApi.evaluateDemo(requestBody)
        : await sokolApi.evaluate(requestBody);
      const type = await handleResponse(result, requestBody);
      // Guided demo: advance to the next prompt. On needs_info the form drives
      // the resend (which carries demoNext forward), so don't prompt yet.
      if (caps.guidedFlow && !demoEndedRef.current && type !== "needs_info" && demoNextRef.current) {
        let next = demoNextRef.current;
        demoNextRef.current = null;
        // FCR-116: if a project already exists, never re-offer "create project" —
        // jump to the sign-up invite instead.
        if (next === "create_project" && projectCreatedRef.current) next = "create_account";
        appendPrompt(next);
      } else if (caps.guidedFlow && demoEndedRef.current && type !== "needs_info") {
        // FCR-115: after a soft-end, the user kept chatting — re-invite to register.
        appendPrompt("create_account");
      }
    } catch (err) {
      if (err instanceof DemoLimitError) {
        handleDemoLimit(err.payload);
      } else if (err instanceof QuotaError) {
        setMessages((current) => [...current, { role: "assistant", type: "message", text: err.kind === "saved_projects" ? tr.chat_project_quota_blocked : tr.chat_usage_quota_blocked }]);
        setQuota(err);
      } else {
        handleError(err);
      }
    } finally {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      setIsLoading(false);
    }
  };

  /** Start guided-demo step 1 (teaser). */
  const startDemoStep1 = (scenario: DemoScenario | null, query: string) => {
    demoEndedRef.current = false;
    projectReofferedRef.current = false;
    projectCreatedRef.current = false;
    activeScenarioRef.current = scenario;
    activeQueryRef.current = query;
    ask(query, { teaser: true, demoNext: "see_eval", demoStep: "teaser" });
  };

  /** A tapped capability card. Demo → guided step 1; dashboard → grounded eval. */
  const handlePick = (s: DemoScenario) => {
    onApplyScenario?.(s.params);
    if (demo) startDemoStep1(s, s.query);
    else ask(s.query, { overrides: s.params });
  };

  /** The text input submit. Demo → guided step 1 (or straight to the project flow
   *  if the user explicitly asks to create one); dashboard → normal eval. */
  const handleSend = (text: string) => {
    if (!text.trim() || isLoading) return;
    if (caps.guidedFlow) {
      if (isCreateProjectIntent(text)) {
        // FCR-115: a manual "create the project" message proceeds with the demo
        // project flow too (agent → preview or genuine needs_info), not a teaser.
        ask(text, {
          overrides: activeScenarioRef.current?.params,
          demoNext: "see_electrical",
          demoStep: "project",
        });
      } else {
        startDemoStep1(null, text);
      }
    } else {
      ask(text);
    }
  };

  /**
   * FCR-118: guided-demo step 4 — compute a REAL preliminary electrical study
   * from the active scenario (or the current building inputs) via the public,
   * deterministic /demo/electrical endpoint, render it, then invite to sign up.
   */
  const runDemoElectrical = async () => {
    if (isLoading) return;
    const p = activeScenarioRef.current?.params;
    const occMap: Record<BuildingType, ElectricalOccupancy> = {
      [BuildingType.residencial]: "residencial",
      [BuildingType.comercial]: "comercial",
      [BuildingType.industrial]: "industrial",
    };
    const bt = (p?.building_type ?? buildingType) as BuildingType;
    const occupancy: ElectricalOccupancy = occMap[bt] ?? "comercial";
    const inputs: ElectricalInputs = {
      occupancy,
      area_m2: p?.area_m2 ?? areaM2 ?? 120,
      floors: p?.floors ?? floors ?? undefined,
      service: occupancy === "residencial" ? "single_phase" : "three_phase",
      language: lang,
    };
    setIsLoading(true);
    try {
      const result: ElectricalLoadData = await sokolApi.evaluateDemoElectrical(inputs);
      const summary =
        lang === "es"
          ? `Estudio eléctrico preliminar: ${result.demandKva} kVA demandados · transformador sugerido ${result.suggestedTransformerKva} kVA.`
          : `Preliminary electrical study: ${result.demandKva} kVA demanded · suggested transformer ${result.suggestedTransformerKva} kVA.`;
      setMessages((m) => [
        ...m,
        { role: "assistant", text: summary, type: "electrical", payload: result },
      ]);
      appendPrompt("create_account");
    } catch (err) {
      handleError(err);
    } finally {
      setIsLoading(false);
    }
  };

  /** A guided-demo quick-reply choice (FCR-100 / FCR-115 / FCR-118). */
  const handleChoice = (kind: PromptKind, value: string) => {
    if (isLoading) return;
    if (value === "no") {
      if (kind === "create_project" && !projectReofferedRef.current && !projectCreatedRef.current) {
        // FCR-115: don't end on the first decline — offer to keep chatting OR
        // re-offer the project once (maybe they click this time). FCR-116: skip
        // the re-offer entirely if a project was already created/previewed.
        projectReofferedRef.current = true;
        setMessages((m) => [
          ...m,
          { role: "assistant", text: tr.demoReoffer, type: "message", payload: { message: tr.demoReoffer } },
        ]);
        appendPrompt("create_project");
      } else if (kind === "create_account") {
        // Declined sign-up — keep the chat open, no further nudge until they ask.
        demoEndedRef.current = true;
        setMessages((m) => [
          ...m,
          { role: "assistant", text: tr.demoKeepExploring, type: "message", payload: { message: tr.demoKeepExploring } },
        ]);
      } else {
        appendInvite();
      }
      return;
    }
    switch (kind) {
      case "see_eval":
        // Silent affirmative (no raw user bubble — the locked choice shows it);
        // the scenario params + prior turns let the agent return the full eval.
        ask(tr.demoSeeEvalMsg, {
          silent: true,
          overrides: activeScenarioRef.current?.params,
          demoNext: "create_project",
          demoStep: "full_evaluation",
        });
        break;
      case "create_project":
        // FCR-115: agent-driven — it returns the preview, or genuine `needs_info`
        // questions for any truly-missing context (rendered one at a time). No
        // client-scripted intake, so fully-specified card scenarios skip questions.
        ask(tr.demoCreateProjectMsg, {
          silent: true,
          overrides: activeScenarioRef.current?.params,
          demoNext: "see_electrical",
          demoStep: "project",
        });
        break;
      case "see_electrical":
        // FCR-118: deterministic public demo study (no agent/evaluate round-trip).
        runDemoElectrical();
        break;
      case "create_account":
        navigate(localizedPath(lang, "/register"));
        break;
    }
  };

  /**
   * FCR-114: drive a set of clarifying questions ONE AT A TIME (conversational),
   * each as its own chat turn, then call onComplete with the joined answers.
   * Used by both the step-3 project intake and the agent's `needs_info`.
   */
  const startQuestionFlow = (
    qs: NeedsInfoQuestion[],
    onComplete: (summary: string) => void,
    submitLabel?: string,
  ) => {
    questionFlowRef.current = { qs, idx: 0, collected: [], submitLabel, onComplete };
    appendQuestion();
  };

  const appendQuestion = () => {
    const flow = questionFlowRef.current;
    if (!flow) return;
    const q = flow.qs[flow.idx];
    const isLast = flow.idx === flow.qs.length - 1;
    const submitLabel = isLast ? flow.submitLabel ?? tr.needsInfoSubmit : tr.demoContinue;
    setMessages((m) => [
      ...m,
      { role: "assistant", text: q.label, type: "question", payload: { questions: [q], context: {} }, submitLabel },
    ]);
  };

  /** A single question was answered → echo it, then advance or finish. */
  const handleQuestionAnswer = (summary: string, answers: Record<string, string>) => {
    const flow = questionFlowRef.current;
    if (!flow) return;
    const q = flow.qs[flow.idx];
    const val = answers[q.key] ?? summary;
    setMessages((m) => [...m, { role: "user", text: val, type: "message" }]);
    flow.collected.push(`${q.label} ${val}`);
    flow.idx += 1;
    if (flow.idx < flow.qs.length) {
      appendQuestion();
    } else {
      const joined = flow.collected.join("; ");
      questionFlowRef.current = null;
      flow.onComplete(joined);
    }
  };

  const renderAssistantBody = (m: Msg) => {
    // Resolve effective type with backward compatibility
    const type: MsgType = m.type ?? (m.answer ? "evaluation" : "message");

    if (type === "evaluation") {
      const data = (m.payload as EvaluateResponse | undefined) ?? m.answer;
      return (
        <>
          <TextMessage text={m.text} />
          {data && <div className="mt-3"><EvaluationCard data={data} /></div>}
        </>
      );
    }
    if (type === "project") {
      return (
        <>
          <TextMessage text={m.text} />
          {m.payload && <div className="mt-3"><ProjectCard data={m.payload as ProjectCreatedData} /></div>}
        </>
      );
    }
    if (type === "electrical") {
      return (
        <>
          <TextMessage text={m.text} />
          {m.payload && (
            <div className="mt-3">
              <ElectricalLoadCard data={m.payload as ElectricalLoadData} />
            </div>
          )}
        </>
      );
    }
    if (type === "demo_limit" && m.payload) {
      return <DemoLimitCard data={m.payload as DemoLimitResponse} />;
    }
    if (type === "prompt" && m.payload) {
      const p = m.payload as PromptPayload;
      return <ChoicePrompt prompt={p.prompt} options={p.options} onChoose={(v) => handleChoice(p.kind, v)} />;
    }
    if (type === "question" && m.payload) {
      // One conversational question — the question text IS the bubble label, so
      // the form hides its own heading (title="") and shows just the control.
      return (
        <NeedsInfoForm
          data={m.payload as NeedsInfoData}
          onSubmit={handleQuestionAnswer}
          title=""
          submitLabel={m.submitLabel}
        />
      );
    }
    if (type === "message") {
      // FCR-114: in the guided demo the quick-reply prompts (and the step-3
      // create_account prompt) drive sign-up — so the per-message CTA is
      // suppressed (no early invite). The dashboard assistant never sets `demo`.
      return <AssistantMessage text={m.text} demo={false} onPick={handlePick} />;
    }
    // error / fallback
    return <TextMessage text={m.text} />;
  };

  return (
    <div className="panel flex h-full flex-col">
      <div className="flex items-center justify-between border-b border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">{tr.assistant}</span>
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => setMessages([])}
              title={tr.chat_clear}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
          {onClose && (
            <button
              onClick={onClose}
              title={tr.close}
              className="rounded p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
      </div>

      <div ref={scrollRef} className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        {messages.length === 0 && <WelcomeState onPick={handlePick} showExamples={demo} />}

        {messages.map((m, i) => {
          // FCR-114/117: rich cards (evaluation/project/electrical) carry the CR
          // context tiles + reference chips; in the narrow demo column the 85%
          // bubble clipped them. Give rich assistant cards a wider bubble and let
          // long content wrap instead of overflow.
          const effType: MsgType = m.type ?? (m.answer ? "evaluation" : "message");
          const isRich = effType === "evaluation" || effType === "project" || effType === "electrical";
          return (
            <div
              key={i}
              className={cn(
                "flex gap-2 duration-300 animate-in fade-in-50 slide-in-from-bottom-1",
                m.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              {m.role === "assistant" && <AssistantAvatar />}
              <div
                className={cn(
                  "min-w-0 break-words rounded-2xl px-3.5 py-2.5 text-sm",
                  m.role === "assistant" && isRich ? "max-w-full sm:max-w-[95%]" : "max-w-[90%] sm:max-w-[85%]",
                  m.role === "user"
                    ? "rounded-br-sm bg-primary text-primary-foreground shadow-sm"
                    : m.type === "error"
                    ? "rounded-bl-sm border border-destructive/40 bg-destructive/10 text-destructive"
                    : "rounded-bl-sm border border-border bg-secondary/60",
                )}
              >
                {m.role === "user" ? <TextMessage text={m.text} /> : renderAssistantBody(m)}
                {!demo && m.role === "assistant" && m.destination && (
                  <Button variant="outline" size="sm" className="mt-3 h-auto max-w-full gap-2 whitespace-normal text-left" onClick={() => {
                    navigate(localizedPath(lang, m.destination!.path), { state: m.destination!.state });
                    onClose?.();
                  }}>{tr[m.destination.label]}<ArrowRight className="h-4 w-4 shrink-0" /></Button>
                )}
                {!demo && m.role === "assistant" && m.projectDraft && (
                  <Button variant="outline" size="sm" className="mt-3 h-auto max-w-full gap-2 whitespace-normal text-left" onClick={() => {
                    navigate(localizedPath(lang, "/projects?new=1"), { state: { projectDraft: m.projectDraft } });
                    onClose?.();
                  }}>{tr.assistant_create_from_evaluation}<ArrowRight className="h-4 w-4 shrink-0" /></Button>
                )}
                {m.type === "error" && m.reference && <ReportProblemLink reference={m.reference} category="evaluation" />}
              </div>
            </div>
          );
        })}

        {isLoading && <TypingIndicator />}
      </div>

      <form
        data-tour="assistant"
        onSubmit={(e) => { e.preventDefault(); handleSend(input); }}
        className="flex shrink-0 items-end gap-2 border-t border-border p-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder={tr.askPlaceholder}
          aria-label={tr.askPlaceholder}
          rows={4}
          className="min-h-[112px] max-h-60 resize-y bg-input/60 leading-relaxed"
          disabled={isLoading}
        />
        <Button type="submit" size="icon" aria-label={tr.send} className="shrink-0" disabled={isLoading || !input.trim()}>
          {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        </Button>
      </form>

      <UpgradeModal quota={quota} onClose={() => setQuota(null)} />
    </div>
  );
}
