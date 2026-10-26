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

// A request that never answers (a stalled shared-hosting worker, a dropped connection) used to hang
// forever: the optimistic UI looked saved, then silently rolled back whenever the browser finally
// gave up. Bound every call, retry a read once when the server is briefly overloaded, and say
// plainly what happened instead of leaving the user guessing.
const REQUEST_TIMEOUT_MS = 45_000;
const UPLOAD_TIMEOUT_MS = 180_000;
const RETRYABLE_STATUS = new Set([502, 503, 504]);

// Reads go through a small queue. Signing in (and every poll after it) used to fire ~25 requests at once; on a shared host
// they all competed for the same few database connections, so a comment or status change made at that moment queued
// behind a pile of refreshes and timed out. Only GETs wait here — a save is never held up behind a background refresh.
const MAX_CONCURRENT_READS = 4;
let activeReads = 0;
const readQueue: Array<() => void> = [];

function acquireReadSlot(): Promise<void> {
  if (activeReads < MAX_CONCURRENT_READS) {
    activeReads++;
    return Promise.resolve();
  }
  return new Promise((resolve) => readQueue.push(() => { activeReads++; resolve(); }));
}

function releaseReadSlot() {
  activeReads--;
  readQueue.shift()?.();
}

async function request<T>(path: string, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS): Promise<T> {
  const isRead = !init.method || init.method === "GET";
  // Captured now, not when the request finally starts: a read that waited in the queue across a logout/login must still
  // be recognised as belonging to the old session and discarded.
  const generation = sessionGeneration;
  if (!isRead) return runRequest<T>(path, init, timeoutMs, false, generation);
  await acquireReadSlot();
  try {
    return await runRequest<T>(path, init, timeoutMs, true, generation);
  } finally {
    releaseReadSlot();
  }
}

async function runRequest<T>(path: string, init: RequestInit, timeoutMs: number, isRead: boolean, generation: number): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const response = await fetch(`${BACKEND_BASE}${path}`, { ...init, signal: controller.signal });
      if (isRead && attempt === 0 && RETRYABLE_STATUS.has(response.status)) continue;
      return await handle<T>(response, generation);
    } catch (err) {
      const name = (err as Error)?.name;
      if (name === "StaleSessionError") throw err;
      if (name === "AbortError") {
        if (isRead && attempt === 0) continue;
        throw new Error("The server took too long to respond — please try again.");
      }
      if (err instanceof TypeError) {
        if (isRead && attempt === 0) continue;
        throw new Error("Couldn't reach the server — check your connection and try again.");
      }
      throw err;
    } finally {
      clearTimeout(timer);
    }
  }
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
  }, UPLOAD_TIMEOUT_MS);
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
