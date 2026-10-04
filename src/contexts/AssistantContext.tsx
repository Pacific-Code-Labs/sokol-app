import { createContext, useContext, useState, useCallback, useRef, type MutableRefObject, ReactNode } from "react";
import { type Msg } from "@/components/ChatPanel";
import { BuildingType } from "@/services/sokolApi";

export interface AssistantInput {
  buildingType?: BuildingType;
  usage?: string;
  areaM2?: number;
  floors?: number;
  occupants?: number;
  ceilingHeight?: number;
  volume?: number;
}

export interface PageContext {
  page: "dashboard" | "projects" | "project_detail" | "evaluation" | "other";
  payload?: Record<string, unknown>;
}

interface Ctx {
  chatInput: string; setChatInput: React.Dispatch<React.SetStateAction<string>>;
  busy: boolean; setBusy: React.Dispatch<React.SetStateAction<boolean>>;
  runtime: MutableRefObject<Record<string, MutableRefObject<unknown>>>;
  open: boolean;
  setOpen: (v: boolean) => void;
  toggle: () => void;
  messages: Msg[];
  setMessages: React.Dispatch<React.SetStateAction<Msg[]>>;
  input: AssistantInput;
  setInput: (i: AssistantInput) => void;
  pageContext: PageContext;
  setPageContext: (c: PageContext) => void;
}

const AssistantCtx = createContext<Ctx | null>(null);

export function AssistantProvider({ children }: { children: ReactNode }) {
  const [chatInput, setChatInput] = useState("");
  const [busy, setBusy] = useState(false);
  const runtime = useRef<Record<string, MutableRefObject<unknown>>>({});
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState<AssistantInput>({});
  const [pageContext, setPageContext] = useState<PageContext>({ page: "other" });

  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <AssistantCtx.Provider
      value={{ chatInput, setChatInput, busy, setBusy, runtime, open, setOpen, toggle, messages, setMessages, input, setInput, pageContext, setPageContext }}
    >
      {children}
    </AssistantCtx.Provider>
  );
}

export function useAssistant() {
  const c = useContext(AssistantCtx);
  if (!c) throw new Error("useAssistant outside provider");
  return c;
}

/** Share guided-flow refs between desktop/mobile without requiring a provider in isolated embeds. */
export function useAssistantRuntimeRef<T>(key: string, initial: T): MutableRefObject<T> {
  const context = useContext(AssistantCtx);
  const local = useRef(initial);
  if (!context) return local;
  if (!(key in context.runtime.current)) context.runtime.current[key] = { current: initial };
  return context.runtime.current[key] as MutableRefObject<T>;
}


export function useAssistantChatState() {
  const context = useContext(AssistantCtx);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  return context ? { input: context.chatInput, setInput: context.setChatInput, isLoading: context.busy, setIsLoading: context.setBusy } : { input, setInput, isLoading, setIsLoading };
}
