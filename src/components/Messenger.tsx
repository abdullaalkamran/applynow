import { useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus, Send, Search } from "lucide-react";
import {
  getThreadsList, getContacts, loadMessages, sendMessage, markThreadRead, threadIdFor,
  type MessageParticipant,
} from "../data/messagesStore";
import { useRole } from "../context/RoleContext";

const AVATAR_COLORS = ["bg-sky-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-indigo-500", "bg-teal-500"];

function avatarColorFor(id: string): string {
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = (hash * 31 + id.charCodeAt(i)) % AVATAR_COLORS.length;
  return AVATAR_COLORS[hash];
}

function initials(name: string): string {
  return name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
}

function relativeTime(iso: string): string {
  const mins = Math.round((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h`;
  return `${Math.round(hours / 24)}d`;
}

const ROLE_LABEL: Record<string, string> = {
  student: "Student", agent: "Agent", counsellor: "Counsellor", admission: "Admission",
  compliance: "Compliance", data: "Data", finance: "Finance", admin: "Admin",
};

/** A real, WhatsApp-style 1:1 messenger — contact list + chat thread, backed by the app's actual
 * direct-messaging system (server/src/routes/messages.js). Shared across every role (student,
 * counsellor, agent, and the shared staff shell), since `useRole()` supplies whichever identity
 * and contact list actually apply. A comment posted elsewhere in the app (on an application or a
 * student's case) also lands here as an individual message from whoever posted it — see
 * applications.js/students.js's own comment routes for that fan-out. */
export function Messenger() {
  const { role, currentUser } = useRole();
  const me: MessageParticipant = { id: currentUser.id, role, name: currentUser.name };

  // Which conversation is open lives in router state, not plain useState — sending a message (or
  // any other store write anywhere in the app) bumps the shared cache tick that keys every shell's
  // <Outlet>, remounting this whole page (see syncCache.ts's useCacheSync doc comment). A plain
  // useState would reset to null on that remount, making the chat appear to "close" right after
  // you send something. Router state survives a remount, so this recovers the same conversation
  // instead (same idiom CounsellorStudentProfile.tsx uses for its own expanded-row state).
  const location = useLocation();
  const navigate = useNavigate();
  const selected = (location.state as { counterpart?: MessageParticipant } | null)?.counterpart ?? null;

  function selectCounterpart(counterpart: MessageParticipant | null) {
    navigate(location.pathname, { replace: true, state: counterpart ? { counterpart } : null });
  }

  const [showContacts, setShowContacts] = useState(false);
  const [contactQuery, setContactQuery] = useState("");
  const [draft, setDraft] = useState("");

  const threads = getThreadsList();
  const contacts = getContacts();
  const threadedKeys = new Set(threads.map((t) => `${t.counterpart.role}:${t.counterpart.id}`));
  const newContacts = contacts
    .filter((c) => !threadedKeys.has(`${c.role}:${c.id}`))
    .filter((c) => c.name.toLowerCase().includes(contactQuery.toLowerCase()));

  const selectedThreadId = selected ? threadIdFor(me, selected) : null;
  const messages = selectedThreadId ? loadMessages(selectedThreadId) : [];

  useEffect(() => {
    if (selectedThreadId) markThreadRead(selectedThreadId);
  }, [selectedThreadId]);

  function openThread(counterpart: MessageParticipant) {
    selectCounterpart(counterpart);
    setShowContacts(false);
    setContactQuery("");
  }

  function send() {
    const text = draft.trim();
    if (!text || !selected) return;
    sendMessage(selected, text, me);
    setDraft("");
  }

  return (
    <div className="flex h-[75dvh] min-h-[420px] overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
      {/* Conversation list — hidden on mobile once a thread is open */}
      <div className={`w-full shrink-0 flex-col border-r border-slate-100 sm:flex sm:w-72 ${selected ? "hidden" : "flex"}`}>
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <p className="text-sm font-semibold text-slate-800">{showContacts ? "New message" : "Messages"}</p>
          <button
            onClick={() => setShowContacts((v) => !v)}
            aria-label={showContacts ? "Back to conversations" : "New message"}
            className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-600 hover:bg-slate-200"
          >
            {showContacts ? <ArrowLeft size={14} /> : <Plus size={14} />}
          </button>
        </div>

        {showContacts ? (
          <div className="flex flex-1 flex-col overflow-hidden">
            <div className="flex items-center gap-2 border-b border-slate-100 px-4 py-2.5">
              <Search size={13} className="text-slate-400" />
              <input
                value={contactQuery}
                onChange={(e) => setContactQuery(e.target.value)}
                placeholder="Search people…"
                className="w-full text-[13px] text-slate-700 outline-none placeholder:text-slate-400"
              />
            </div>
            <div className="flex-1 overflow-y-auto">
              {newContacts.map((c) => (
                <button
                  key={`${c.role}:${c.id}`}
                  onClick={() => openThread(c)}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${avatarColorFor(c.id)}`}>
                    {initials(c.name)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13px] font-medium text-slate-800">{c.name}</p>
                    <p className="text-[11px] text-slate-400">{ROLE_LABEL[c.role] ?? c.role}</p>
                  </div>
                </button>
              ))}
              {newContacts.length === 0 && <p className="px-4 py-6 text-center text-[12.5px] text-slate-400">No one else to message yet.</p>}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            {threads.map((t) => (
              <button
                key={t.threadId}
                onClick={() => openThread(t.counterpart)}
                className={`flex w-full items-center gap-2.5 px-4 py-3 text-left hover:bg-slate-50 ${
                  selected && t.counterpart.id === selected.id && t.counterpart.role === selected.role ? "bg-slate-50" : ""
                }`}
              >
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${avatarColorFor(t.counterpart.id)}`}>
                  {initials(t.counterpart.name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <p className={`truncate text-[13px] ${t.unread > 0 ? "font-semibold text-slate-900" : "font-medium text-slate-800"}`}>{t.counterpart.name}</p>
                    <span className="shrink-0 text-[10.5px] text-slate-400">{relativeTime(t.lastMessage.createdAt)}</span>
                  </div>
                  <p className="truncate text-[12px] text-slate-500">{t.lastMessage.text}</p>
                </div>
                {t.unread > 0 && (
                  <span className="flex h-4.5 min-w-[18px] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                    {t.unread}
                  </span>
                )}
              </button>
            ))}
            {threads.length === 0 && <p className="px-4 py-6 text-center text-[12.5px] text-slate-400">No conversations yet — tap + to message someone.</p>}
          </div>
        )}
      </div>

      {/* Chat thread */}
      <div className={`min-w-0 flex-1 flex-col sm:flex ${selected ? "flex" : "hidden"}`}>
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-[13px] text-slate-400">Select a conversation</div>
        ) : (
          <>
            <div className="flex items-center gap-2.5 border-b border-slate-100 px-4 py-3">
              <button onClick={() => selectCounterpart(null)} className="rounded-full p-1 text-slate-500 hover:bg-slate-100 sm:hidden">
                <ArrowLeft size={16} />
              </button>
              <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white ${avatarColorFor(selected.id)}`}>
                {initials(selected.name)}
              </div>
              <div className="min-w-0">
                <p className="truncate text-[13.5px] font-semibold text-slate-800">{selected.name}</p>
                <p className="text-[11px] text-slate-400">{ROLE_LABEL[selected.role] ?? selected.role}</p>
              </div>
            </div>

            <div className="flex-1 space-y-2 overflow-y-auto px-4 py-3">
              {messages.map((m) => {
                const mine = m.from.id === me.id && m.from.role === me.role;
                return (
                  <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-[75%] rounded-2xl px-3.5 py-2 text-[13px] ${
                        mine ? "bg-[image:var(--sd-gradient)] text-white" : "bg-slate-100 text-slate-800"
                      }`}
                    >
                      <p className="whitespace-pre-wrap break-words">{m.text}</p>
                      <p className={`mt-1 text-[10px] ${mine ? "text-white/70" : "text-slate-400"}`}>{relativeTime(m.createdAt)}</p>
                    </div>
                  </div>
                );
              })}
              {messages.length === 0 && <p className="py-6 text-center text-[12.5px] text-slate-400">No messages yet — say hello.</p>}
            </div>

            <div className="flex items-center gap-2 border-t border-slate-100 p-3">
              <input
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && send()}
                placeholder="Type a message…"
                className="flex-1 rounded-full border border-slate-200 px-4 py-2 text-[13px] text-slate-700 outline-none placeholder:text-slate-400 focus:border-slate-300"
              />
              <button
                onClick={send}
                disabled={!draft.trim()}
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[image:var(--sd-gradient)] text-white disabled:opacity-40"
                aria-label="Send"
              >
                <Send size={15} />
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
