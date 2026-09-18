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

export function addAgentStudent(name: string, email: string, country: string): Student {
  const optimistic: Student = {
    id: `ast-${Date.now().toString(36)}`,
    name, email, country,
    agentId: CURRENT_AGENT_ID,
    avatarColor: "bg-sky-500",
    riskFlag: "none",
  };
  cache = [...cache, optimistic];
  notifyCacheChange();
  apiPost<Student>("/api/students", { name, email, country })
    .then((student) => {
      cache = cache.map((s) => (s.id === optimistic.id ? student : s));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to persist new student:", err));
  return optimistic;
}
