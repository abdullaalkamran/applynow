const { getConfig } = require("../config");

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

async function send({ systemPrompt, messages, tools }) {
  const config = getConfig();
  if (!config.openai.apiKey) {
    throw Object.assign(new Error("OPENAI_API_KEY is not set"), { status: 500 });
  }

  const response = await fetch(API_URL, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${config.openai.apiKey}`,
    },
    body: JSON.stringify({
      model: config.openai.model,
      messages: toOpenAiMessages(systemPrompt, messages),
      tools: toOpenAiTools(tools),
      tool_choice: "auto",
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
        arguments: JSON.parse(call.function.arguments || "{}"),
      })),
      raw: data,
    };
  }

  return { kind: "text", text: message.content || "", raw: data };
}

module.exports = { send };
