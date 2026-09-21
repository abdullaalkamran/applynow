// "Ask the active LLM provider for one strictly-JSON reply" — shared by interviewScoring.js and
// courseExtraction.js. No provider here supports a forced tool call, so the portable way to get
// structured output is: prompt for JSON, pull the first {...} out of the reply, parse, validate.
const { getConfig } = require("./config");
const { getProvider } = require("./providers");

/** Pulls the JSON object out of a model reply that may wrap it in ```json fences or prose. */
function extractJson(text) {
  const fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced ? fenced[1] : text;
  const match = candidate.match(/\{[\s\S]*\}/);
  return match ? match[0] : candidate;
}

function withTimeout(promise, ms, label) {
  let timer;
  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => reject(Object.assign(new Error(`${label} timed out after ${Math.round(ms / 1000)}s.`), { status: 504 })), ms);
  });
  return Promise.race([promise, timeout]).finally(() => clearTimeout(timer));
}

/** One JSON-reply round trip with the configured provider: `validate(parsed)` must return the
 * cleaned value or throw. A parse/validation failure (or a provider hiccup) is retried once with
 * the same prompt; a second failure surfaces as a 502 the route can pass straight to the client.
 * `timeoutMs` bounds each attempt so a hung upstream call can't pin a request worker. `image`
 * (optional `{ mimeType, base64 }`) attaches a photo to the user turn for vision-capable extraction
 * (see passportExtraction.js) — every provider's message mapper knows how to fold it into that
 * provider's own multipart content shape. */
async function callForJson({ systemPrompt, userPrompt, image, validate, maxTokens = 4096, timeoutMs = 60_000, label = "AI request" }) {
  const provider = getProvider(getConfig().provider);
  let lastError;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const reply = await withTimeout(
        provider.send({ systemPrompt, messages: [{ role: "user", text: userPrompt, ...(image ? { image } : {}) }], tools: [], maxTokens, jsonMode: true }),
        timeoutMs,
        label
      );
      if (reply.kind !== "text" || !reply.text) throw new Error("The AI provider returned no text.");
      return validate(JSON.parse(extractJson(reply.text)));
    } catch (err) {
      lastError = err;
      // A missing key is a configuration problem, not a flaky reply — don't retry it.
      if (err && err.status === 500) throw err;
    }
  }
  throw Object.assign(new Error(`${label} failed: ${lastError?.message || "unknown error"}`), { status: lastError?.status === 504 ? 504 : 502 });
}

module.exports = { extractJson, callForJson };
