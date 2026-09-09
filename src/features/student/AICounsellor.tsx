import { useRef, useState } from "react";
import { Paperclip, Mic, Send, Sparkles } from "lucide-react";
import { MobileHeader } from "../../components/ui/mobile";

interface ChatMessage { id: string; from: "ai" | "me"; text: string }

const SUGGESTIONS = [
  "Am I eligible for UK?",
  "Suggest universities for me",
  "Help with SOP",
  "Explain visa process",
  "What scholarships can I get?",
];

const CANNED_REPLY = "Great question — let me pull together some tailored guidance based on your profile. One moment!";

export default function AICounsellor() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: "m0", from: "ai", text: "Hi Sarah! 👋 How can I help you today?" },
  ]);
  const [input, setInput] = useState("");
  const nextId = useRef(1);

  function send(text: string) {
    if (!text.trim()) return;
    const userMsg: ChatMessage = { id: `u${nextId.current++}`, from: "me", text };
    const aiMsg: ChatMessage = { id: `a${nextId.current++}`, from: "ai", text: CANNED_REPLY };
    setMessages((prev) => [...prev, userMsg, aiMsg]);
    setInput("");
  }

  return (
    <div className="flex min-h-full flex-col">
      <MobileHeader
        title="AI Counsellor"
        right={
          <span className="flex items-center gap-1 text-[11px] font-medium text-[var(--sd-teal)]">
            <span className="h-1.5 w-1.5 rounded-full bg-[var(--sd-teal)]" /> Online
          </span>
        }
      />

      <div className="flex-1 space-y-3 px-5 py-2">
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            {m.from === "ai" && (
              <div className="mr-2 flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#F1EAFB] text-[#6D3FBF]">
                <Sparkles size={13} />
              </div>
            )}
            <div
              className={`max-w-[75%] rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed ${
                m.from === "me" ? "rounded-tr-sm bg-[var(--sd-ink)] text-white" : "rounded-tl-sm bg-white text-slate-700 shadow-sm shadow-black/[0.03]"
              }`}
            >
              {m.text}
            </div>
          </div>
        ))}

        {messages.length === 1 && (
          <div className="space-y-2 pl-9">
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                className="block w-full rounded-xl bg-white px-3.5 py-2.5 text-left text-[13px] text-[#2955C4] shadow-sm shadow-black/[0.03]"
              >
                {s}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="sticky bottom-0 bg-[var(--sd-bg)] px-5 pb-2 pt-3">
        <div className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 shadow-sm shadow-black/[0.03]">
          <button className="text-slate-400"><Paperclip size={18} /></button>
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && send(input)}
            placeholder="Type or speak your question..."
            className="w-full bg-transparent text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
          <button className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-slate-400">
            <Mic size={17} />
          </button>
          <button
            onClick={() => send(input)}
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sd-ink)] text-white"
          >
            <Send size={14} />
          </button>
        </div>
        <p className="pb-1 pt-2.5 text-center text-[11px] text-slate-400">Powered by StudyOne AI</p>
      </div>
    </div>
  );
}
