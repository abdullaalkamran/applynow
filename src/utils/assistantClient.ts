import type { AssistantMessage, ProviderReply, ToolSpec } from "./assistantTypes";
import { BACKEND_BASE } from "./backendBase";

const API_URL = `${BACKEND_BASE}/api/assistant`;
const ASSISTANT_TIMEOUT_MS = 75_000;

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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Sends one assistant request; a dropped connection or a gateway error (502/503/504) is tried once more, since asking the
 * model again is harmless. Anything else — a missing key, a rate limit — is reported as-is. */
export async function sendAssistantRequest(
  systemPrompt: string,
  messages: AssistantMessage[],
  tools: ToolSpec[],
  token: string
): Promise<ProviderReply> {
  try {
    return await sendOnce(systemPrompt, messages, tools, token);
  } catch (err) {
    const retryable = err instanceof AssistantRequestError && (err.status === 0 || err.status === 502 || err.status === 503 || err.status === 504);
    if (!retryable) throw err;
    await sleep(1500);
    return sendOnce(systemPrompt, messages, tools, token);
  }
}

async function sendOnce(
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
    if (!body && (response.status === 502 || response.status === 503 || response.status === 504)) {
      // The hosting proxy answered (an HTML error page), not our server.
      throw new AssistantRequestError("The server took too long to answer — please try again.", response.status, true);
    }
    throw new AssistantRequestError(body?.error || `Assistant request failed (${response.status})`, response.status, friendly);
  }

  return response.json();
}
