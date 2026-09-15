import { useEffect, useRef } from "react";
import { MicOff, PhoneOff } from "lucide-react";
import { useActiveVoiceConversation } from "../../utils/useActiveVoiceConversation";
import { useAssistant } from "../../context/AssistantContext";

const STATE_LABEL: Record<string, string> = {
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "",
};

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

  const orbTone =
    state === "listening" ? "bg-[#2955C4]" : state === "thinking" ? "bg-[#6D3FBF]" : state === "speaking" ? "bg-[image:var(--sd-gradient)]" : "bg-slate-400";

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 py-6">
      <div className="relative flex h-28 w-28 shrink-0 items-center justify-center">
        {(state === "listening" || state === "speaking") && (
          <>
            <span className={`absolute inset-0 animate-ping rounded-full opacity-25 ${orbTone}`} style={{ animationDuration: "1.8s" }} />
            <span className={`absolute inset-2 animate-ping rounded-full opacity-25 ${orbTone}`} style={{ animationDuration: "1.8s", animationDelay: "0.3s" }} />
          </>
        )}
        {state === "thinking" && (
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-slate-200 border-t-[#6D3FBF]" />
        )}
        <div className={`flex h-16 w-16 items-center justify-center rounded-full text-white transition-colors duration-500 ${orbTone}`}>
          {state === "error" ? <MicOff size={24} /> : <span className="h-2.5 w-2.5 rounded-full bg-white" />}
        </div>
      </div>

      <p className="mt-5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{state === "error" ? "Mic unavailable" : STATE_LABEL[state]}</p>
      <p className="mt-2 max-h-24 max-w-xs overflow-y-auto text-center text-[13px] leading-relaxed text-slate-600">
        {state === "error" ? errorText : caption}
      </p>

      <button
        onClick={exit}
        className="mt-6 flex items-center gap-2 rounded-full bg-slate-100 px-4 py-2.5 text-[12.5px] font-medium text-slate-600"
      >
        <PhoneOff size={13} /> End voice · back to chat
      </button>
    </div>
  );
}
