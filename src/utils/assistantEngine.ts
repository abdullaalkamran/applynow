import type { Role } from "../types";
import { sendAssistantRequest } from "./assistantClient";
import type { AssistantMessage, ToolSpec } from "./assistantTypes";

export interface ToolDefinition {
  spec: ToolSpec;
  // Runs the real store mutator/reader in the browser — the backend never touches localStorage.
  execute: (args: Record<string, unknown>) => Promise<unknown> | unknown;
}

export interface AssistantUserContext {
  userId: string;
  userName: string;
}

export interface RoleAssistantConfig {
  role: Role;
  systemPrompt: (ctx: AssistantUserContext) => string;
  // A factory, not a static array, so each tool's `execute` closure captures the current user.
  tools: (ctx: AssistantUserContext) => ToolDefinition[];
  suggestions: string[];
}

const MAX_TOOL_ITERATIONS = 5;

/**
 * One full turn: send the user's message (plus running history) to the backend, and if the model
 * wants to call a tool, run it locally against real app data and send the result back — looping
 * until the model returns a final text reply or we hit the iteration cap (a runaway-loop guard).
 */
export async function runAssistantTurn(
  config: RoleAssistantConfig,
  ctx: AssistantUserContext,
  history: AssistantMessage[],
  userText: string
): Promise<{ reply: string; updatedHistory: AssistantMessage[] }> {
  const tools = config.tools(ctx);
  const toolsByName = new Map(tools.map((tool) => [tool.spec.name, tool]));
  const systemPrompt = config.systemPrompt(ctx);
  const toolSpecs = tools.map((tool) => tool.spec);

  let working: AssistantMessage[] = [...history, { role: "user", text: userText }];

  for (let iteration = 0; iteration < MAX_TOOL_ITERATIONS; iteration++) {
    const providerReply = await sendAssistantRequest(systemPrompt, working, toolSpecs);

    if (providerReply.kind === "text") {
      working = [...working, { role: "assistant", text: providerReply.text }];
      return { reply: providerReply.text || "", updatedHistory: working };
    }

    working = [...working, { role: "assistant", toolCalls: providerReply.toolCalls }];

    for (const call of providerReply.toolCalls || []) {
      const tool = toolsByName.get(call.name);
      let result: unknown;
      try {
        result = tool ? await tool.execute(call.arguments || {}) : { error: `Unknown tool "${call.name}"` };
      } catch (err) {
        result = { error: err instanceof Error ? err.message : String(err) };
      }
      working = [...working, { role: "tool", toolCallId: call.id, toolName: call.name, toolResult: result }];
    }
  }

  const fallback = "I tried a few steps but couldn't finish that — could you rephrase, or try a simpler request?";
  working = [...working, { role: "assistant", text: fallback }];
  return { reply: fallback, updatedHistory: working };
}
