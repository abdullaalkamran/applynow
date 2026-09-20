import { BACKEND_BASE } from "./backendBase";

const TOKEN_KEY = "sd-admin-settings-token";
const SETTINGS_URL = `${BACKEND_BASE}/api/admin/settings`;

export interface ProviderModelSettings {
  model: string;
  apiKeySet: boolean;
  apiKeyMasked: string;
}

export interface AdminSettings {
  provider: "anthropic" | "openai" | "gemini" | "ollama" | "stub";
  voiceEngine: "browser" | "openai" | "gemini-live";
  anthropic: ProviderModelSettings;
  openai: ProviderModelSettings & { whisperModel: string; ttsModel: string; ttsVoice: string };
  gemini: ProviderModelSettings & { liveModel: string };
  ollama: { baseUrl: string; model: string };
  // Data Management's AI "Import from URLs" (see server/src/routes/courseImports.js) — off by default.
  courseImportEnabled: boolean;
}

export function loadAdminToken(): string {
  if (typeof window === "undefined") return "";
  return window.sessionStorage.getItem(TOKEN_KEY) || "";
}

export function saveAdminToken(token: string) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(TOKEN_KEY, token);
}

export function clearAdminToken() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(TOKEN_KEY);
}

export async function fetchAdminSettings(token: string): Promise<AdminSettings> {
  const response = await fetch(SETTINGS_URL, { headers: { "x-admin-token": token } });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Request failed (${response.status})`);
  }
  return response.json();
}

export async function saveAdminSettings(token: string, patch: Record<string, unknown>): Promise<void> {
  const response = await fetch(SETTINGS_URL, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-admin-token": token },
    body: JSON.stringify(patch),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Request failed (${response.status})`);
  }
}
