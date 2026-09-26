import { BACKEND_BASE } from "./backendBase";
import { apiPost } from "./apiClient";
import type { Role } from "../types";

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: Role;
  roleUserId: string;
}

const TOKEN_KEY = "sd-auth-token";
const USER_KEY = "sd-auth-user";

export function loadStoredAuth(): { token: string; user: AuthUser } | null {
  if (typeof window === "undefined") return null;
  const token = window.localStorage.getItem(TOKEN_KEY);
  const rawUser = window.localStorage.getItem(USER_KEY);
  if (!token || !rawUser) return null;
  try {
    return { token, user: JSON.parse(rawUser) as AuthUser };
  } catch {
    return null;
  }
}

export function saveAuth(token: string, user: AuthUser) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth() {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

export async function login(email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch(`${BACKEND_BASE}/api/auth/login`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Login failed (${response.status})`);
  return data;
}

export interface RegisterInput {
  name: string;
  email: string;
  password: string;
  country: string;
  referralCode?: string;
}

/** Public student self-signup — optionally arriving via an agent's referral link/QR/code, which
 * auto-connects the new account to that agent server-side (see server/src/routes/auth.js). */
export async function register(input: RegisterInput): Promise<{ token: string; user: AuthUser; agentName?: string }> {
  const response = await fetch(`${BACKEND_BASE}/api/auth/register`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Sign up failed (${response.status})`);
  return data;
}

/** Sign in (existing account, any role) or self-signup (new student account, optionally via an
 * agent's referral code) with a Google Identity Services ID token — verified server-side, see
 * server/src/routes/auth.js's POST /google. */
export async function googleAuth(credential: string, referralCode?: string): Promise<{ token: string; user: AuthUser; agentName?: string }> {
  const response = await fetch(`${BACKEND_BASE}/api/auth/google`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ credential, referralCode }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Google sign-in failed (${response.status})`);
  return data;
}

/** Whether this deployment has zero admin accounts yet — /staff/login uses this to decide whether
 * to offer "set up the first admin account" at all (see server/src/routes/auth.js's GET
 * /admin-setup-status). Never reveals who the admin is, just whether one exists. */
export async function checkAdminSetupNeeded(): Promise<boolean> {
  const response = await fetch(`${BACKEND_BASE}/api/auth/admin-setup-status`);
  const data = await response.json().catch(() => ({}));
  return Boolean(data.needsSetup);
}

/** Creates the first admin account — the server re-checks independently that none exists yet, so
 * this always fails once one does (see server/src/routes/auth.js's POST /bootstrap-admin). */
export async function bootstrapAdmin(name: string, email: string, password: string): Promise<{ token: string; user: AuthUser }> {
  const response = await fetch(`${BACKEND_BASE}/api/auth/bootstrap-admin`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ name, email, password }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Couldn't set up the admin account (${response.status})`);
  return data;
}

/** Self-service password change for the logged-in account (any role) — requires the current
 * password, matching the server's own check (see server/src/routes/auth.js's POST /change-password). */
export function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  return apiPost<{ success: true }>("/api/auth/change-password", { currentPassword, newPassword }).then(() => undefined);
}

export async function fetchMe(token: string): Promise<AuthUser> {
  const response = await fetch(`${BACKEND_BASE}/api/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Session check failed (${response.status})`);
  return data.user;
}
