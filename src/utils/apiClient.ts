// Thin fetch wrapper for the new Postgres-backed domain routes (/api/students, /api/staff,
// /api/applications, /api/tasks, /api/messages) — same BACKEND_BASE every other real client
// (authClient.ts, adminSettingsClient.ts) already builds off. Attaches the JWT the same way
// authClient.ts stores it, so every call is authenticated as whoever is logged in.
import { BACKEND_BASE } from "./backendBase";

const TOKEN_KEY = "sd-auth-token";

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem(TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

async function handle<T>(response: Response): Promise<T> {
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

export function apiGet<T>(path: string): Promise<T> {
  return fetch(`${BACKEND_BASE}${path}`, { headers: { ...authHeader() } }).then((r) => handle<T>(r));
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${BACKEND_BASE}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeader() },
    body: JSON.stringify(body ?? {}),
  }).then((r) => handle<T>(r));
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return fetch(`${BACKEND_BASE}${path}`, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...authHeader() },
    body: JSON.stringify(body ?? {}),
  }).then((r) => handle<T>(r));
}

export function apiDelete<T>(path: string): Promise<T> {
  return fetch(`${BACKEND_BASE}${path}`, { method: "DELETE", headers: { ...authHeader() } }).then((r) => handle<T>(r));
}
