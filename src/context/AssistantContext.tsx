import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import { useRole } from "./RoleContext";
import { ROLE_ASSISTANT_CONFIGS } from "../utils/roleAssistantConfigs";
import { runAssistantTurn } from "../utils/assistantEngine";
import type { AssistantMessage } from "../utils/assistantTypes";
import { fetchVoiceConfig, type VoiceConfig } from "../utils/voiceClient";

interface AssistantContextValue {
  ask: (text: string) => Promise<string>;
  suggestions: string[];
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
  const [history, setHistory] = useState<AssistantMessage[]>([]);
  const [voiceEngine, setVoiceEngine] = useState<VoiceConfig["voiceEngine"]>("browser");

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
      const config = ROLE_ASSISTANT_CONFIGS[role];
      const ctx = { userId: currentUser.id, userName: currentUser.name };
      const { reply, updatedHistory } = await runAssistantTurn(config, ctx, history, text);
      setHistory(updatedHistory);
      return reply;
    },
    [role, currentUser, history]
  );

  const suggestions = ROLE_ASSISTANT_CONFIGS[role].suggestions;

  return <AssistantContext.Provider value={{ ask, suggestions, voiceEngine }}>{children}</AssistantContext.Provider>;
}

export function useAssistant() {
  const ctx = useContext(AssistantContext);
  if (!ctx) throw new Error("useAssistant must be used within AssistantProvider");
  return ctx;
}
