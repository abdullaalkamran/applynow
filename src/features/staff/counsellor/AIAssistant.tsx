// The counsellor's typed AI agent chat — same assistant and tools as the floating orb (useAssistant), plus a
// paperclip to attach a student's documents (passport, transcripts, English test, CV…) so the agent can read
// them and build a profile. Risky actions pop an approval card (see AssistantContext) before they run.
import { ChatMarkdown } from "../../../components/ChatMarkdown";
import { useEffect, useRef, useState } from "react";
import { History, Paperclip, Plus, Send, Sparkles, Trash2, X } from "lucide-react";
import { loadChats, saveChat, deleteChat, newChatId, type ChatLine } from "../../../data/aiChatHistoryStore";
import { PageHeader } from "../../../components/ui";
import { useAssistant } from "../../../context/AssistantContext";
import { stageFiles, getStagedFiles, clearStagedFiles } from "../../../utils/profileFromDocuments";

type Msg = ChatLine;

export default function CounsellorAIAssistant() {
  const { ask, suggestions, getConversation, setConversation } = useAssistant();
  // The page is rebuilt whenever cached data refreshes, so the open chat is rebuilt from the last saved copy instead of starting blank.
  const [chatId, setChatId] = useState(() => localStorage.getItem("sd-ai-open-chat") ?? newChatId());
  const [chats, setChats] = useState(() => loadChats());
  const [showHistory, setShowHistory] = useState(false);
  const [messages, setMessages] = useState<Msg[]>(() => loadChats().find((c) => c.id === (localStorage.getItem("sd-ai-open-chat") ?? ""))?.lines ?? []);
  const [input, setInput] = useState("");
  const [thinking, setThinking] = useState(false);
  const [attached, setAttached] = useState<File[]>(() => getStagedFiles());
  const nextId = useRef(messages.reduce((m, l) => Math.max(m, l.id), 0) + 1);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => { listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" }); }, [messages, thinking]);

  function attach(files: FileList | null) {
    if (!files) return;
    stageFiles(Array.from(files));
    setAttached([...getStagedFiles()]);
  }
  function remember(lines: Msg[]) {
    saveChat(chatId, lines, getConversation());
    localStorage.setItem("sd-ai-open-chat", chatId);
    setChats(loadChats());
  }

  function startNewChat() {
    const id = newChatId();
    localStorage.setItem("sd-ai-open-chat", id);
    setConversation([]);
    setMessages([]);
    setChatId(id);
    setShowHistory(false);
  }

  function openChat(id: string) {
    const chat = loadChats().find((c) => c.id === id);
    if (!chat) return;
    localStorage.setItem("sd-ai-open-chat", id);
    setConversation(chat.history);
    setMessages(chat.lines);
    nextId.current = chat.lines.reduce((m, l) => Math.max(m, l.id), 0) + 1;
    setChatId(id);
    setShowHistory(false);
  }

  function removeChat(id: string) {
    deleteChat(id);
    setChats(loadChats());
    if (id === chatId) startNewChat();
  }

  function clearAttached() { clearStagedFiles(); setAttached([]); }

  async function send(text: string) {
    const trimmed = text.trim();
    if (!trimmed || thinking) return;
    // Tell the agent about attachments so it knows to read them — the files themselves stay in the browser
    // until read_attached_documents sends them for extraction.
    const note = attached.length ? `\n\n(Attached: ${attached.map((f) => f.name).join(", ")})` : "";
    let lines: Msg[] = [...messages, { id: nextId.current++, from: "me", text: trimmed }];
    setMessages(lines);
    setInput("");
    setThinking(true);
    try {
      // A whole turn can chain several AI calls and tool runs; if it still has not finished after two and a half minutes,
      // free the chat instead of leaving "Working on it…" on screen forever.
      const reply = await Promise.race([
        ask(trimmed + note),
        new Promise<string>((resolve) => setTimeout(() => resolve("That is taking too long — the AI service may be busy. Please try again."), 150_000)),
      ]);
      lines = [...lines, { id: nextId.current++, from: "ai", text: reply }];
      setMessages(lines);
    } catch {
      lines = [...lines, { id: nextId.current++, from: "ai", text: "Sorry, something went wrong — please try again." }];
      setMessages(lines);
    } finally {
      remember(lines);
      setThinking(false);
      setAttached([...getStagedFiles()]);
    }
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-8rem)] max-w-3xl flex-col">
      <PageHeader
        title="AI Agent"
        subtitle="Ask about students, documents, applications and tasks — or attach a student's documents to build a profile."
        action={
          <div className="flex shrink-0 items-center gap-2">
            <button onClick={() => setShowHistory((v) => !v)} className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50">
              <History size={14} /> History{chats.length > 0 ? ` (${chats.length})` : ""}
            </button>
            <button onClick={startNewChat} className="flex items-center gap-1.5 rounded-lg bg-[var(--brand-600)] px-3 py-2 text-xs font-medium text-white">
              <Plus size={14} /> New chat
            </button>
          </div>
        }
      />
      {showHistory && (
        <div className="mb-3 max-h-56 overflow-y-auto rounded-xl border border-slate-200 bg-white p-2">
          {chats.length === 0 ? (
            <p className="p-3 text-center text-xs text-slate-400">No saved chats yet.</p>
          ) : (
            chats.map((c) => (
              <div key={c.id} className={`flex items-center gap-2 rounded-lg px-3 py-2 hover:bg-slate-50 ${c.id === chatId ? "bg-slate-50" : ""}`}>
                <button onClick={() => openChat(c.id)} className="min-w-0 flex-1 text-left">
                  <p className="truncate text-[13px] font-medium text-slate-700">{c.title}</p>
                  <p className="text-[11px] text-slate-400">{new Date(c.updatedAt).toLocaleString()} · {c.lines.length} messages</p>
                </button>
                <button onClick={() => removeChat(c.id)} aria-label="Delete chat" className="shrink-0 text-slate-300 hover:text-rose-500"><Trash2 size={14} /></button>
              </div>
            ))
          )}
        </div>
      )}
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
