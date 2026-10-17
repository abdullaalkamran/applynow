import type { VoiceConversationState } from "./useVoiceConversation";

/** The status line under the voice orb. */
export const VOICE_STATE_LABEL: Record<VoiceConversationState, string> = {
  idle: "Tap the mic to talk",
  listening: "I’m listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Mic unavailable",
};
