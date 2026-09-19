// Postgres-backed via /api/inbox (server/src/routes/inbox.js) — the real, persisted in-app
// notification inbox every role's header bell reads from. Distinct from utils/notifications.ts's
// student-only, entirely client-synthesized feed (messages/documents/application status derived
// from other stores, nothing server-side); this store is actual rows written by the server (e.g.
// applications.js's POST /:id/activity, for a new comment) and shared by every role. Same
// synchronous-cache pattern as tasksStore.ts.
import { apiGet, apiPatch } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";

export interface InboxNotification {
  id: string;
  type: string; // "comment_added" (per-application) | "student_comment_added" (case-level), extensible later
  title: string;
  body?: string;
  studentId?: string;
  applicationId?: string;
  activityId?: string;
  read: boolean;
  createdAt: string; // ISO datetime
}

let cache: InboxNotification[] = [];

export async function refreshInbox(): Promise<void> {
  const next = await apiGet<InboxNotification[]>("/api/inbox");
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

export function getInboxItems(): InboxNotification[] {
  return cache;
}

export function unreadInboxCount(): number {
  return cache.filter((n) => !n.read).length;
}

export function markInboxItemRead(id: string) {
  const already = cache.find((n) => n.id === id)?.read;
  if (already) return;
  cache = cache.map((n) => (n.id === id ? { ...n, read: true } : n));
  notifyCacheChange();
  apiPatch(`/api/inbox/${id}/read`, {}).catch((err) => console.warn("Failed to mark notification read:", err));
}

export function markAllInboxRead() {
  if (cache.every((n) => n.read)) return;
  cache = cache.map((n) => ({ ...n, read: true }));
  notifyCacheChange();
  apiPatch(`/api/inbox/read-all`, {}).catch((err) => console.warn("Failed to mark all notifications read:", err));
}
