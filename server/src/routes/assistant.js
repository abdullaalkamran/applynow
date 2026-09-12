const express = require("express");
const { getConfig } = require("../config");
const { getProvider } = require("../providers");

const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const { systemPrompt, messages, tools } = req.body || {};

    if (typeof systemPrompt !== "string" || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Request must include { systemPrompt: string, messages: array }" });
    }

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
