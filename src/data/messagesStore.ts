// Postgres-backed via /api/messages (server/src/routes/messages.js) — same synchronous-cache
// pattern as applicationsStore.ts. Minimal append-only per-thread message log, used today by the
// student AI assistant's "send a message" tool; the full staff/student Messages inbox UI still
// runs on its own separate store (counsellorMessagesStore.ts), a deferred migration.
import type { Role } from "../types";
import { apiGet, apiPost } from "../utils/apiClient";
import { notifyCacheChange } from "../utils/syncCache";

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
  createdAt: string;
}

const cache: Record<string, Message[]> = {};

export function threadIdFor(a: { role: Role; id: string }, b: { role: Role; id: string }): string {
  const left = `${a.role}:${a.id}`;
  const right = `${b.role}:${b.id}`;
  return [left, right].sort().join("__");
}

function refreshThread(threadId: string) {
  apiGet<Message[]>(`/api/messages/${threadId}`)
    .then((messages) => {
      cache[threadId] = messages;
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to load messages from server:", err));
}

export function loadMessages(threadId: string): Message[] {
  if (!cache[threadId]) {
    cache[threadId] = [];
    refreshThread(threadId);
  }
  return cache[threadId];
}

export function sendMessage(input: Omit<Message, "id" | "createdAt" | "threadId">): Message {
  const threadId = threadIdFor(input.from, input.to);
  const message: Message = {
    ...input,
    id: `msg-${Date.now().toString(36)}`,
    threadId,
    createdAt: new Date().toISOString(),
  };
  cache[threadId] = [...(cache[threadId] ?? []), message];
  notifyCacheChange();
  apiPost<Message>("/api/messages", input)
    .then((serverMessage) => {
      cache[threadId] = (cache[threadId] ?? []).map((m) => (m.id === message.id ? serverMessage : m));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to persist message:", err));
  return message;
}
