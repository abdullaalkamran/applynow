import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { useRole } from "./RoleContext";
import { useAuth } from "./AuthContext";
import { ROLE_ASSISTANT_CONFIGS } from "../utils/roleAssistantConfigs";
import { runAssistantTurn, type ApprovalRequest } from "../utils/assistantEngine";
import type { AssistantMessage } from "../utils/assistantTypes";
import { fetchVoiceConfig, type VoiceConfig } from "../utils/voiceClient";

interface AssistantContextValue {
  ask: (text: string) => Promise<string>;
  suggestions: string[];
  /** The model-side conversation (tool calls and results included) — saved with a chat so it can be resumed. */
  getConversation: () => AssistantMessage[];
  /** Replace it: a saved chat being reopened, or [] for a fresh one. */
  setConversation: (history: AssistantMessage[]) => void;
  voiceEngine: VoiceConfig["voiceEngine"];
}

const AssistantContext = createContext<AssistantContextValue | undefined>(undefined);

/**
 * One assistant per role, mounted once — so every shell's floating widget and any full-page chat
 * (e.g. the student AI Counsellor page) share the same running conversation instead of each
 * independently importing a rule-based engine. Conversation resets whenever the active role changes.
 */
export function AssistantProvider({ children }: { children: ReactNode }) {
  const { role, currentUser } = useRole();
  const { token } = useAuth();
  const [history, setHistory] = useState<AssistantMessage[]>([]);
  const historyRef = useRef<AssistantMessage[]>([]);
  historyRef.current = history;
  const getConversation = useCallback(() => historyRef.current, []);
  const [voiceEngine, setVoiceEngine] = useState<VoiceConfig["voiceEngine"]>("browser");

  // The pending approval card (see ToolDefinition.requiresApproval) — one at a time, rendered below so it
  // works for the typed chat and the voice widget alike.
  const [pending, setPending] = useState<ApprovalRequest | null>(null);
  const resolvePending = useRef<((ok: boolean) => void) | null>(null);
  const requestApproval = useCallback(
    (request: ApprovalRequest) =>
      new Promise<boolean>((resolve) => {
        resolvePending.current = resolve;
        setPending(request);
      }),
    []
  );
  function decide(ok: boolean) {
    resolvePending.current?.(ok);
    resolvePending.current = null;
    setPending(null);
  }

  useEffect(() => {
    setHistory([]);
  }, [role]);

  useEffect(() => {
    fetchVoiceConfig()
      .then((cfg) => {
        // Fall back to browser speech if the admin picked an engine whose key isn't actually set.
        if (cfg.voiceEngine === "openai" && !cfg.openaiVoiceAvailable) return setVoiceEngine("browser");
        if (cfg.voiceEngine === "gemini-live" && !cfg.geminiLiveAvailable) return setVoiceEngine("browser");
        setVoiceEngine(cfg.voiceEngine);
      })
      .catch(() => setVoiceEngine("browser"));
  }, []);

  const ask = useCallback(
    async (text: string) => {
      if (!token) return "You've been signed out — please log in again to keep chatting.";
      const config = ROLE_ASSISTANT_CONFIGS[role];
      const ctx = { userId: currentUser.id, userName: currentUser.name };
      const { reply, updatedHistory } = await runAssistantTurn(config, ctx, history, text, token, requestApproval);
      setHistory(updatedHistory);
      return reply;
    },
    [role, currentUser, history, token, requestApproval]
  );

  const suggestions = ROLE_ASSISTANT_CONFIGS[role].suggestions;
  const setConversation = useCallback((next: AssistantMessage[]) => setHistory(next), []);

  return (
    <AssistantContext.Provider value={{ ask, suggestions, getConversation, setConversation, voiceEngine }}>
      {children}
      {pending && (
        <div role="dialog" aria-modal="true" aria-label="Approve AI action" className="fixed inset-0 z-[100] flex items-end justify-center bg-black/30 p-4 sm:items-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-amber-600">AI assistant needs your approval</p>
            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{pending.summary}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => decide(false)} className="rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700">Decline</button>
              <button onClick={() => decide(true)} className="rounded-lg bg-[var(--brand-600)] px-4 py-2 text-sm font-medium text-white">Approve</button>
            </div>
          </div>
        </div>
      )}
    </AssistantContext.Provider>
  );
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}
