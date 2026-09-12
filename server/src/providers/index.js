const anthropicProvider = require("./anthropicProvider");
const openaiProvider = require("./openaiProvider");
const geminiProvider = require("./geminiProvider");
const ollamaProvider = require("./ollamaProvider");
const stubProvider = require("./stubProvider");

const PROVIDERS = {
  anthropic: anthropicProvider,
  openai: openaiProvider,
  gemini: geminiProvider,
  ollama: ollamaProvider,
  stub: stubProvider,
};

function getProvider(name) {
  const provider = PROVIDERS[name];
  if (!provider) {
    throw Object.assign(
      new Error(`Unknown AI_PROVIDER "${name}" — expected one of: ${Object.keys(PROVIDERS).join(", ")}`),
      { status: 500 }
    );
  }
  return provider;
}

module.exports = { getProvider };
