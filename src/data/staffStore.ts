// Postgres-backed via /api/staff (server/src/routes/staff.js) — same synchronous-cache pattern as
// applicationsStore.ts.
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { notifyCacheChange } from "../utils/syncCache";
import type { Role } from "../types";

export type StaffStatus = "Active" | "Invited" | "Inactive";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: StaffStatus;
  avatarColor: string;
}

let cache: StaffMember[] = [];

export async function refreshStaff(): Promise<void> {
  cache = await apiGet<StaffMember[]>("/api/staff");
  notifyCacheChange();
}

export function loadStaff(): StaffMember[] {
  return cache;
}

export function inviteStaff(name: string, email: string, role: Role): StaffMember {
  const optimistic: StaffMember = { id: `u-${Date.now().toString(36)}`, name, email, role, status: "Invited", avatarColor: "bg-sky-500" };
  cache = [...cache, optimistic];
  notifyCacheChange();
  apiPost<StaffMember>("/api/staff", { name, email, role })
    .then((member) => {
      cache = cache.map((m) => (m.id === optimistic.id ? member : m));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to persist new staff member:", err));
  return optimistic;
}

export function updateStaffRole(id: string, role: Role) {
  cache = cache.map((m) => (m.id === id ? { ...m, role } : m));
  notifyCacheChange();
  apiPatch(`/api/staff/${id}`, { role }).catch((err) => console.warn("Failed to persist staff role change:", err));
}

export function setStaffStatus(id: string, status: StaffStatus) {
  cache = cache.map((m) => (m.id === id ? { ...m, status } : m));
  notifyCacheChange();
  apiPatch(`/api/staff/${id}`, { status }).catch((err) => console.warn("Failed to persist staff status change:", err));
}

export function removeStaff(id: string) {
  cache = cache.filter((m) => m.id !== id);
  notifyCacheChange();
  apiDelete(`/api/staff/${id}`).catch((err) => console.warn("Failed to delete staff member on server:", err));
}
