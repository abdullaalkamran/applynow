// Postgres-backed via /api/document-due-dates (server/src/routes/documentDueDates.js) — same
// synchronous-cache pattern as every other migrated store. This used to be plain per-browser
// localStorage, which meant a counsellor's due date on a document request was invisible to the
// student and agent who needed to see it, and to the "Due soon"/"Overdue" flags taskBoard.ts
// derives from it for their Tasks pages — works uniformly whether the document is automatically
// required (core/university derived) or a custom request, since it's keyed only by
// (applicationId, type).
import { apiGet, apiPost, apiDelete } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";

interface DueDateEntry {
  id: string;
  applicationId: string;
  docType: string;
  dueDate: string;
}

let cache: DueDateEntry[] = [];
let refreshSeq = 0;

/** Every document due date the caller's account can see — call once after login (see
 * utils/warmCaches.ts), same as every other migrated store. */
export async function refreshDocDueDates(): Promise<void> {
  const seq = ++refreshSeq;
  const next = await apiGet<DueDateEntry[]>("/api/document-due-dates");
  // A slower, older response landing after a newer one must not win.
  if (seq !== refreshSeq) return;
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

export function loadDocDueDate(applicationId: string, type: string): string | undefined {
  return cache.find((d) => d.applicationId === applicationId && d.docType === type)?.dueDate;
}

/** Setting an empty date clears it; otherwise it's an upsert — a document only ever has one due
 * date, so setting a new one just moves it. */
export function setDocDueDate(applicationId: string, type: string, dueDate: string) {
  if (!dueDate) {
    cache = cache.filter((d) => !(d.applicationId === applicationId && d.docType === type));
    notifyCacheChange();
    apiDelete(`/api/document-due-dates?applicationId=${encodeURIComponent(applicationId)}&docType=${encodeURIComponent(type)}`).catch(
      (err) => console.warn("Failed to remove document due date:", err)
    );
    return;
  }

  const optimisticId = `duedate-${Date.now()}`;
  const hadExisting = cache.some((d) => d.applicationId === applicationId && d.docType === type);
  const prev = cache;
  cache = hadExisting
    ? cache.map((d) => (d.applicationId === applicationId && d.docType === type ? { ...d, dueDate } : d))
    : [...cache, { id: optimisticId, applicationId, docType: type, dueDate }];
  notifyCacheChange();

  apiPost<DueDateEntry>("/api/document-due-dates", { applicationId, docType: type, dueDate })
    .then((serverEntry) => {
      cache = [...cache.filter((d) => !(d.applicationId === applicationId && d.docType === type)), serverEntry];
      notifyCacheChange();
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist document due date:", err);
    });
}

/** "Overdue" / "Due soon" / "On track" classification for showing urgency. */
export function dueDateTone(dueDate: string | undefined): "overdue" | "soon" | "normal" | "none" {
  if (!dueDate) return "none";
  const days = Math.round((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "normal";
}

/** Drops everything cached for the current session — called on logout/login (see warmCaches.ts)
 * so the next user on this browser never sees the previous one's data. */
export function clearDocumentDueDatesCache() {
  cache = [];
}
