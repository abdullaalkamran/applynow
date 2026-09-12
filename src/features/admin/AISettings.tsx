import { useEffect, useState } from "react";
import { Button } from "../../components/ui";
import {
  loadAdminToken, saveAdminToken, clearAdminToken,
  fetchAdminSettings, saveAdminSettings, type AdminSettings,
} from "../../utils/adminSettingsClient";

const inputClass = "w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-600)]";
const labelClass = "mb-1 block text-[11.5px] font-medium text-slate-500";

const PROVIDERS: AdminSettings["provider"][] = ["stub", "anthropic", "openai", "gemini", "ollama"];
const VOICE_ENGINES: { value: AdminSettings["voiceEngine"]; label: string; note: string }[] = [
  { value: "browser", label: "Browser (free)", note: "Built-in speech recognition + speech synthesis. Works everywhere, no key needed." },
  { value: "openai", label: "OpenAI voice", note: "Whisper for transcription, OpenAI TTS for speech — needs an OpenAI API key below." },
  { value: "gemini-live", label: "Gemini Live", note: "Realtime voice-to-voice — needs a Gemini API key below." },
];

export default function AISettings() {
  const [token, setToken] = useState(() => loadAdminToken());
  const [tokenInput, setTokenInput] = useState("");
  const [settings, setSettings] = useState<AdminSettings | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);

  // Draft key inputs — kept separate from `settings` so an untouched (masked) field never
  // overwrites a previously saved key on save.
  const [anthropicKey, setAnthropicKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [geminiKey, setGeminiKey] = useState("");

  async function load(withToken: string) {
    setError("");
    setLoading(true);
    try {
      const data = await fetchAdminSettings(withToken);
      setSettings(data);
    } catch (err) {
      clearAdminToken();
      setToken("");
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function unlock() {
    if (!tokenInput.trim()) return;
    saveAdminToken(tokenInput.trim());
    setToken(tokenInput.trim());
    load(tokenInput.trim());
  }

  async function save() {
    if (!settings) return;
    setStatus("");
    setError("");
    try {
      await saveAdminSettings(token, {
        provider: settings.provider,
        voiceEngine: settings.voiceEngine,
        anthropic: { model: settings.anthropic.model, ...(anthropicKey ? { apiKey: anthropicKey } : {}) },
        openai: {
          model: settings.openai.model,
          whisperModel: settings.openai.whisperModel,
          ttsModel: settings.openai.ttsModel,
          ttsVoice: settings.openai.ttsVoice,
          ...(openaiKey ? { apiKey: openaiKey } : {}),
        },
        gemini: { model: settings.gemini.model, liveModel: settings.gemini.liveModel, ...(geminiKey ? { apiKey: geminiKey } : {}) },
        ollama: { baseUrl: settings.ollama.baseUrl, model: settings.ollama.model },
      });
      setAnthropicKey("");
      setOpenaiKey("");
      setGeminiKey("");
      setStatus("Saved — changes are live immediately, no restart needed.");
      load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    }
  }

  if (!token || !settings) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-xl font-semibold text-slate-900">AI Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Enter the admin passcode to manage AI provider keys and the voice engine.</p>
        <div className="mt-5 space-y-3 rounded-2xl border border-slate-100 bg-white p-5">
          <div>
            <label className={labelClass}>Admin passcode</label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              className={inputClass}
              placeholder="ADMIN_SETTINGS_TOKEN"
            />
          </div>
          {error && <p className="text-[12px] text-rose-600">{error}</p>}
          <Button onClick={unlock} className="w-full justify-center">{loading ? "Checking…" : "Unlock"}</Button>
          <p className="text-[11px] text-slate-400">Set on the server via the ADMIN_SETTINGS_TOKEN environment variable. If it's blank on the server, this page stays disabled.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">AI Settings</h1>
          <p className="mt-1 text-sm text-slate-500">Choose the AI provider, voice engine, and API keys used across every role's assistant.</p>
        </div>
        <button
          onClick={() => { clearAdminToken(); setToken(""); setSettings(null); }}
          className="text-[12px] text-slate-400 hover:text-slate-600"
        >
          Lock
        </button>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      {status && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">{status}</p>}

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-[13px] font-semibold text-slate-800">Reasoning provider</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">Which model actually thinks and calls tools, for every role's assistant.</p>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-5">
          {PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => setSettings({ ...settings, provider: p })}
              className={`rounded-lg border px-2.5 py-2 text-[12.5px] capitalize ${settings.provider === p ? "border-[var(--brand-600)] bg-[var(--brand-50,#eef2ff)] text-[var(--brand-700,#4338ca)]" : "border-slate-200 text-slate-600"}`}
            >
              {p}
            </button>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-[13px] font-semibold text-slate-800">Voice engine</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">What the mic button and voice pages use for speech in/out.</p>
        <div className="mt-3 space-y-2">
          {VOICE_ENGINES.map((v) => (
            <label key={v.value} className={`flex cursor-pointer items-start gap-2.5 rounded-lg border px-3 py-2.5 ${settings.voiceEngine === v.value ? "border-[var(--brand-600)] bg-[var(--brand-50,#eef2ff)]" : "border-slate-200"}`}>
              <input
                type="radio"
                className="mt-0.5"
                checked={settings.voiceEngine === v.value}
                onChange={() => setSettings({ ...settings, voiceEngine: v.value })}
              />
              <span>
                <span className="block text-[12.5px] font-medium text-slate-800">{v.label}</span>
                <span className="block text-[11.5px] text-slate-500">{v.note}</span>
              </span>
            </label>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-[13px] font-semibold text-slate-800">Anthropic (Claude)</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Model</label>
            <input className={inputClass} value={settings.anthropic.model} onChange={(e) => setSettings({ ...settings, anthropic: { ...settings.anthropic, model: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass}>API key {settings.anthropic.apiKeySet && <span className="text-slate-400">(saved: {settings.anthropic.apiKeyMasked})</span>}</label>
            <input type="password" className={inputClass} value={anthropicKey} onChange={(e) => setAnthropicKey(e.target.value)} placeholder={settings.anthropic.apiKeySet ? "Leave blank to keep current key" : "sk-ant-…"} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-[13px] font-semibold text-slate-800">OpenAI</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">Also powers real voice (Whisper + TTS) regardless of the reasoning provider chosen above.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Chat model</label>
            <input className={inputClass} value={settings.openai.model} onChange={(e) => setSettings({ ...settings, openai: { ...settings.openai, model: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass}>API key {settings.openai.apiKeySet && <span className="text-slate-400">(saved: {settings.openai.apiKeyMasked})</span>}</label>
            <input type="password" className={inputClass} value={openaiKey} onChange={(e) => setOpenaiKey(e.target.value)} placeholder={settings.openai.apiKeySet ? "Leave blank to keep current key" : "sk-…"} />
          </div>
          <div>
            <label className={labelClass}>Whisper model</label>
            <input className={inputClass} value={settings.openai.whisperModel} onChange={(e) => setSettings({ ...settings, openai: { ...settings.openai, whisperModel: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass}>TTS model</label>
            <input className={inputClass} value={settings.openai.ttsModel} onChange={(e) => setSettings({ ...settings, openai: { ...settings.openai, ttsModel: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass}>TTS voice</label>
            <input className={inputClass} value={settings.openai.ttsVoice} onChange={(e) => setSettings({ ...settings, openai: { ...settings.openai, ttsVoice: e.target.value } })} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-[13px] font-semibold text-slate-800">Gemini</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">The "live model" powers realtime Gemini Live voice.</p>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Chat model</label>
            <input className={inputClass} value={settings.gemini.model} onChange={(e) => setSettings({ ...settings, gemini: { ...settings.gemini, model: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass}>API key {settings.gemini.apiKeySet && <span className="text-slate-400">(saved: {settings.gemini.apiKeyMasked})</span>}</label>
            <input type="password" className={inputClass} value={geminiKey} onChange={(e) => setGeminiKey(e.target.value)} placeholder={settings.gemini.apiKeySet ? "Leave blank to keep current key" : "AIza…"} />
          </div>
          <div>
            <label className={labelClass}>Live model</label>
            <input className={inputClass} value={settings.gemini.liveModel} onChange={(e) => setSettings({ ...settings, gemini: { ...settings.gemini, liveModel: e.target.value } })} />
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-[13px] font-semibold text-slate-800">Ollama (local)</h2>
        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className={labelClass}>Base URL</label>
            <input className={inputClass} value={settings.ollama.baseUrl} onChange={(e) => setSettings({ ...settings, ollama: { ...settings.ollama, baseUrl: e.target.value } })} />
          </div>
          <div>
            <label className={labelClass}>Model</label>
            <input className={inputClass} value={settings.ollama.model} onChange={(e) => setSettings({ ...settings, ollama: { ...settings.ollama, model: e.target.value } })} />
          </div>
        </div>
      </section>

      <Button onClick={save} className="w-full justify-center sm:w-auto">Save changes</Button>
    </div>
  );
}
