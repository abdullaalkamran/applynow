const { getConfig } = require("../config");

function apiUrl(config) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;
}

// Gemini has no "assistant"/"tool" roles — model turns are role "model", and both user text and
// tool results are sent back as role "user" (a tool result is a `functionResponse` part).
function toGeminiContents(messages) {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "user",
        parts: [{ functionResponse: { name: message.toolName, response: message.toolResult ?? {} } }],
      };
    }

    if (message.role === "assistant") {
      const parts = [];
      if (message.text) parts.push({ text: message.text });
      for (const call of message.toolCalls || []) {
        parts.push({ functionCall: { name: call.name, args: call.arguments || {} } });
      }
      return { role: "model", parts };
    }

    return { role: "user", parts: [{ text: message.text || "" }] };
  });
}

function toGeminiTools(tools) {
  if (!tools?.length) return undefined;
  return [
    {
      function_declarations: tools.map((tool) => ({
        name: tool.name,
        description: tool.description,
        parameters: tool.parameters,
      })),
    },
  ];
}

async function send({ systemPrompt, messages, tools }) {
  const config = getConfig();
  if (!config.gemini.apiKey) {
    throw Object.assign(new Error("GEMINI_API_KEY is not set"), { status: 500 });
  }

  const response = await fetch(apiUrl(config), {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      system_instruction: { parts: [{ text: systemPrompt }] },
      contents: toGeminiContents(messages),
      tools: toGeminiTools(tools),
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw Object.assign(new Error(`Gemini API error: ${response.status} ${detail}`), { status: 502 });
  }

  const data = await response.json();
  const parts = data.candidates?.[0]?.content?.parts || [];
  const functionCallParts = parts.filter((part) => part.functionCall);
  const textParts = parts.filter((part) => part.text);

  if (functionCallParts.length > 0) {
    return {
      kind: "tool_call",
      toolCalls: functionCallParts.map((part, index) => ({
        id: `${part.functionCall.name}_${index}`,
        name: part.functionCall.name,
        arguments: part.functionCall.args || {},
      })),
      raw: data,
    };
  }

  return { kind: "text", text: textParts.map((part) => part.text).join("\n"), raw: data };
}

module.exports = { send, toGeminiTools };
