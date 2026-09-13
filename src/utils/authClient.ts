import { BACKEND_BASE } from "./backendBase";
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

export async function fetchMe(token: string): Promise<AuthUser> {
  const response = await fetch(`${BACKEND_BASE}/api/auth/me`, {
    headers: { authorization: `Bearer ${token}` },
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || `Session check failed (${response.status})`);
  return data.user;
}
