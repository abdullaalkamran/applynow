import type { AssistantMessage, ProviderReply, ToolSpec } from "./assistantTypes";
import { BACKEND_BASE } from "./backendBase";

const API_URL = `${BACKEND_BASE}/api/assistant`;
const ASSISTANT_TIMEOUT_MS = 120_000;

/** An error whose message the server wrote for the user (e.g. "the AI provider's API key is missing") — safe to show as-is. */
export class AssistantRequestError extends Error {
  friendly: boolean;
  status: number;
  constructor(message: string, status: number, friendly: boolean) {
    super(message);
    this.name = "AssistantRequestError";
    this.status = status;
    this.friendly = friendly;
  }
}

export async function sendAssistantRequest(
  systemPrompt: string,
  messages: AssistantMessage[],
  tools: ToolSpec[],
  token: string
): Promise<ProviderReply> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ASSISTANT_TIMEOUT_MS);
  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: "POST",
      headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
      body: JSON.stringify({ systemPrompt, messages, tools }),
      signal: controller.signal,
    });
  } catch (err) {
    if ((err as Error)?.name === "AbortError") throw new AssistantRequestError("The AI service took too long to answer — please try again.", 504, true);
    throw new AssistantRequestError("Couldn't reach the server — check your connection and try again.", 0, true);
  } finally {
    clearTimeout(timer);
  }

  if (!response.ok) {
    const body = await response.json().catch(() => null) as { error?: string } | null;
    // Only the server's deliberate, user-facing messages (4xx/503/504 with an error string) are surfaced; an
    // opaque "Internal server error" stays generic so nothing internal leaks.
    const friendly = !!body?.error && body.error !== "Internal server error";
    throw new AssistantRequestError(body?.error || `Assistant request failed (${response.status})`, response.status, friendly);
  }

  return response.json();
}
