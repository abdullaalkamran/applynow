import type { AssistantMessage, ProviderReply, ToolSpec } from "./assistantTypes";
import { BACKEND_BASE } from "./backendBase";

const API_URL = `${BACKEND_BASE}/api/assistant`;

export async function sendAssistantRequest(
  systemPrompt: string,
  messages: AssistantMessage[],
  tools: ToolSpec[],
  token: string
): Promise<ProviderReply> {
  const response = await fetch(API_URL, {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify({ systemPrompt, messages, tools }),
  });

  if (!response.ok) {
    const detail = await response.text().catch(() => "");
    throw new Error(`Assistant request failed (${response.status}): ${detail}`);
  }

  return response.json();
}
