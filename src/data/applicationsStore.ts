// Postgres-backed via the new /api/applications routes (server/src/routes/applications.js) —
// see the migration plan for the "synchronous cache backed by a real API" pattern this follows.
// Reads stay synchronous (an in-memory cache warmed after login and kept current after every
// write) so the dozens of existing call sites — including plain, non-React functions like the AI
// tool registry and taskBoard.ts, which can't use hooks — need no changes. Status history
// (`getStatusHistory`) stays localStorage-backed for now — a deferred-phase migration, not part
// of this cutover. The activity timeline (`applicationActivityStore.ts`) is now Postgres-backed
// too, written automatically server-side by the status/assignment routes below — nothing here
// calls recordActivity() itself, since doing so would just double the entry the server already
// creates in the same request.
import { apiGet, apiPatch, apiPost } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import { ensureCoreDocRequested } from "./coreDocsStore";
import type { Application, AppStatus, Role } from "../types";

type Actor = { id: string; role: Role; name: string };

let cache: Application[] = [];

/** Fetches every application the caller's account can see and replaces the cache — call once
 * after login (see utils/warmCaches.ts) and after this store isn't the source of a write itself
 * (e.g. nothing needed here beyond the initial warm-up, since mutations update the cache directly). */
export async function refreshApplications(): Promise<void> {
  const next = await apiGet<Application[]>("/api/applications");
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

/** Re-fetches one application and merges it into the cache — used to reconcile after a journey
 * stage update on the server has recomputed status/progress/nextAction server-side. */
async function refreshOne(applicationId: string): Promise<void> {
  try {
    const updated = await apiGet<Application>(`/api/applications/${applicationId}`);
    cache = cache.map((a) => (a.id === applicationId ? updated : a));
    notifyCacheChange();
  } catch (err) {
    console.warn("Failed to refresh application from server:", err);
  }
}

/** Every application visible to the current session, as of the last successful fetch/mutation. */
export function getAllApplications(): Application[] {
  return cache;
}

export function applicationSortKey(a: Application): number {
  if (a.createdAt) return new Date(a.createdAt).getTime();
  const seedMatch = a.id.match(/^app(\d+)$/);
  if (seedMatch) return parseInt(seedMatch[1], 10);
  const customMatch = a.id.match(/^app-custom-(\d+)$/);
  if (customMatch) return parseInt(customMatch[1], 10);
  return 0;
}

export function sortByCreatedAscending(apps: Application[]): Application[] {
  return [...apps].sort((a, b) => applicationSortKey(a) - applicationSortKey(b));
}

export function sortByCreatedDescending(apps: Application[]): Application[] {
  return [...apps].sort((a, b) => applicationSortKey(b) - applicationSortKey(a));
}

/** Cache-only status/nextAction update, no server round trip — used by applicationJourneyStore.ts
 * after its own journey PATCH has already persisted the derived status server-side, so the
 * applications cache reflects it immediately without a second, redundant status PATCH (which
 * would also double-send the status-change notification). */
export function applyLocalStatusUpdate(applicationId: string, status: AppStatus, nextAction?: string) {
  cache = cache.map((a) =>
    a.id === applicationId
      ? { ...a, status, ...(nextAction !== undefined ? { nextAction } : {}), updatedAt: new Date().toISOString().slice(0, 10) }
      : a
  );
  notifyCacheChange();
}

/** A counsellor moving an application to a new status directly (outside the 9-stage journey UI).
 * Optimistically updates the cache so callers see the change immediately, then persists to the
 * server — which also writes the status-history/activity rows and fires the WhatsApp/email
 * notification itself (see server/src/routes/applications.js), so nothing further is needed here
 * for that side effect. `actor`/`token` are accepted for call-site compatibility but no longer
 * used client-side. */
export function updateApplicationStatus(applicationId: string, status: AppStatus, nextAction?: string, _actor?: Actor, _token?: string) {
  applyLocalStatusUpdate(applicationId, status, nextAction);
  apiPatch<Application>(`/api/applications/${applicationId}/status`, { status, nextAction })
    .then((updated) => {
      cache = cache.map((a) => (a.id === applicationId ? updated : a));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to persist status update:", err));
}

// `actor` is accepted for call-site compatibility (ResponsibleStaffCard passes it) but no longer
// used client-side — the server's own /assign-counsellor route already writes the
// counsellor_assigned activity row itself, attributed to whoever's actually authenticated.
export function assignCounsellor(applicationId: string, counsellorId: string, _actor: Actor) {
  cache = cache.map((a) => (a.id === applicationId ? { ...a, responsibleCounsellorId: counsellorId } : a));
  notifyCacheChange();
  apiPatch(`/api/applications/${applicationId}/assign-counsellor`, { counsellorId }).catch((err) =>
    console.warn("Failed to persist counsellor assignment:", err)
  );
}

// Same reasoning as assignCounsellor above.
export function assignAdmissionOfficer(applicationId: string, officerId: string, _actor: Actor) {
  cache = cache.map((a) => (a.id === applicationId ? { ...a, responsibleAdmissionOfficerId: officerId } : a));
  notifyCacheChange();
  apiPatch(`/api/applications/${applicationId}/assign-admission-officer`, { officerId }).catch((err) =>
    console.warn("Failed to persist admission officer assignment:", err)
  );
}

export interface StatusHistoryEntry {
  status: AppStatus;
  changedAt: string;
}

const HISTORY_PREFIX = "sd-application-status-history:";

function loadRawHistory(applicationId: string): StatusHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_PREFIX + applicationId);
    return raw ? (JSON.parse(raw) as StatusHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

/** Deferred: still localStorage-backed (see server's own ApplicationStatusHistory table for the
 * authoritative copy, not yet read from here). */
export function getStatusHistory(applicationId: string): StatusHistoryEntry[] {
  const base = cache.find((a) => a.id === applicationId);
  const seedEntry: StatusHistoryEntry[] = base ? [{ status: base.status, changedAt: base.updatedAt }] : [];
  return [...seedEntry, ...loadRawHistory(applicationId)];
}

export interface NewApplicationInput {
  studentId: string;
  university: string;
  course: string;
  intake: string;
  country: string;
  campus: string;
  source?: "student" | "counsellor";
}

/** Genuinely needs the server round trip (id + journey are assigned there) — every existing call
 * site is either a UI event handler or an AI tool's `execute` (already Promise-tolerant), so this
 * is the one function in this store that became async rather than staying cache-only. */
export async function createApplication(input: NewApplicationInput): Promise<Application> {
  const application = await apiPost<Application>("/api/applications", input);
  cache = [...cache, application];
  notifyCacheChange();
  // A submitted application always needs a Statement of Purpose — require it in the student's core
  // vault the moment it's first relevant, rather than waiting for a counsellor to notice and add it
  // manually via the ad-hoc "Add a document type" picker.
  ensureCoreDocRequested(input.studentId, "Statement of Purpose");
  return application;
}

export { refreshOne as refreshApplicationFromServer };
