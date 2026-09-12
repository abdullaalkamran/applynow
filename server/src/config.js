// Central place to read config — every other module calls getConfig() rather than touching
// process.env or the settings file directly. Env vars are the deploy-time defaults; anything an
// admin saves through the Admin AI Settings page (settingsStore.js) overrides them, live, without
// a restart. The admin token itself is deliberately env-only — nothing reachable through the
// settings API can change the key that locks the settings API.
const { readSettings } = require("./settingsStore");

function envDefaults() {
  return {
    provider: (process.env.AI_PROVIDER || "stub").toLowerCase(),
    voiceEngine: (process.env.VOICE_ENGINE || "browser").toLowerCase(),
    frontendOrigins: (process.env.FRONTEND_ORIGIN || "http://localhost:5173")
      .split(",")
      .map((origin) => origin.trim())
      .filter(Boolean),
    adminToken: process.env.ADMIN_SETTINGS_TOKEN || "",
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
      model: process.env.GEMINI_MODEL || "gemini-2.0-flash",
      liveModel: process.env.GEMINI_LIVE_MODEL || "gemini-2.0-flash-live-001",
    },
    ollama: {
      baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
      model: process.env.OLLAMA_MODEL || "llama3.1",
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
    anthropic: { ...base.anthropic, ...(saved.anthropic || {}) },
    openai: { ...base.openai, ...(saved.openai || {}) },
    gemini: { ...base.gemini, ...(saved.gemini || {}) },
    ollama: { ...base.ollama, ...(saved.ollama || {}) },
  };
}

module.exports = { getConfig };
