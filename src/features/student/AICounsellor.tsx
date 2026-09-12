import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Send, Sparkles, Mic, Volume2, VolumeX } from "lucide-react";
import { MobileHeader } from "../../components/ui/mobile";
import { VoiceModePanel } from "../../components/ui/VoiceMode";
import { type ChatMessage, aiStudent } from "../../utils/aiCounsellorEngine";
import { useAssistant } from "../../context/AssistantContext";

export default function AICounsellor() {
  const navigate = useNavigate();
  const { ask, suggestions } = useAssistant();
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "m0", from: "ai", text: `Hi ${aiStudent.name.split(" ")[0]}! 👋 How can I help you today?` },
  ]);
  const [input, setInput] = useState("");
  const [voiceOpen, setVoiceOpen] = useState(false);
  const [voiceMode, setVoiceMode] = useState(true);
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    return () => { window.speechSynthesis?.cancel(); };
  }, []);

  function speak(text: string) {
    if (!voiceMode || typeof window === "undefined" || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.rate = 1;
    window.speechSynthesis.speak(utterance);
  }

  async function send(text: string) {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: `u${nextId.current++}`, from: "me", text };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    const replyText = await ask(text);
    const aiMsg: ChatMessage = { id: `a${nextId.current++}`, from: "ai", text: replyText };
    setMessages((prev) => [...prev, aiMsg]);
    speak(replyText);
  }

  function addExchange(userText: string, aiText: string) {
    setMessages((prev) => [
      ...prev,
      { id: `u${nextId.current++}`, from: "me", text: userText },
      { id: `a${nextId.current++}`, from: "ai", text: aiText },
    ]);
  }

  return (
    <div className="flex min-h-full flex-col">
      <MobileHeader
        title="AI Counsellor"
        right={
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => { setVoiceMode((v) => !v); window.speechSynthesis?.cancel(); }}
              aria-label={voiceMode ? "Turn off spoken replies" : "Turn on spoken replies"}
              className={`flex h-8 w-8 items-center justify-center rounded-full ${voiceMode ? "bg-[#F1EAFB] text-[#6D3FBF]" : "bg-slate-100 text-slate-400"}`}
            >
              {voiceMode ? <Volume2 size={14} /> : <VolumeX size={14} />}
            </button>
          </div>
        }
      />

      {voiceOpen ? (
        <VoiceModePanel onExit={() => setVoiceOpen(false)} onExchange={addExchange} />
      ) : (
        <>
          <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto px-5 py-2">
            {messages.map((m) => (
              <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
                {m.from === "ai" && (
                  <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1EAFB] text-[#6D3FBF]">
                    <Sparkles size={13} />
                  </div>
                )}
                <div
                  className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                    m.from === "me" ? "rounded-tr-sm bg-[var(--sd-ink)] text-white" : "rounded-tl-sm bg-[var(--sd-card)] text-slate-700 shadow-[0_0_10px_rgba(0,0,0,0.11)]"
                  }`}
                >
                  {m.text}
                </div>
              </div>
            ))}

            {messages.length === 1 && (
              <div className="space-y-2 pl-9">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => send(s)}
                    className="block w-full rounded-xl bg-[var(--sd-card)] px-3.5 py-2.5 text-left text-[13px] text-[#2955C4] shadow-[0_0_10px_rgba(0,0,0,0.11)]"
                  >
                    {s}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="sticky bottom-0 bg-[var(--sd-bg)] px-5 pb-2 pt-3">
            <div className="flex items-center gap-2 rounded-2xl bg-[var(--sd-card)] px-3 py-2 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
              <input
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send(input)}
                placeholder="Type, or tap the mic to talk live..."
                className="w-full bg-transparent text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              <button
                onClick={() => setVoiceOpen(true)}
                aria-label="Start live voice conversation"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#F1EAFB] text-[#6D3FBF]"
              >
                <Mic size={17} />
              </button>
              <button
                onClick={() => send(input)}
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sd-ink)] text-white"
              >
                <Send size={14} />
              </button>
            </div>
            <button onClick={() => navigate("/student/messages")} className="w-full pb-1 pt-2.5 text-center text-[11px] text-slate-400">
              Powered by StudyOne AI · Talk to a human counsellor
            </button>
          </div>
        </>
      )}
    </div>
  );
}
