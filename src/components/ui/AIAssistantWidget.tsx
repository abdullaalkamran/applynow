import { MicOff, Sparkles, Square, X } from "lucide-react";
import { useActiveVoiceConversation } from "../../utils/useActiveVoiceConversation";
import { useAssistant } from "../../context/AssistantContext";

const STATE_LABEL: Record<string, string> = {
  listening: "Listening…",
  thinking: "Thinking…",
  speaking: "Speaking…",
  error: "Mic unavailable",
};

/**
 * The sticky AI Assistant IS the agent — tapping it activates it in place (it animates: pulses
 * while listening, spins while thinking, glows while speaking) and shows a small caption bubble
 * right above it. No separate page, no popup/sheet — just the icon itself going live.
 */
export function AIAssistantWidget({ raised = false }: { raised?: boolean }) {
  const { ask } = useAssistant();
  const { state, caption, errorText, start, stop } = useActiveVoiceConversation(ask);
  const active = state !== "idle";

  const orbTone =
    state === "listening" ? "bg-[#2955C4]" : state === "thinking" ? "bg-[#6D3FBF]" : state === "speaking" ? "bg-[image:var(--sd-gradient)]" : "bg-[image:var(--sd-gradient)]";

  const fabBottom = raised ? "bottom-[calc(72px+env(safe-area-inset-bottom))]" : "bottom-5";
  const captionBottom = raised ? "bottom-[calc(140px+env(safe-area-inset-bottom))]" : "bottom-[88px]";

  return (
    <>
      {active && (
        <div
          className={`fixed right-5 z-40 w-64 rounded-2xl bg-[var(--sd-card)] p-3.5 shadow-[0_8px_24px_rgba(0,0,0,0.22)] ${captionBottom} lg:right-8 lg:bottom-[92px]`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">
              <span className={`h-1.5 w-1.5 rounded-full ${state === "error" ? "bg-slate-300" : "animate-pulse bg-[#2955C4]"}`} />
              {STATE_LABEL[state]}
            </span>
            <button onClick={stop} aria-label="Stop AI Assistant" className="text-slate-400">
              <X size={14} />
            </button>
          </div>
          <p className="mt-1.5 max-h-20 overflow-y-auto text-[12.5px] leading-relaxed text-slate-700">
            {state === "error" ? errorText : caption}
          </p>
        </div>
      )}

      <button
        onClick={() => (active ? stop() : start())}
        aria-label={active ? "Stop AI Assistant" : "Talk to AI Assistant"}
        className={`fixed right-5 z-40 flex h-14 w-14 items-center justify-center rounded-full text-white shadow-[0_8px_24px_rgba(0,0,0,0.28)] transition-all active:scale-95 lg:right-8 lg:bottom-6 ${fabBottom} ${orbTone}`}
      >
        {(state === "listening" || state === "speaking") && (
          <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-current opacity-30" />
        )}
        {state === "thinking" && (
          <span className="absolute inset-0 animate-spin rounded-full border-2 border-white/25 border-t-white/80" />
        )}
        {state === "error" ? <MicOff size={22} /> : active ? <Square size={18} /> : <Sparkles size={22} />}
      </button>
    </>
  );
}
