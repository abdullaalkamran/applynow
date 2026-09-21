const { getConfig } = require("../config");

const LLM_TIMEOUT_MS = 90_000;

const API_URL = "https://api.openai.com/v1/chat/completions";

function toOpenAiMessages(systemPrompt, messages) {
  const converted = [{ role: "system", content: systemPrompt }];

  for (const message of messages) {
    if (message.role === "tool") {
      converted.push({
        role: "tool",
        tool_call_id: message.toolCallId,
        content: JSON.stringify(message.toolResult ?? null),
      });
      continue;
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      converted.push({
        role: "assistant",
        content: message.text || null,
        tool_calls: message.toolCalls.map((call) => ({
          id: call.id,
          type: "function",
          function: { name: call.name, arguments: JSON.stringify(call.arguments || {}) },
        })),
      });
      continue;
    }

    if (message.image) {
      converted.push({
        role: message.role,
        content: [
          { type: "text", text: message.text || "" },
          { type: "image_url", image_url: { url: `data:${message.image.mimeType};base64,${message.image.base64}` } },
        ],
      });
      continue;
    }

    converted.push({ role: message.role, content: message.text || "" });
  }

  return converted;
}

function toOpenAiTools(tools) {
  return (tools || []).map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

// `maxTokens` / `jsonMode` are optional extras for callers that want a long, strictly-JSON reply
// (courseExtraction.js); the assistant's tool-calling callers pass neither and behave as before.
async function send({ systemPrompt, messages, tools, maxTokens, jsonMode }) {
  const config = getConfig();
  if (!config.openai.apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY is not set"), { status: 500 });
  }

  const hasTools = Array.isArray(tools) && tools.length > 0;
  const response = await fetch(API_URL, {
    method: "POST",
    // Bounded so a hung upstream can never pin a request worker indefinitely.
    signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.openai.model,
      messages: toOpenAiMessages(systemPrompt, messages),
      ...(hasTools ? { tools: toOpenAiTools(tools), tool_choice: "auto" } : {}),
      ...(maxTokens ? { max_completion_tokens: maxTokens } : {}),
      ...(jsonMode ? { response_format: { type: "json_object" } } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw Object.assign(new Error(`OpenAI API error: ${response.status} ${detail}`), { status: 502 });
  }

  const data = await response.json();
  const message = data.choices?.[0]?.message || {};

  if (message.tool_calls?.length) {
    return {
      kind: "tool_call",
      toolCalls: message.tool_calls.map((call) => ({
        id: call.id,
        name: call.function.name,
        arguments: parseToolArguments(call.function.arguments),
      })),
      raw: data,
    };
  }

  return { kind: "text", text: message.content || "", raw: data };
}

/** Model output isn't guaranteed to be valid JSON — a malformed argument string becomes an
 * empty argument set rather than crashing the whole assistant turn. */
function parseToolArguments(raw) {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

module.exports = { send };
