// Saved AI Agent conversations for the signed-in account (this browser). Each chat keeps what was shown on screen and the
// model-side history, so reopening one lets the agent carry on with the same context.
import { userScopedKey } from "../utils/userScope";
import type { AssistantMessage } from "../utils/assistantTypes";

export interface ChatLine { id: number; from: "ai" | "me"; text: string }

export interface SavedChat {
  id: string;
  title: string;
  updatedAt: string; // ISO
  lines: ChatLine[];
  history: AssistantMessage[];
}

const KEY = "sd-ai-chats";
const MAX_CHATS = 40;
const MAX_LINES = 100;

export function loadChats(): SavedChat[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(userScopedKey(KEY));
    const list = raw ? (JSON.parse(raw) as SavedChat[]) : [];
    return list.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  } catch {
    return [];
  }
}

function persist(list: SavedChat[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(userScopedKey(KEY), JSON.stringify(list.slice(0, MAX_CHATS)));
  } catch {
    // Storage full or blocked — history simply isn't kept.
  }
}

/** Large attachments are not worth keeping in a saved chat. */
function slim(history: AssistantMessage[]): AssistantMessage[] {
  return history.slice(-60).map((m) => ({ ...m, image: undefined }));
}

export function newChatId(): string {
  return `chat-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
}

export function saveChat(id: string, lines: ChatLine[], history: AssistantMessage[]) {
  if (lines.length === 0) return;
  const list = loadChats().filter((c) => c.id !== id);
  const firstQuestion = lines.find((l) => l.from === "me")?.text ?? "New chat";
  list.unshift({
    id, title: firstQuestion.length > 60 ? `${firstQuestion.slice(0, 57)}…` : firstQuestion,
    updatedAt: new Date().toISOString(), lines: lines.slice(-MAX_LINES), history: slim(history),
  });
  persist(list);
}

export function deleteChat(id: string) {
  persist(loadChats().filter((c) => c.id !== id));
}
