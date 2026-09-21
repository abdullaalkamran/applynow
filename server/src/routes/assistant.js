const express = require("express");
const { getConfig } = require("../config");
const { getProvider } = require("../providers");
const requireAuth = require("../middleware/requireAuth");

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

    const provider = getProvider(getConfig().provider);
    const reply = await provider.send({ systemPrompt, messages, tools: tools || [] });
    res.json(reply);
  } catch (err) {
    next(err);
  }
});

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
