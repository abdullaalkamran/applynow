// Shared wire types for the assistant — this exact shape is what crosses the network to
// server/src/routes/assistant.js, so keep it in sync with that endpoint's contract.

export type AssistantRole = "user" | "assistant" | "tool";

export interface ToolCall {
  id: string;
  name: string;
  arguments: Record<string, unknown>;
  // Provider-specific extra data that must be echoed back verbatim on a later turn (e.g. Gemini's
  // thoughtSignature for thinking models) — opaque here, only ever read/written by that provider's
  // own code on the backend. The frontend just stores and resends it untouched.
  providerMeta?: Record<string, unknown>;
}

export interface AssistantMessage {
  role: AssistantRole;
  text?: string;
  toolCalls?: ToolCall[];
  // Only set on role:"tool" messages — which call this is the result of.
  toolCallId?: string;
  toolName?: string;
  toolResult?: unknown;
}

export interface ToolSpec {
  name: string;
  description: string;
  parameters: Record<string, unknown>; // JSON Schema
}

export interface ProviderReply {
  kind: "text" | "tool_call";
  text?: string;
  toolCalls?: ToolCall[];
}
