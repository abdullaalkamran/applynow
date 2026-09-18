// Postgres-backed via /api/students?counsellorId=... (server/src/routes/students.js) — same
// synchronous-cache pattern as applicationsStore.ts. Server-side, "assigned to me" also includes
// agent-referred students with no counsellor yet (see students.js/prisma query — actually resolved
// client-side below since that "unclaimed but agent-referred" rule isn't a plain counsellorId
// filter); this store fetches both the assigned set and the unclaimed set and merges them,
// preserving the exact visibility rule this store had before the migration.
import { COUNSELLOR_ID } from "../utils/counsellorData";
import { apiGet, apiPost } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import type { Student } from "../types";

let cache: Student[] = [];

export async function refreshAssignedStudents(): Promise<void> {
  const [assigned, all] = await Promise.all([
    apiGet<Student[]>(`/api/students?counsellorId=${encodeURIComponent(COUNSELLOR_ID)}`),
    apiGet<Student[]>("/api/students"),
  ]);
  const unclaimedWithAgent = all.filter((s) => !s.counsellorId && !!s.agentId);
  const byId = new Map(assigned.map((s) => [s.id, s]));
  for (const s of unclaimedWithAgent) byId.set(s.id, s);
  const next = [...byId.values()];
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

/** All students the demo counsellor should see, as of the last successful fetch/mutation. */
export function loadAssignedStudents(): Student[] {
  return cache;
}

export function addStudent(name: string, email: string, country: string): Student {
  const optimistic: Student = {
    id: `st-${Date.now().toString(36)}`,
    name, email, country,
    counsellorId: COUNSELLOR_ID,
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
