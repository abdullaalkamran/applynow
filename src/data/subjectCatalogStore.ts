// Postgres-backed via /api/subjects (server/src/routes/subjects.js) — Data Management's real,
// editable field-of-study catalog (name, "why this subject" description, curriculum modules,
// accrediting bodies). Distinct from subjectsStore.ts, which is just the flat name-only picklist
// (localStorage) used by UniversityForm's "Subjects offered" checklist — that one isn't touched
// here. Same synchronous-cache pattern as applicationsStore.ts.
import { apiGet, apiPost, apiPatch } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";

export interface SubjectRecord {
  id: string;
  name: string;
  custom: boolean;
  description?: string;
  modules: string[];
  careers: string[];
  accreditations: string[];
  createdAt: string;
  updatedAt: string;
}

let cache: SubjectRecord[] = [];

export async function refreshSubjectCatalog(): Promise<void> {
  const next = await apiGet<SubjectRecord[]>("/api/subjects");
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

export function getSubjectCatalog(): SubjectRecord[] {
  return cache;
}

/** Case-insensitive — subject names are picked from the same free-text taxonomy elsewhere in the
 * app (subjectsStore.ts), which doesn't enforce casing. */
export function getSubjectRecord(name: string): SubjectRecord | undefined {
  return cache.find((s) => s.name.toLowerCase() === name.toLowerCase());
}

export interface SubjectInput {
  name: string;
  description?: string;
  modules: string[];
  careers: string[];
  accreditations: string[];
}

export async function createSubjectRecord(input: SubjectInput): Promise<SubjectRecord> {
  const record = await apiPost<SubjectRecord>("/api/subjects", input);
  cache = [...cache, record].sort((a, b) => a.name.localeCompare(b.name));
  notifyCacheChange();
  return record;
}

export async function updateSubjectRecord(id: string, patch: Partial<SubjectInput>): Promise<SubjectRecord> {
  const updated = await apiPatch<SubjectRecord>(`/api/subjects/${id}`, patch);
  cache = cache.map((s) => (s.id === id ? updated : s)).sort((a, b) => a.name.localeCompare(b.name));
  notifyCacheChange();
  return updated;
}
