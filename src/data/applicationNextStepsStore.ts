// Postgres-backed via /api/next-steps (server/src/routes/applicationNextSteps.js) — same
// synchronous-cache pattern as every other migrated store. This used to be plain per-browser
// localStorage, which meant a counsellor's next step for a student was invisible to that
// student's and agent's own logins — the whole point of a "next step" only holds if the person
// who has to act on it can actually see it, and the same gap meant it never actually turned into
// a due-dated task on their Tasks page either (see taskBoard.ts's nextStepTasksFor).
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";

export interface NextStep {
  id: string;
  applicationId: string;
  title: string;
  createdAt: string;
  done: boolean;
  // Set the moment `done` flips true — once set, the step is locked (see toggleNextStepDone), so
  // this is a permanent record of when it actually happened, not just its current state.
  completedAt?: string;
  dueDate?: string;
}

let cache: NextStep[] = [];
let refreshSeq = 0;

/** Every next step the caller's account can see — call once after login (see utils/warmCaches.ts),
 * same as every other migrated store. */
export async function refreshNextSteps(): Promise<void> {
  const seq = ++refreshSeq;
  const next = await apiGet<NextStep[]>("/api/next-steps");
  // A slower, older response landing after a newer one must not win.
  if (seq !== refreshSeq) return;
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

export function loadNextSteps(applicationId: string): NextStep[] {
  return cache.filter((s) => s.applicationId === applicationId);
}

/** Counsellor-only in practice (every UI call site restricts who can reach this), but not
 * enforced here — same trust level as the rest of this phase's write routes. */
export function addNextStep(applicationId: string, title: string, dueDate?: string): NextStep | null {
  const trimmed = title.trim();
  if (!trimmed) return null;
  const optimisticId = `ns-${Date.now()}`;
  const optimistic: NextStep = {
    id: optimisticId, applicationId, title: trimmed, createdAt: new Date().toISOString().slice(0, 10),
    done: false, dueDate: dueDate || undefined,
  };
  const prev = cache;
  cache = [...cache, optimistic];
  notifyCacheChange();
  apiPost<NextStep>("/api/next-steps", { applicationId, title: trimmed, dueDate: dueDate || undefined })
    .then((serverStep) => {
      cache = cache.map((s) => (s.id === optimisticId ? serverStep : s));
      notifyCacheChange();
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist next step:", err);
    });
  return optimistic;
}

/** Marking a step done is one-way — once completed it's locked (mirroring the server, which
 * rejects any further PATCH on an already-done step), so a stray double-click can't quietly
 * un-check something that already happened and erase its completion date. */
export function toggleNextStepDone(_applicationId: string, stepId: string) {
  const current = cache.find((s) => s.id === stepId);
  if (!current || current.done) return;
  const completedAt = new Date().toISOString().slice(0, 10);
  const prev = cache;
  cache = cache.map((s) => (s.id === stepId ? { ...s, done: true, completedAt } : s));
  notifyCacheChange();
  apiPatch<NextStep>(`/api/next-steps/${stepId}`, { done: true })
    .then((serverStep) => {
      cache = cache.map((s) => (s.id === stepId ? serverStep : s));
      notifyCacheChange();
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to complete next step:", err);
    });
}

export function setNextStepDueDate(_applicationId: string, stepId: string, dueDate: string) {
  const current = cache.find((s) => s.id === stepId);
  if (!current || current.done) return; // locked — same rule as toggleNextStepDone
  const prev = cache;
  cache = cache.map((s) => (s.id === stepId ? { ...s, dueDate: dueDate || undefined } : s));
  notifyCacheChange();
  apiPatch<NextStep>(`/api/next-steps/${stepId}`, { dueDate: dueDate || null })
    .then((serverStep) => {
      cache = cache.map((s) => (s.id === stepId ? serverStep : s));
      notifyCacheChange();
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to set next step due date:", err);
    });
}

export function removeNextStep(_applicationId: string, stepId: string) {
  const prev = cache;
  cache = cache.filter((s) => s.id !== stepId);
  notifyCacheChange();
  apiDelete(`/api/next-steps/${stepId}`).catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to remove next step:", err);
    });
}

/** "Overdue" / "Due soon" / "On track" classification for showing urgency. */
export function dueDateTone(dueDate: string | undefined, done: boolean): "overdue" | "soon" | "normal" | "none" {
  if (!dueDate) return "none";
  if (done) return "normal";
  const days = Math.round((new Date(dueDate).getTime() - Date.now()) / 86_400_000);
  if (days < 0) return "overdue";
  if (days <= 3) return "soon";
  return "normal";
}

/** Drops everything cached for the current session — called on logout/login (see warmCaches.ts)
 * so the next user on this browser never sees the previous one's data. */
export function clearApplicationNextStepsCache() {
  cache = [];
}
