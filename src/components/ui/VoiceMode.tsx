import { useEffect, useRef } from "react";
import { PhoneOff } from "lucide-react";
import { VoiceOrb } from "./VoiceOrb";
import { VOICE_STATE_LABEL } from "../../utils/voiceStateLabels";
import { useActiveVoiceConversation } from "../../utils/useActiveVoiceConversation";
import { useAssistant } from "../../context/AssistantContext";

/**
 * Hands-free conversation view — modeled on ChatGPT/Gemini voice assistants: once started it
 * keeps listening → replying → listening in a loop until you end it, instead of requiring a tap
 * per turn. Renders INSIDE the existing sticky assistant panel (no separate page, no popup) —
 * the caller swaps this in for the message list while active.
 */
export function VoiceModePanel({
  onExit,
  onExchange,
}: {
  onExit: () => void;
  onExchange: (userText: string, aiText: string) => void;
}) {
  const { ask } = useAssistant();
  const { state, caption, errorText, start, stop } = useActiveVoiceConversation(ask, onExchange);
  const startedOnce = useRef(false);

  useEffect(() => {
    if (startedOnce.current) return;
    startedOnce.current = true;
    start();
    // Only ever fire on the initial mount — `start` is stable (useCallback).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function exit() {
    stop();
    onExit();
  }

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-6">
      <VoiceOrb state={state} size={190} />

      <p className="mt-9 text-[15px] font-medium text-neutral-700">{state === "error" ? "Mic unavailable" : VOICE_STATE_LABEL[state]}</p>
      <p className="mt-2 max-h-24 max-w-xs overflow-y-auto text-center text-[13px] leading-relaxed text-neutral-500">
        {state === "error" ? errorText : caption}
      </p>

      <button
        onClick={exit}
        className="mt-6 flex items-center gap-2 rounded-full bg-neutral-100 px-4 py-2.5 text-[12.5px] font-medium text-neutral-600"
      >
        <PhoneOff size={13} /> End voice · back to chat
      </button>
    </div>
  );
}
