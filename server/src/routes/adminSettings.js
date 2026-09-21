const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const { readSettings, writeSettings } = require("../settingsStore");
const { getConfig } = require("../config");

const router = express.Router();

function mask(key) {
  if (!key) return "";
  return key.length <= 4 ? "••••" : `••••••••${key.slice(-4)}`;
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
    courseImportEnabled: cfg.courseImportEnabled,
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

const CHOICES = {
  provider: ["anthropic", "openai", "gemini", "ollama", "stub"],
  voiceEngine: ["browser", "openai", "gemini-live"],
  whatsappProvider: ["meta", "twilio", "stub"],
  emailProvider: ["sendgrid", "stub"],
};

router.put("/", requireAdmin, (req, res) => {
  const body = req.body || {};
  const current = readSettings();
  const patch = {};

  // Only known choices are persisted — an unknown provider name would make every AI call fail
  // with "Unknown AI_PROVIDER" until someone edited the settings file by hand.
  for (const [key, allowed] of Object.entries(CHOICES)) {
    if (body[key] === undefined) continue;
    if (typeof body[key] !== "string" || !allowed.includes(body[key].toLowerCase())) {
      return res.status(400).json({ error: `${key} must be one of: ${allowed.join(", ")}` });
    }
    patch[key] = body[key].toLowerCase();
  }
  if (typeof body.courseImportEnabled === "boolean") patch.courseImportEnabled = body.courseImportEnabled;

  for (const key of Object.keys(SECRET_FIELD)) {
    if (body[key] && typeof body[key] === "object" && !Array.isArray(body[key])) {
      const incoming = {};
      // Provider blocks hold plain string fields (keys, model names, URLs) — nothing nested.
      for (const [field, value] of Object.entries(body[key])) {
        if (typeof value !== "string" || value.length > 2000) return res.status(400).json({ error: `${key}.${field} must be a string.` });
        incoming[field] = value;
      }
      const secretField = SECRET_FIELD[key];
      if (secretField && secretField in incoming && !incoming[secretField]) delete incoming[secretField];
      patch[key] = { ...(current[key] || {}), ...incoming };
    }
  }

  writeSettings(patch);
  res.json({ ok: true, saved: Object.keys(patch) });
});

module.exports = router;
