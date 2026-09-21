const { getConfig } = require("../config");

// Ollama's /api/chat speaks an OpenAI-flavored dialect for tool-capable local models
// (e.g. llama3.1). Intended for local dev/testing, not production — no API key involved.
function toOllamaMessages(systemPrompt, messages) {
  const converted = [{ role: "system", content: systemPrompt }];

  for (const message of messages) {
    if (message.role === "tool") {
      converted.push({ role: "tool", content: JSON.stringify(message.toolResult ?? null) });
      continue;
    }

    if (message.role === "assistant" && message.toolCalls?.length) {
      converted.push({
        role: "assistant",
        content: message.text || "",
        tool_calls: message.toolCalls.map((call) => ({
          function: { name: call.name, arguments: call.arguments || {} },
        })),
      });
      continue;
    }

    if (message.image) {
      // Ollama's vision-capable local models (e.g. llava) take raw base64 strings in an `images`
      // array alongside the plain text content — no separate content-block shape like the hosted
      // providers.
      converted.push({ role: message.role, content: message.text || "", images: [message.image.base64] });
      continue;
    }

    converted.push({ role: message.role, content: message.text || "" });
  }

  return converted;
}

function toOllamaTools(tools) {
  return (tools || []).map((tool) => ({
    type: "function",
    function: { name: tool.name, description: tool.description, parameters: tool.parameters },
  }));
}

// `maxTokens` / `jsonMode` are optional extras for callers that want a long, strictly-JSON reply
// (courseExtraction.js); the assistant's tool-calling callers pass neither and behave as before.
async function send({ systemPrompt, messages, tools, maxTokens, jsonMode }) {
  const config = getConfig();
  const response = await fetch(`${config.ollama.baseUrl}/api/chat`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      model: config.ollama.model,
      messages: toOllamaMessages(systemPrompt, messages),
      tools: toOllamaTools(tools),
      stream: false,
      ...(jsonMode ? { format: "json" } : {}),
      ...(maxTokens ? { options: { num_predict: maxTokens } } : {}),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw Object.assign(new Error(`Ollama API error: ${response.status} ${detail}`), { status: 502 });
  }

  const data = await response.json();
  const message = data.message || {};

  if (message.tool_calls?.length) {
    return {
      kind: "tool_call",
      toolCalls: message.tool_calls.map((call, index) => ({
        id: `${call.function.name}_${index}`,
        name: call.function.name,
        arguments:
          typeof call.function.arguments === "string"
            ? JSON.parse(call.function.arguments || "{}")
            : call.function.arguments || {},
      })),
      raw: data,
    };
  }

  return { kind: "text", text: message.content || "", raw: data };
}

module.exports = { send };
