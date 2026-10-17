import { useEffect, useRef, useState } from "react";
import { X } from "lucide-react";
import { useActiveVoiceConversation } from "../../utils/useActiveVoiceConversation";
import { useAssistant } from "../../context/AssistantContext";
import { useMicLevel } from "../../utils/useMicLevel";
import { VoiceOrb } from "./VoiceOrb";

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

  const micLevel = useMicLevel(state === "listening");

  // Every time the agent wakes up, a ripple of colour sweeps out from the globe across the whole screen once.
  const [burst, setBurst] = useState(0);
  const wasActive = useRef(false);
  useEffect(() => {
    if (active && !wasActive.current) setBurst((n) => n + 1);
    wasActive.current = active;
  }, [active]);

  // While live, the globe and the colour around it move with the conversation: they swell with your voice while it
  // listens, and breathe in time with its own speech while it talks. Written straight to the elements each frame so
  // React isn't re-rendering at 60fps.
  const washRef = useRef<HTMLDivElement>(null);
  const orbRef = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    if (!active) return;
    const wash = washRef.current;
    const orb = orbRef.current;
    let raf = 0;
    let lvl = 0;
    const tick = (now: number) => {
      let target = 0.12;
      if (state === "listening") target = 0.12 + micLevel.current * 1.3;
      else if (state === "speaking") target = 0.35 + 0.4 * (0.5 + 0.5 * Math.sin(now / 130)) * (0.6 + 0.4 * Math.sin(now / 410));
      else if (state === "thinking") target = 0.3 + 0.2 * Math.sin(now / 220);
      lvl += (Math.min(target, 1) - lvl) * 0.18;
      wash?.style.setProperty("--lvl", lvl.toFixed(3));
      if (orb) orb.style.transform = `scale(${(1 + lvl * 0.32).toFixed(3)})`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      wash?.style.removeProperty("--lvl");
      if (orb) orb.style.transform = "";
    };
  }, [active, state, micLevel]);

  const fabBottom = raised ? "bottom-[calc(96px+env(safe-area-inset-bottom))]" : "bottom-5";
  const captionBottom = raised ? "bottom-[calc(150px+env(safe-area-inset-bottom))]" : "bottom-[76px]";

  return (
    <>
      {active && (
        <div
          className={`fixed right-5 z-40 w-64 rounded-2xl bg-[var(--sd-card)] p-3.5 shadow-neu-lg ${captionBottom} lg:right-8 lg:bottom-[80px]`}
        >
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">
              <span className={`h-1.5 w-1.5 rounded-full ${state === "error" ? "bg-neutral-300" : "animate-pulse bg-neutral-900"}`} />
              {STATE_LABEL[state]}
            </span>
            <button onClick={stop} aria-label="Stop AI Assistant" className="text-neutral-400">
              <X size={14} />
            </button>
          </div>
          <p className="mt-1.5 max-h-20 overflow-y-auto text-[12.5px] leading-relaxed text-neutral-700">
            {state === "error" ? errorText : caption}
          </p>
        </div>
      )}

      {/* While live, a soft wash of the globe's colours spreads out from it across the screen. */}
      <div ref={washRef} aria-hidden="true" className={`ai-fab-wash pointer-events-none fixed inset-0 z-30 ${active ? "is-on" : ""}`} />
      {burst > 0 && active && (
        <div
          key={burst}
          aria-hidden="true"
          onAnimationEnd={() => setBurst(0)}
          className={`ai-fab-burst pointer-events-none fixed inset-0 z-30 lg:[--ox:calc(100%-54px)] lg:[--oy:calc(100%-46px)] ${
            raised ? "[--ox:calc(100%-42px)] [--oy:calc(100%-118px-env(safe-area-inset-bottom))]" : "[--ox:calc(100%-42px)] [--oy:calc(100%-42px)]"
          }`}
        />
      )}

      {/* The button IS the globe: silvery while it rests, then the colour floods in as it goes live — the same orb the
          whole time, so tapping it just wakes it up in place. Tap again to end the conversation. */}
      <button
        onClick={() => (active ? stop() : start())}
        aria-label={active ? "Stop AI Assistant" : "Talk to AI Assistant"}
        className={`fixed right-5 z-40 ai-fab flex h-11 w-11 items-center justify-center rounded-full bg-transparent transition-transform active:scale-95 lg:right-8 lg:bottom-6 ${fabBottom}`}
      >
        <span ref={orbRef} className="pointer-events-none absolute -inset-[9px] transition-transform duration-100">
          <VoiceOrb state={state} size={62} level={micLevel} floor={false} muted={!active} />
        </span>
      </button>
    </>
  );
}
