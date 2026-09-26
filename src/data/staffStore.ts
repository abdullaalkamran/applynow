// Postgres-backed via /api/staff (server/src/routes/staff.js) — same synchronous-cache pattern as
// applicationsStore.ts.
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import type { Role } from "../types";

export type StaffStatus = "Active" | "Invited" | "Inactive";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: StaffStatus;
  avatarColor: string;
  organization?: string | null;
  // Agents only — lazily generated on their first self-fetch (see server's GET /staff/me); a
  // freshly invited or not-yet-visited agent may still be null. Always present in the raw server
  // row for every role, so declared here rather than agent-only, even though it's only meaningful
  // for that one role.
  referralCode?: string | null;
  // Whether this member actually has a working login (a User row) yet — an "Invited" member added
  // without a password has a directory row but no way to ever log in until one is set (see
  // setStaffPassword below). Independent of `status`: an Active member could in principle still
  // lack a login if one was never set, same as an Inactive one who does have a login just can't
  // currently use it (server/src/routes/auth.js enforces that at login and on every request).
  hasLogin: boolean;
}

let cache: StaffMember[] = [];
let refreshSeq = 0;

export async function refreshStaff(): Promise<void> {
  const seq = ++refreshSeq;
  const next = await apiGet<StaffMember[]>("/api/staff");
  // A slower, older response landing after a newer one must not win.
  if (seq !== refreshSeq) return;
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

export function loadStaff(): StaffMember[] {
  return cache;
}

/** `password` is optional — without one this member has no way to log in until an admin sets one
 * later (see setStaffPassword), same trade-off agentStudentsStore.ts's addAgentStudent makes for
 * students. Genuinely async (not optimistic-then-reconcile): the caller needs the real server
 * record, including `hasLogin`, before it can render correctly. */
export async function inviteStaff(name: string, email: string, role: Role, password?: string): Promise<StaffMember> {
  const member = await apiPost<StaffMember>("/api/staff", { name, email, role, password });
  cache = [...cache, member];
  notifyCacheChange();
  return member;
}

export function updateStaffRole(id: string, role: Role) {
  const prev = cache;
  cache = cache.map((m) => (m.id === id ? { ...m, role } : m));
  notifyCacheChange();
  apiPatch(`/api/staff/${id}`, { role }).catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist staff role change:", err);
    });
}

export function setStaffStatus(id: string, status: StaffStatus) {
  const prev = cache;
  cache = cache.map((m) => (m.id === id ? { ...m, status } : m));
  notifyCacheChange();
  apiPatch(`/api/staff/${id}`, { status }).catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist staff status change:", err);
    });
}

/** Sets a working login password for a member — the only way to fix an "Invited" member who was
 * added without one, or to reset an existing member's password. Reconciles from the real server
 * response (not optimistic) since this can also flip `status` to Active and `hasLogin` to true. */
export async function setStaffPassword(id: string, password: string): Promise<StaffMember> {
  const member = await apiPatch<StaffMember>(`/api/staff/${id}`, { password });
  cache = cache.map((m) => (m.id === id ? member : m));
  notifyCacheChange();
  return member;
}

export function removeStaff(id: string) {
  const prev = cache;
  cache = cache.filter((m) => m.id !== id);
  notifyCacheChange();
  apiDelete(`/api/staff/${id}`).catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to delete staff member on server:", err);
    });
}

/** Drops everything cached for the current session — called on logout/login (see warmCaches.ts)
 * so the next user on this browser never sees the previous one's data. */
export function clearStaffCache() {
  cache = [];
}
