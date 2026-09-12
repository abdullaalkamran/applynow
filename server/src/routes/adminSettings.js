const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const { readSettings, writeSettings } = require("../settingsStore");
const { getConfig } = require("../config");

const router = express.Router();

function mask(key) {
  if (!key) return "";
  return key.length <= 4 ? "••••" : `${"•".repeat(key.length - 4)}${key.slice(-4)}`;
}

router.get("/", requireAdmin, (_req, res) => {
  const cfg = getConfig();
  res.json({
    provider: cfg.provider,
    voiceEngine: cfg.voiceEngine,
    anthropic: { model: cfg.anthropic.model, apiKeySet: !!cfg.anthropic.apiKey, apiKeyMasked: mask(cfg.anthropic.apiKey) },
    openai: {
      model: cfg.openai.model,
      whisperModel: cfg.openai.whisperModel,
      ttsModel: cfg.openai.ttsModel,
      ttsVoice: cfg.openai.ttsVoice,
      apiKeySet: !!cfg.openai.apiKey,
      apiKeyMasked: mask(cfg.openai.apiKey),
    },
    gemini: {
      model: cfg.gemini.model,
      liveModel: cfg.gemini.liveModel,
      apiKeySet: !!cfg.gemini.apiKey,
      apiKeyMasked: mask(cfg.gemini.apiKey),
    },
    ollama: { baseUrl: cfg.ollama.baseUrl, model: cfg.ollama.model },
  });
});

// Only overwrites an apiKey when a non-empty value is actually sent, so a form re-submitting its
// own masked placeholder (or an untouched field) never wipes out a previously saved key.
router.put("/", requireAdmin, (req, res) => {
  const body = req.body || {};
  const current = readSettings();
  const patch = {};

  if (typeof body.provider === "string") patch.provider = body.provider;
  if (typeof body.voiceEngine === "string") patch.voiceEngine = body.voiceEngine;

  for (const key of ["anthropic", "openai", "gemini", "ollama"]) {
    if (body[key] && typeof body[key] === "object") {
      const incoming = { ...body[key] };
      if ("apiKey" in incoming && !incoming.apiKey) delete incoming.apiKey;
      patch[key] = { ...(current[key] || {}), ...incoming };
    }
  }

  writeSettings(patch);
  res.json({ ok: true, saved: Object.keys(patch) });
});

module.exports = router;
