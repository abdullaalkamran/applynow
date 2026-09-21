// Every student, unfiltered — Postgres-backed via /api/students (server/src/routes/students.js),
// same synchronous-cache pattern as agentStudentsStore.ts/counsellorStudentsStore.ts. Needed by
// Data Management's country page (see Universities.tsx) to show which students/agents are tied to
// a given destination country — a role that has no existing "my students" scoping to reuse — and
// by the admin Student Management page, which is where the write helpers below are used.
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import type { Student } from "../types";

let cache: Student[] = [];
let refreshSeq = 0;

export async function refreshAllStudents(): Promise<void> {
  const seq = ++refreshSeq;
  const next = await apiGet<Student[]>("/api/students");
  // A slower, older response landing after a newer one must not win.
  if (seq !== refreshSeq) return;
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

/** Every student in the system, as of the last successful fetch. */
export function getAllStudents(): Student[] {
  return cache;
}

export interface NewStudentInput {
  name: string;
  email: string;
  phone?: string;
  country: string;
  agentId?: string;
  counsellorId?: string;
  // Optional — without one the student has a profile but no way to sign in until an admin sets a
  // password later (see setStudentPassword), the same trade-off staffStore.ts's inviteStaff makes.
  password?: string;
}

/** Admin-side registration. Genuinely async (not optimistic-then-reconcile) since the caller
 * needs the real server record — id, avatar colour, `hasLogin` — before it can render it. */
export async function createStudent(input: NewStudentInput): Promise<Student> {
  const student = await apiPost<Student>("/api/students", input);
  cache = [...cache, student];
  notifyCacheChange();
  return student;
}

// `agentId`/`counsellorId` accept null to unassign — the API needs an explicit null to clear the
// column, since `undefined` keys are dropped from the JSON body and so mean "leave as is".
export type StudentPatch = Partial<Pick<Student, "name" | "email" | "phone" | "country" | "riskFlag">> & {
  agentId?: string | null;
  counsellorId?: string | null;
};

/** Optimistic: updates the cache immediately and persists in the background, like the other
 * stores' small field edits. */
export function updateStudent(id: string, patch: StudentPatch) {
  const prev = cache;
  cache = cache.map((s) => {
    if (s.id !== id) return s;
    const next: Student = { ...s, ...patch, agentId: s.agentId, counsellorId: s.counsellorId };
    if ("agentId" in patch) next.agentId = patch.agentId ?? undefined;
    if ("counsellorId" in patch) next.counsellorId = patch.counsellorId ?? undefined;
    return next;
  });
  notifyCacheChange();
  apiPatch(`/api/students/${id}`, patch).catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist student change:", err);
    });
}

/** Sets (or resets) a student's login password — the only way to give a student who was
 * registered without one a working login. Reconciles from the real server response since this
 * flips `hasLogin`. */
export async function setStudentPassword(id: string, password: string): Promise<Student> {
  const student = await apiPatch<Student>(`/api/students/${id}`, { password });
  cache = cache.map((s) => (s.id === id ? student : s));
  notifyCacheChange();
  return student;
}

/** Deletes the student, their login and dependent profile data. Awaited rather than optimistic
 * because the server refuses (409) while they still have applications, and the caller needs to
 * surface that message instead of silently showing the row gone. */
export async function removeStudent(id: string): Promise<void> {
  await apiDelete<void>(`/api/students/${id}`);
  cache = cache.filter((s) => s.id !== id);
  notifyCacheChange();
}

/** Drops everything cached for the current session — called on logout/login (see warmCaches.ts)
 * so the next user on this browser never sees the previous one's data. */
export function clearAllStudentsCache() {
  cache = [];
}
