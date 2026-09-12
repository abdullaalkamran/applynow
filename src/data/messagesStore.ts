// Minimal append-only per-thread message log — deliberately not a full inbox (no read receipts,
// no attachments). Exists so the assistant can actually send a message on a user's behalf; a
// thread id is deterministic from its two participants so the same pair always lands in one thread.
import type { Role } from "../types";

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

const STORAGE_PREFIX = "sd-messages:";

export function threadIdFor(a: { role: Role; id: string }, b: { role: Role; id: string }): string {
  const left = `${a.role}:${a.id}`;
  const right = `${b.role}:${b.id}`;
  return [left, right].sort().join("__");
}

export function loadMessages(threadId: string): Message[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + threadId);
    return raw ? (JSON.parse(raw) as Message[]) : [];
  } catch {
    return [];
  }
}

function persist(threadId: string, messages: Message[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + threadId, JSON.stringify(messages));
}

export function sendMessage(input: Omit<Message, "id" | "createdAt" | "threadId">): Message {
  const threadId = threadIdFor(input.from, input.to);
  const message: Message = {
    ...input,
    id: `msg-${Date.now().toString(36)}`,
    threadId,
    createdAt: new Date().toISOString(),
  };
  persist(threadId, [...loadMessages(threadId), message]);
  return message;
}
