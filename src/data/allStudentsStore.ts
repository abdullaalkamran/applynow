// Every student, unfiltered — Postgres-backed via /api/students (server/src/routes/students.js),
// same synchronous-cache pattern as agentStudentsStore.ts/counsellorStudentsStore.ts. Needed by
// Data Management's country page (see Universities.tsx) to show which students/agents are tied to
// a given destination country — a role that has no existing "my students" scoping to reuse.
import { apiGet } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import type { Student } from "../types";

let cache: Student[] = [];

export async function refreshAllStudents(): Promise<void> {
  const next = await apiGet<Student[]>("/api/students");
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

/** Every student in the system, as of the last successful fetch. */
export function getAllStudents(): Student[] {
  return cache;
}
