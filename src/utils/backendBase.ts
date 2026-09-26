// The one place that knows where the backend proxy lives — every client (assistant chat, voice,
// admin settings) builds its URL from this instead of hardcoding a host. `??` (not `||`) so a
// production build's explicitly-empty VITE_ASSISTANT_API_BASE (same-origin deploy — Express
// serves both the API and this SPA from one host) is honored as "no prefix" rather than falling
// through to the localhost default, which `||` would do since "" is falsy.
export const BACKEND_BASE = import.meta.env?.VITE_ASSISTANT_API_BASE ?? "http://localhost:8787";
