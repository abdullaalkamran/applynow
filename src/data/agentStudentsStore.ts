// Postgres-backed via /api/students?agentId=... (server/src/routes/students.js) — same
// synchronous-cache pattern as applicationsStore.ts.
import { CURRENT_AGENT_ID } from "./mockData";
import { apiGet, apiPost } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import type { Student } from "../types";

let cache: Student[] = [];

export async function refreshAgentStudents(): Promise<void> {
  const next = await apiGet<Student[]>(`/api/students?agentId=${encodeURIComponent(CURRENT_AGENT_ID)}`);
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

/** All students referred by the demo agent, as of the last successful fetch/mutation. */
export function loadAgentStudents(): Student[] {
  return cache;
}

// Genuinely async (not the optimistic-then-reconcile pattern most of this store uses) — the
// caller (CreateStudentProfile.tsx) immediately keys a whole wizard's worth of localStorage writes
// (personal info, academic levels, English tests, ...) off this student's id, so it needs the
// server's real id back, not a throwaway client-generated one that would leave all of that data
// orphaned once the real record reconciled into the cache.
export async function addAgentStudent(name: string, email: string, country: string, password?: string): Promise<Student> {
  const student = await apiPost<Student>("/api/students", { name, email, country, password });
  cache = [...cache, student];
  notifyCacheChange();
  return student;
}
