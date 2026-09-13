const { getConfig } = require("../config");

function apiUrl(config) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${config.gemini.model}:generateContent?key=${config.gemini.apiKey}`;
}

// Gemini requires functionResponse.response to be a JSON object (protobuf Struct) — a tool that
// returns a plain string, number, boolean, or array (several of ours do, e.g.
// explain_application_process returns a string) has to be wrapped, or Gemini rejects the whole
// turn with "Invalid value ... type.googleapis.com/google.protobuf.Struct".
function toGeminiFunctionResponse(value) {
  if (value !== null && typeof value === "object" && !Array.isArray(value)) return value;
  return { result: value ?? null };
}

// Gemini has no "assistant"/"tool" roles — model turns are role "model", and both user text and
// tool results are sent back as role "user" (a tool result is a `functionResponse` part).
function toGeminiContents(messages) {
  return messages.map((message) => {
    if (message.role === "tool") {
      return {
        role: "user",
        parts: [{ functionResponse: { name: message.toolName, response: toGeminiFunctionResponse(message.toolResult) } }],
      };
    }

    if (message.role === "assistant") {
      const parts = [];
      if (message.text) parts.push({ text: message.text });
      for (const call of message.toolCalls || []) {
        const part = { functionCall: { name: call.name, args: call.arguments || {} } };
        // Thinking models (e.g. gemini-3.6-flash) require the exact thoughtSignature they issued
        // with a function call to be echoed back on the next turn, or the whole request is
        // rejected with "Function call is missing a thought_signature" — carried through our
        // otherwise-generic ToolCall shape via providerMeta, untouched by other providers.
        if (call.providerMeta?.thoughtSignature) part.thoughtSignature = call.providerMeta.thoughtSignature;
        parts.push(part);
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
      // gemini-3.6-flash is a thinking model — without this it reasons internally before every
      // single reply *and* every intermediate tool-call step, and a multi-tool turn (e.g. check
      // profile, then search universities) pays that cost multiple times in one request.
      // Gemini 3.x models use thinkingLevel (2.5-generation models used thinkingBudget instead,
      // e.g. the Live relay's native-audio model) — thinkingBudget is rejected outright here.
      generationConfig: { thinkingConfig: { thinkingLevel: "minimal" } },
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
        ...(part.thoughtSignature ? { providerMeta: { thoughtSignature: part.thoughtSignature } } : {}),
      })),
      raw: data,
    };
  }

  return { kind: "text", text: textParts.map((part) => part.text).join("\n"), raw: data };
}

module.exports = { send, toGeminiTools, toGeminiFunctionResponse };
