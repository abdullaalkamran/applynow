// The one place that knows where the backend proxy lives — every client (assistant chat, voice,
// admin settings) builds its URL from this instead of hardcoding a host.
export const BACKEND_BASE = import.meta.env?.VITE_ASSISTANT_API_BASE || "http://localhost:8787";
