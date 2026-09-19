// Postgres-backed via /api/messages (server/src/routes/messages.js) — real 1:1 direct messaging,
// the backbone of the in-app "Messages" pages (a WhatsApp-style contact list + chat thread per
// role) and, before that UI existed, the student AI assistant's "send a message" tool. `from` is
// always derived server-side from whoever's authenticated, never trusted from the client.
import type { Role } from "../types";
import { apiGet, apiPost, apiPatch } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";

export interface MessageParticipant {
  role: Role;
  id: string;
  name: string;
}

export interface Message {
  id: string;
  threadId: string;
  from: MessageParticipant;
  to: MessageParticipant;
  text: string;
  read: boolean;
  createdAt: string;
}

export interface MessageThread {
  threadId: string;
  counterpart: MessageParticipant;
  lastMessage: Message;
  unread: number;
}

const cache: Record<string, Message[]> = {};
let contacts: MessageParticipant[] = [];
let threads: MessageThread[] = [];

export function threadIdFor(a: { role: Role; id: string }, b: { role: Role; id: string }): string {
  const left = `${a.role}:${a.id}`;
  const right = `${b.role}:${b.id}`;
  return [left, right].sort().join("__");
}

function refreshThread(threadId: string) {
  apiGet<Message[]>(`/api/messages/${threadId}`)
    .then((messages) => {
      if (!cacheChanged(messages, cache[threadId] ?? [])) return;
      cache[threadId] = messages;
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to load messages from server:", err));
}

/** Always refetches, like applicationActivityStore.ts's loadActivityDescending — an open chat
 * thread should pick up the other side's reply the moment it's reopened, not up to 12s later. */
export function loadMessages(threadId: string): Message[] {
  if (!cache[threadId]) cache[threadId] = [];
  refreshThread(threadId);
  return cache[threadId];
}

export function sendMessage(to: MessageParticipant, text: string, from: MessageParticipant): Message {
  const threadId = threadIdFor(from, to);
  const optimistic: Message = {
    id: `msg-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
    threadId,
    from,
    to,
    text,
    read: false,
    createdAt: new Date().toISOString(),
  };
  cache[threadId] = [...(cache[threadId] ?? []), optimistic];
  notifyCacheChange();

  apiPost<Message>("/api/messages", { to, text })
    .then((serverMessage) => {
      cache[threadId] = (cache[threadId] ?? []).map((m) => (m.id === optimistic.id ? serverMessage : m));
      notifyCacheChange();
      refreshThreadsList();
    })
    .catch((err) => console.warn("Failed to persist message:", err));

  return optimistic;
}

export function markThreadRead(threadId: string) {
  const thread = threads.find((t) => t.threadId === threadId);
  if (!thread || thread.unread === 0) return;
  threads = threads.map((t) => (t.threadId === threadId ? { ...t, unread: 0 } : t));
  notifyCacheChange();
  apiPatch(`/api/messages/${threadId}/read`, {}).catch((err) => console.warn("Failed to mark thread read:", err));
}

/** The chat-list side of the messenger — one row per conversation, newest first, with an unread
 * count. Bulk-fetched like tasksStore.ts rather than lazily per-thread, since "all my
 * conversations" is naturally one request. */
export async function refreshThreadsList(): Promise<void> {
  const next = await apiGet<MessageThread[]>("/api/messages/threads");
  if (!cacheChanged(next, threads)) return;
  threads = next;
  notifyCacheChange();
}

export function getThreadsList(): MessageThread[] {
  return threads;
}

export function unreadMessageCount(): number {
  return threads.reduce((sum, t) => sum + t.unread, 0);
}

/** Everyone the current user is allowed to start a new conversation with — see the server's own
 * getContactsFor for the actual "who's connected to whom" rule per role. */
export async function refreshContacts(): Promise<void> {
  const next = await apiGet<MessageParticipant[]>("/api/messages/contacts");
  if (!cacheChanged(next, contacts)) return;
  contacts = next;
  notifyCacheChange();
}

export function getContacts(): MessageParticipant[] {
  return contacts;
}

export function refreshCachedMessageThreads(): void {
  Object.keys(cache).forEach((threadId) => refreshThread(threadId));
}
