import { useAssistant } from "../context/AssistantContext";
import { useVoiceConversation } from "./useVoiceConversation";
import { useRealVoiceConversation } from "./useRealVoiceConversation";
import { useGeminiLiveConversation } from "./useGeminiLiveConversation";

/**
 * Picks whichever voice engine the admin has configured (browser / OpenAI / Gemini Live). All
 * three hooks are always called — required by the rules of hooks — but only the selected one's
 * `start()` is ever invoked externally, so the other two stay inert.
 */
export function useActiveVoiceConversation(
  replyFn: (text: string) => Promise<string>,
  onExchange?: (userText: string, aiText: string) => void
) {
  const { voiceEngine } = useAssistant();
  const browser = useVoiceConversation(replyFn, onExchange);
  const openaiVoice = useRealVoiceConversation(replyFn, onExchange);
  const geminiLive = useGeminiLiveConversation(onExchange);

  if (voiceEngine === "openai") return openaiVoice;
  if (voiceEngine === "gemini-live") return geminiLive;
  return browser;
}
