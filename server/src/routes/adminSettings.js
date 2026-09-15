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
    whatsappProvider: cfg.whatsappProvider,
    emailProvider: cfg.emailProvider,
    whatsappMeta: {
      phoneNumberId: cfg.whatsappMeta.phoneNumberId,
      accessTokenSet: !!cfg.whatsappMeta.accessToken,
      accessTokenMasked: mask(cfg.whatsappMeta.accessToken),
    },
    whatsappTwilio: {
      accountSid: cfg.whatsappTwilio.accountSid,
      fromNumber: cfg.whatsappTwilio.fromNumber,
      authTokenSet: !!cfg.whatsappTwilio.authToken,
      authTokenMasked: mask(cfg.whatsappTwilio.authToken),
    },
    email: {
      fromAddress: cfg.email.fromAddress,
      fromName: cfg.email.fromName,
      apiKeySet: !!cfg.email.apiKey,
      apiKeyMasked: mask(cfg.email.apiKey),
    },
  });
});

// Each provider object's own secret field name — stripped from the incoming patch when blank, so
// a form re-submitting its own masked placeholder (or an untouched field) never wipes a saved key.
const SECRET_FIELD = {
  anthropic: "apiKey",
  openai: "apiKey",
  gemini: "apiKey",
  ollama: null,
  whatsappMeta: "accessToken",
  whatsappTwilio: "authToken",
  email: "apiKey",
};

router.put("/", requireAdmin, (req, res) => {
  const body = req.body || {};
  const current = readSettings();
  const patch = {};

  if (typeof body.provider === "string") patch.provider = body.provider;
  if (typeof body.voiceEngine === "string") patch.voiceEngine = body.voiceEngine;
  if (typeof body.whatsappProvider === "string") patch.whatsappProvider = body.whatsappProvider;
  if (typeof body.emailProvider === "string") patch.emailProvider = body.emailProvider;

  for (const key of Object.keys(SECRET_FIELD)) {
    if (body[key] && typeof body[key] === "object") {
      const incoming = { ...body[key] };
      const secretField = SECRET_FIELD[key];
      if (secretField && secretField in incoming && !incoming[secretField]) delete incoming[secretField];
      patch[key] = { ...(current[key] || {}), ...incoming };
    }
  }

  writeSettings(patch);
  res.json({ ok: true, saved: Object.keys(patch) });
});

module.exports = router;
