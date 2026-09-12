import { BACKEND_BASE } from "./backendBase";

export interface VoiceConfig {
  voiceEngine: "browser" | "openai" | "gemini-live";
  openaiVoiceAvailable: boolean;
  geminiLiveAvailable: boolean;
}

export async function fetchVoiceConfig(): Promise<VoiceConfig> {
  const response = await fetch(`${BACKEND_BASE}/api/assistant/voice-config`);
  if (!response.ok) throw new Error(`Failed to load voice config (${response.status})`);
  return response.json();
}

/** Sends a recorded audio clip to the backend's Whisper-backed transcription endpoint. */
export async function transcribeAudio(blob: Blob): Promise<string> {
  const form = new FormData();
  form.append("audio", blob, "audio.webm");
  const response = await fetch(`${BACKEND_BASE}/api/assistant/transcribe`, { method: "POST", body: form });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Transcription failed (${response.status})`);
  }
  const data = await response.json();
  return data.text || "";
}

/** Turns text into spoken audio via the backend's OpenAI-TTS-backed endpoint. */
export async function synthesizeSpeech(text: string): Promise<Blob> {
  const response = await fetch(`${BACKEND_BASE}/api/assistant/speak`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ text }),
  });
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Speech synthesis failed (${response.status})`);
  }
  return response.blob();
}
