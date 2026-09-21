// Thin fetch wrapper for the new Postgres-backed domain routes (/api/students, /api/staff,
// /api/applications, /api/tasks, /api/messages) — same BACKEND_BASE every other real client
// (authClient.ts, adminSettingsClient.ts) already builds off. Attaches the JWT the same way
// authClient.ts stores it, so every call is authenticated as whoever is logged in.
import { BACKEND_BASE } from "./backendBase";

const TOKEN_KEY = "sd-auth-token";
const USER_KEY = "sd-auth-user";

/** Fired on `window` when the server rejects the stored session (401) — AuthContext listens and
 * logs the user out, so an expired token lands them on the login page instead of leaving every
 * poll and save silently failing behind a page that still looks signed in. */
export const AUTH_EXPIRED_EVENT = "sd-auth-expired";

// Bumped on every login/logout (see AuthContext.tsx). A response that started under a previous
// session is dropped when it lands, so a poll fired as user A can never overwrite the caches
// user B has just loaded on the same tab.
let sessionGeneration = 0;

export function bumpSessionGeneration(): number {
  sessionGeneration++;
  return sessionGeneration;
}

export class StaleSessionError extends Error {
  constructor() {
    super("Discarded: response belongs to a previous session.");
    this.name = "StaleSessionError";
  }
}

function authHeader(): Record<string, string> {
  if (typeof window === "undefined") return {};
  const token = window.localStorage.getItem(TOKEN_KEY);
  return token ? { authorization: `Bearer ${token}` } : {};
}

function expireSession() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.dispatchEvent(new Event(AUTH_EXPIRED_EVENT));
}

async function handle<T>(response: Response, generation: number): Promise<T> {
  if (generation !== sessionGeneration) throw new StaleSessionError();
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => ({}));
  // Only the auth middleware sets this header; a route's own 401 (wrong current password, bad
  // admin token) must not end the session.
  if ((response.status === 401 || response.status === 403) && response.headers.get("x-session-invalid") === "1") {
    expireSession();
    throw new Error(data.error || "Your session has expired — please log in again.");
  }
  if (!response.ok) throw new Error(data.error || `Request failed (${response.status})`);
  return data as T;
}

function request<T>(path: string, init: RequestInit): Promise<T> {
  const generation = sessionGeneration;
  return fetch(`${BACKEND_BASE}${path}`, init).then((r) => handle<T>(r, generation));
}

export function apiGet<T>(path: string): Promise<T> {
  return request<T>(path, { headers: { ...authHeader() } });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { "content-type": "application/json", ...authHeader() },
    body: JSON.stringify(body ?? {}),
  });
}

/** Same as apiPost, but for multipart/form-data (real file uploads) — no content-type header set
 * explicitly, since the browser needs to generate the multipart boundary itself. */
export function apiPostForm<T>(path: string, formData: FormData): Promise<T> {
  return request<T>(path, {
    method: "POST",
    headers: { ...authHeader() },
    body: formData,
  });
}

export function apiPatch<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PATCH",
    headers: { "content-type": "application/json", ...authHeader() },
    body: JSON.stringify(body ?? {}),
  });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return request<T>(path, {
    method: "PUT",
    headers: { "content-type": "application/json", ...authHeader() },
    body: JSON.stringify(body ?? {}),
  });
}

export function apiDelete<T>(path: string): Promise<T> {
  return request<T>(path, { method: "DELETE", headers: { ...authHeader() } });
}
