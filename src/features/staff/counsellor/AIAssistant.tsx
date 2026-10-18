// The counsellor's typed AI agent chat — same assistant and tools as the floating orb (useAssistant), plus a
// paperclip to attach a student's documents (passport, transcripts, English test, CV…) so the agent can read
// them and build a profile. Risky actions pop an approval card (see AssistantContext) before they run.
import { ChatMarkdown } from "../../../components/ChatMarkdown";
import { useEffect, useRef, useState } from "react";
import { Paperclip, Send, Sparkles, X } from "lucide-react";
import { PageHeader } from "../../../components/ui";
import { useAssistant } from "../../../context/AssistantContext";
import { stageFiles, getStagedFiles, clearStagedFiles } from "../../../utils/profileFromDocuments";

interface Msg { id: number; from: "ai" | "me"; text: string }

export default function CounsellorAIAssistant() {
  const { ask, suggestions } = useAssistant();
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [attached, setAttached] = useState<File[]>(() => getStagedFiles());
  const nextId = useRef(1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

  function attach(files: FileList | null) {
    if (!files) return;
    stageFiles(Array.from(files));
    setAttached([...getStagedFiles()]);
  }
  function clearAttached() { clearStagedFiles(); setAttached([]); }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    // Tell the agent about attachments so it knows to read them — the files themselves stay in the browser
    // until read_attached_documents sends them for extraction.
    const note = attached.length ? `\n\n(Attached: ${attached.map((f) => f.name).join(", ")})` : "";
    setMessages((m) => [...m, { id: nextId.current++, from: "me", text: trimmed }]);
    setInput("");
    setThinking(true);
    try {
      const reply = await ask(trimmed + note);
      setMessages((m) => [...m, { id: nextId.current++, from: "ai", text: reply }]);
    } catch {
      setMessages((m) => [...m, { id: nextId.current++, from: "ai", text: "Sorry, something went wrong — please try again." }]);
    } finally {
      setThinking(false);
      setAttached([...getStagedFiles()]);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <PageHeader title="AI Agent" subtitle="Ask about students, documents, applications and tasks — or attach a student's documents to build a profile." />
      <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto rounded-xl border border-slate-200 bg-white p-4">
        {messages.length === 0 && (
          <div className="py-8 text-center">
            <Sparkles className="mx-auto text-[var(--brand-600)]" size={22} />
            <p className="mt-2 text-sm text-slate-500">Try one of these:</p>
            <div className="mt-3 flex flex-wrap justify-center gap-2">
              {[...suggestions, "Create a profile from the documents I attached"].map((s) => (
                <button key={s} onClick={() => send(s)} className="rounded-full border border-slate-200 px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-50">{s}</button>
              ))}
            </div>
          </div>
        )}
        {messages.map((m) => (
          <div key={m.id} className={`flex ${m.from === "me" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] whitespace-pre-wrap rounded-2xl px-3.5 py-2.5 text-sm ${m.from === "me" ? "bg-[var(--brand-600)] text-white" : "bg-slate-100 text-slate-800"}`}>{m.from === "me" ? m.text : <ChatMarkdown text={m.text} />}</div>
          </div>
        ))}
        {thinking && <p className="text-xs text-slate-400">Working on it…</p>}
      </div>

      {attached.length > 0 && (
        <div className="mt-2 flex flex-wrap items-center gap-1.5">
          {attached.map((f, i) => <span key={i} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] text-slate-600">{f.name}</span>)}
          <button onClick={clearAttached} aria-label="Remove attachments" className="text-slate-400 hover:text-slate-600"><X size={14} /></button>
        </div>
      )}
      <form onSubmit={(e) => { e.preventDefault(); void send(input); }} className="mt-2 flex items-center gap-2">
        <label className="flex h-10 w-10 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50" title="Attach documents (images or PDFs, up to 8)">
          <Paperclip size={16} />
          <input type="file" multiple accept="image/*,.pdf,application/pdf" className="hidden" onChange={(e) => { attach(e.target.files); e.target.value = ""; }} />
        </label>
        <input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask the AI agent…" className="h-10 min-w-0 flex-1 rounded-lg border border-slate-200 px-3 text-sm focus:outline-none" />
        <button type="submit" disabled={thinking || !input.trim()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-600)] text-white disabled:opacity-50" aria-label="Send"><Send size={16} /></button>
      </form>
    </div>
  );
}
