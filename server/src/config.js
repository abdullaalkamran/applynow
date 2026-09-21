// Central place to read config — every other module calls getConfig() rather than touching
// process.env or the settings file directly. Env vars are the deploy-time defaults; anything an
// admin saves through the Admin AI Settings page (settingsStore.js) overrides them, live, without
// a restart. The admin token itself is deliberately env-only — nothing reachable through the
// settings API can change the key that locks the settings API.
const crypto = require("crypto");
const { readSettings } = require("./settingsStore");

// Generated once per process (not per getConfig() call, which would invalidate every token on the
// very next request) if JWT_SECRET isn't set — fine for local dev, but every restart invalidates
// existing sessions, so production should always set a real JWT_SECRET explicitly.
let generatedJwtSecret = null;
function jwtSecret() {
  if (process.env.JWT_SECRET) return process.env.JWT_SECRET;
  if (!generatedJwtSecret) {
    generatedJwtSecret = crypto.randomBytes(32).toString("hex");
    console.warn("JWT_SECRET is not set — using a random secret for this process only. Logins will be invalidated on every restart. Set JWT_SECRET before deploying.");
  }
  return generatedJwtSecret;
}

function envDefaults() {
  return {
    provider: (process.env.AI_PROVIDER || "stub").toLowerCase(),
    voiceEngine: (process.env.VOICE_ENGINE || "browser").toLowerCase(),
    // Data Management's AI course import (routes/courseImports.js) — off until an admin turns it
    // on in Admin → AI Settings (or COURSE_IMPORT_ENABLED=true at deploy time).
    courseImportEnabled: process.env.COURSE_IMPORT_ENABLED === "true",
    frontendOrigins: (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    adminToken: process.env.ADMIN_SETTINGS_TOKEN || "",
    jwtSecret: jwtSecret(),
    // "Sign in / up with Google" (see routes/auth.js's POST /google) — the same Client ID must also
    // be set as VITE_GOOGLE_CLIENT_ID on the frontend so its button is issued for the same OAuth
    // client the server verifies tokens against. Empty until a real Google Cloud OAuth client
    // exists — the route fails closed (503) rather than silently accepting unverifiable tokens.
    googleClientId: process.env.GOOGLE_CLIENT_ID || "",
    anthropic: {
      apiKey: process.env.ANTHROPIC_API_KEY || "",
      model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-5",
    },
    openai: {
      apiKey: process.env.OPENAI_API_KEY || "",
      model: process.env.OPENAI_MODEL || "gpt-4o",
      whisperModel: process.env.OPENAI_WHISPER_MODEL || "whisper-1",
      ttsModel: process.env.OPENAI_TTS_MODEL || "tts-1",
      ttsVoice: process.env.OPENAI_TTS_VOICE || "alloy",
    },
    gemini: {
      apiKey: process.env.GEMINI_API_KEY || "",
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      liveModel: process.env.GEMINI_LIVE_MODEL || "gemini-2.5-flash-native-audio-latest",
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "llama3.1",
    },
    whatsappProvider: (process.env.WHATSAPP_PROVIDER || "stub").toLowerCase(),
    emailProvider: (process.env.EMAIL_PROVIDER || "stub").toLowerCase(),
    whatsappMeta: {
      accessToken: process.env.WHATSAPP_META_TOKEN || "",
      phoneNumberId: process.env.WHATSAPP_META_PHONE_ID || "",
    },
    whatsappTwilio: {
      accountSid: process.env.TWILIO_ACCOUNT_SID || "",
      authToken: process.env.TWILIO_AUTH_TOKEN || "",
      fromNumber: process.env.TWILIO_WHATSAPP_NUMBER || "",
    },
    email: {
      apiKey: process.env.SENDGRID_API_KEY || "",
      fromAddress: process.env.EMAIL_FROM_ADDRESS || "",
      fromName: process.env.EMAIL_FROM_NAME || "StudyOne",
    },
  };
}

function getConfig() {
  const base = envDefaults();
  const saved = readSettings();
  return {
    ...base,
    provider: saved.provider || base.provider,
    voiceEngine: saved.voiceEngine || base.voiceEngine,
    courseImportEnabled: typeof saved.courseImportEnabled === "boolean" ? saved.courseImportEnabled : base.courseImportEnabled,
    anthropic: { ...base.anthropic, ...(saved.anthropic || {}) },
    openai: { ...base.openai, ...(saved.openai || {}) },
    gemini: { ...base.gemini, ...(saved.gemini || {}) },
    ollama: { ...base.ollama, ...(saved.ollama || {}) },
    whatsappProvider: saved.whatsappProvider || base.whatsappProvider,
    emailProvider: saved.emailProvider || base.emailProvider,
    whatsappMeta: { ...base.whatsappMeta, ...(saved.whatsappMeta || {}) },
    whatsappTwilio: { ...base.whatsappTwilio, ...(saved.whatsappTwilio || {}) },
    email: { ...base.email, ...(saved.email || {}) },
  };
}

module.exports = { getConfig };
