const { getConfig } = require("../config");

const LLM_TIMEOUT_MS = 90_000;

function apiUrl(config, model = config.gemini.model) {
  return `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${config.gemini.apiKey}`;
}

// Google answers 503 "high demand" / 429 / 500 in short, temporary spikes — one such blip used to surface as a
// failed reply. Retry a couple of times with a short back-off, then try a second model before giving up.
const RETRYABLE = new Set([429, 500, 503]);
const FALLBACK_MODEL = "gemini-2.5-flash";
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

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

    if (message.image) {
      return {
        role: "user",
        parts: [
          { inlineData: { mimeType: message.image.mimeType, data: message.image.base64 } },
          { text: message.text || "" },
        ],
      };
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

// `maxTokens` / `jsonMode` are optional extras for callers that want a long, strictly-JSON reply
// (courseExtraction.js); the assistant's tool-calling callers pass neither and behave as before.
// Tools are only sent when there are some — Gemini rejects responseMimeType combined with
// function declarations.
async function send({ systemPrompt, messages, tools, maxTokens, jsonMode }) {
  const config = getConfig();
  if (!config.gemini.apiKey) {
    throw Object.assign(new Error("GEMINI_API_KEY is not set"), { status: 500 });
  }

  const hasTools = Array.isArray(tools) && tools.length > 0;
  const body = JSON.stringify({
    system_instruction: { parts: [{ text: systemPrompt }] },
    contents: toGeminiContents(messages),
    ...(hasTools ? { tools: toGeminiTools(tools) } : {}),
    // gemini-3.6-flash is a thinking model — without this it reasons internally before every
    // single reply *and* every intermediate tool-call step, and a multi-tool turn (e.g. check
    // profile, then search universities) pays that cost multiple times in one request.
    // Gemini 3.x models use thinkingLevel (2.5-generation models used thinkingBudget instead,
    // e.g. the Live relay's native-audio model) — thinkingBudget is rejected outright here.
    generationConfig: {
      thinkingConfig: { thinkingLevel: "minimal" },
      ...(maxTokens ? { maxOutputTokens: maxTokens } : {}),
      ...(jsonMode ? { responseMimeType: "application/json" } : {}),
    },
  });
  // The fallback is a 2.5-generation model, which takes thinkingBudget instead of thinkingLevel.
  const fallbackBody = JSON.parse(body);
  fallbackBody.generationConfig.thinkingConfig = { thinkingBudget: 0 };

  const post = (model, payload) =>
    fetch(apiUrl(config, model), {
      method: "POST",
      // Bounded so a hung upstream can never pin a request worker indefinitely.
      signal: AbortSignal.timeout(LLM_TIMEOUT_MS),
      headers: { "content-type": "application/json" },
      body: payload,
    });

  let response;
  for (let attempt = 0; attempt < 3; attempt++) {
    response = await post(config.gemini.model, body);
    if (response.ok || !RETRYABLE.has(response.status)) break;
    if (attempt < 2) await sleep(1000 * (attempt + 1));
  }
  if (!response.ok && RETRYABLE.has(response.status) && config.gemini.model !== FALLBACK_MODEL) {
    console.warn(`Gemini ${config.gemini.model} unavailable (${response.status}) — falling back to ${FALLBACK_MODEL}.`);
    const fallback = await post(FALLBACK_MODEL, JSON.stringify(fallbackBody));
    if (fallback.ok) response = fallback;
  }

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
