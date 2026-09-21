const { getConfig } = require("../config");

const LLM_TIMEOUT_MS = 90_000;

const API_URL = "https://api.anthropic.com/v1/messages";
const API_VERSION = "2023-06-01";

// Normalized AssistantMessage[] -> Anthropic's messages array. Anthropic has no separate "tool"
// role — a tool result is sent back as a user message containing a tool_result content block.
function toAnthropicMessages(messages) {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "user",
        content: [
          {
            type: "tool_result",
            tool_use_id: message.toolCallId,
            content: JSON.stringify(message.toolResult ?? null),
          },
        ],
      };
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      const content = [];
      if (message.text) content.push({ type: "text", text: message.text });
      for (const call of message.toolCalls) {
        content.push({ type: "tool_use", id: call.id, name: call.name, input: call.arguments || {} });
      }
      return { role: "assistant", content };
    }

    if (message.image) {
      return {
        role: message.role,
        content: [
          { type: "image", source: { type: "base64", media_type: message.image.mimeType, data: message.image.base64 } },
          { type: "text", text: message.text || "" },
        ],
      };
    }

    return { role: message.role, content: message.text || "" };
  });
}

function toAnthropicTools(tools) {
  return (tools || []).map((tool) => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.parameters,
  }));
}

// `maxTokens` lets a caller that expects a long structured reply (courseExtraction.js) raise the
// default; `jsonMode` is accepted for parity with the other providers but Anthropic has no native
// JSON mode — the caller's prompt has to ask for JSON.
async function send({ systemPrompt, messages, tools, maxTokens }) {
  const config = getConfig();
  if (!config.anthropic.apiKey) {
    throw Object.assign(new Error("ANTHROPIC_API_KEY is not set"), { status: 500 });
  }

  const response = await fetch(API_URL, {
    method: "POST",
    // Bounded so a hung upstream can never pin a request worker indefinitely.
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      "x-api-key": config.anthropic.apiKey,
      "anthropic-version": API_VERSION,
    },
    body: JSON.stringify({
      model: config.anthropic.model,
      max_tokens: maxTokens ?? 1024,
      system: systemPrompt,
      messages: toAnthropicMessages(messages),
      tools: toAnthropicTools(tools),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw Object.assign(new Error(`Anthropic API error: ${response.status} ${detail}`), { status: 502 });
  }

  const data = await response.json();
  const blocks = data.content || [];
  const toolUseBlocks = blocks.filter((block) => block.type === "tool_use");
  const textBlocks = blocks.filter((block) => block.type === "text");

  if (toolUseBlocks.length > 0) {
    return {
      kind: "tool_call",
      toolCalls: toolUseBlocks.map((block) => ({ id: block.id, name: block.name, arguments: block.input })),
      raw: data,
    };
  }

  return { kind: "text", text: textBlocks.map((block) => block.text).join("\n"), raw: data };
}

module.exports = { send };
