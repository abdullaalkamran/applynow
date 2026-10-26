const express = require("express");
const { getConfig } = require("../config");
const { getProvider } = require("../providers");
const requireAuth = require("../middleware/requireAuth");
const { withIdentity } = require("../assistantIdentity");

const router = express.Router();

const MAX_PROMPT_CHARS = 60_000;
const MAX_MESSAGES = 200;
const MAX_TOTAL_CHARS = 200_000;
const MAX_IMAGE_BASE64 = 8_000_000; // ~6 MB decoded

// Every call here spends real money against a real provider API key — must be behind a real
// logged-in session, not reachable by anyone who finds the backend URL.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { systemPrompt, messages, tools } = req.body || {};

    if (typeof systemPrompt !== "string" || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Request must include { systemPrompt: string, messages: array }" });
    }
    // Hard ceilings well above anything the in-app assistant sends — a single request can't be
    // used to push an arbitrarily large (and arbitrarily expensive) prompt through the org's key.
    if (systemPrompt.length > MAX_PROMPT_CHARS || messages.length > MAX_MESSAGES || (tools !== undefined && !Array.isArray(tools))) {
      return res.status(400).json({ error: "Request is too large." });
    }
    let totalChars = systemPrompt.length;
    for (const m of messages) {
      if (!m || typeof m !== "object") return res.status(400).json({ error: "Malformed message." });
      totalChars += typeof m.text === "string" ? m.text.length : 0;
      if (m.image && (typeof m.image.base64 !== "string" || m.image.base64.length > MAX_IMAGE_BASE64)) {
        return res.status(400).json({ error: "Attached image is too large." });
      }
    }
    if (totalChars > MAX_TOTAL_CHARS) return res.status(400).json({ error: "Conversation is too long — start a new chat." });

    const config = getConfig();
    const provider = getProvider(config.provider);
    const reply = await provider.send({ systemPrompt: withIdentity(systemPrompt), messages, tools: tools || [] });
    res.json(reply);
  } catch (err) {
    // The global error handler hides every 5xx behind "Internal server error" — fine for most routes, but it turned
    // "no API key configured" or "the provider is down" into an opaque failure that nobody could diagnose from the app.
    // These messages are safe to show (no keys, no provider response bodies); the full error stays in the server log.
    const friendly = describeProviderFailure(err);
    if (!friendly) return next(err);
    console.error("Assistant provider failure:", err);
    res.status(friendly.status).json({ error: friendly.message });
  }
});

/** A safe, human-readable explanation for the provider failures an admin can actually fix, or null for anything else. */
function describeProviderFailure(err) {
  const message = String(err?.message || "");
  if (/API_KEY is not set|api key.*not set|not configured/i.test(message)) {
    return { status: 503, message: "The AI assistant isn't set up on the server yet — an admin needs to add the provider's API key under Admin → AI Settings." };
  }
  if (/Unknown AI_PROVIDER/i.test(message)) {
    return { status: 503, message: "The AI provider on the server is set to an unknown value — an admin needs to pick one under Admin → AI Settings." };
  }
  const upstream = /API error: (\d{3})/.exec(message);
  if (upstream) {
    const code = Number(upstream[1]);
    if (code === 401 || code === 403) return { status: 502, message: "The AI provider rejected the server's API key — an admin needs to check it under Admin → AI Settings." };
    if (code === 404) return { status: 502, message: "The AI provider doesn't recognise the configured model — an admin needs to check the model name under Admin → AI Settings." };
    if (code === 429) return { status: 429, message: "The AI provider is rate-limiting requests right now — please wait a moment and try again." };
    return { status: 502, message: `The AI provider returned an error (${code}) — please try again in a moment.` };
  }
  if (err?.name === "TimeoutError" || err?.name === "AbortError" || /fetch failed|ECONNREFUSED|ENOTFOUND|ETIMEDOUT|EAI_AGAIN/i.test(message)) {
    return { status: 504, message: "The server couldn't reach the AI provider in time — please try again in a moment." };
  }
  return null;
}

// Public (no admin token) — any signed-in role needs to know which voice engine is active and
// whether it's actually usable (has a key), without ever seeing the keys themselves.
router.get("/voice-config", (_req, res) => {
  const config = getConfig();
  res.json({
    voiceEngine: config.voiceEngine,
    openaiVoiceAvailable: !!config.openai.apiKey,
    geminiLiveAvailable: !!config.gemini.apiKey,
  });
});

module.exports = router;
