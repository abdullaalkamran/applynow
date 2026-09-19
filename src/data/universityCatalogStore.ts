// Postgres-backed via /api/universities (server/src/routes/universities.js) — the real partner-
// university catalog, shared across every account instead of living only in the browser that
// created it. Same synchronous-cache pattern as applicationsStore.ts: reads stay synchronous (the
// dozens of existing call sites — student/agent/counsellor browse pages, the AI tool registry,
// universityFilter.ts — never need to change), backed by a cache warmed after login and kept
// current after every write.
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import { getCountryId } from "./countryRegistry";
import type { University } from "../types";

type Course = University["courses"][number];

let cache: University[] = [];

export async function refreshUniversities(): Promise<void> {
  const next = await apiGet<University[]>("/api/universities");
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

export function getAllUniversities(): University[] {
  return cache;
}

export function getUniversityById(id: string): University | undefined {
  return cache.find((u) => u.id === id);
}

/** Every university here is real, Data-Management-authored content now (no more static seed to
 * distinguish from) — kept only so the "Custom" badge in Universities.tsx doesn't need its own
 * follow-up change. */
export function isCustomUniversity(_id: string): boolean {
  return true;
}

export function addUniversity(data: Omit<University, "id">): University {
  const id = `u-custom-${Date.now().toString(36)}`;
  const optimistic: University = { ...data, id };
  cache = [...cache, optimistic];
  notifyCacheChange();
  getCountryId(optimistic.country);

  apiPost<University>("/api/universities", { id, ...data })
    .then((created) => {
      cache = cache.map((u) => (u.id === id ? created : u));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to persist new university:", err));

  return optimistic;
}

export function updateUniversity(id: string, patch: Partial<University>) {
  if (patch.country) getCountryId(patch.country);
  cache = cache.map((u) => (u.id === id ? { ...u, ...patch } : u));
  notifyCacheChange();

  apiPatch<University>(`/api/universities/${id}`, patch)
    .then((updated) => {
      cache = cache.map((u) => (u.id === id ? updated : u));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to persist university update:", err));
}

export function deleteUniversity(id: string) {
  cache = cache.filter((u) => u.id !== id);
  notifyCacheChange();
  apiDelete(`/api/universities/${id}`).catch((err) => console.warn("Failed to delete university:", err));
}

export function addCourse(universityId: string, course: Omit<Course, "id">): Course {
  const id = `crs-custom-${Date.now().toString(36)}`;
  const newCourse: Course = { ...course, id };
  cache = cache.map((u) => (u.id === universityId ? { ...u, courses: [...u.courses, newCourse] } : u));
  notifyCacheChange();

  apiPost<Course>(`/api/universities/${universityId}/courses`, { id, ...course })
    .then((serverCourse) => {
      cache = cache.map((u) =>
        u.id === universityId ? { ...u, courses: u.courses.map((c) => (c.id === id ? serverCourse : c)) } : u
      );
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to persist new course:", err));

  return newCourse;
}

/** Courses are matched by `id`, not name — a course's name is just a display field an editor can
 * freely change without breaking the reference to it (the same reason universities aren't matched
 * by name either). */
export function updateCourse(universityId: string, courseId: string, patch: Partial<Course>) {
  cache = cache.map((u) =>
    u.id === universityId ? { ...u, courses: u.courses.map((c) => (c.id === courseId ? { ...c, ...patch } : c)) } : u
  );
  notifyCacheChange();

  apiPatch<Course>(`/api/universities/${universityId}/courses/${courseId}`, patch).catch((err) =>
    console.warn("Failed to persist course update:", err)
  );
}

export function removeCourse(universityId: string, courseId: string) {
  cache = cache.map((u) => (u.id === universityId ? { ...u, courses: u.courses.filter((c) => c.id !== courseId) } : u));
  notifyCacheChange();
  apiDelete(`/api/universities/${universityId}/courses/${courseId}`).catch((err) =>
    console.warn("Failed to delete course:", err)
  );
}

// --- One-time recovery of whatever this browser had saved locally before this store moved to
// Postgres — otherwise a university someone already spent time filling in would just silently
// vanish the moment this ships, since the new cache starts out reading from the (empty) server
// instead of localStorage. Runs once per browser (tracked by MIGRATED_KEY) and only ever adds
// data; it never deletes the old localStorage keys' *content*, only stops re-attempting.
const LEGACY_CREATED_KEY = "data-mgmt-created-universities";
const MIGRATED_KEY = "data-mgmt-universities-migrated-to-server";

export async function migrateLegacyLocalUniversities(): Promise<void> {
  if (typeof window === "undefined" || window.localStorage.getItem(MIGRATED_KEY)) return;
  let legacy: University[] = [];
  try {
    const raw = window.localStorage.getItem(LEGACY_CREATED_KEY);
    legacy = raw ? (JSON.parse(raw) as University[]) : [];
  } catch {
    legacy = [];
  }
  if (legacy.length === 0) {
    window.localStorage.setItem(MIGRATED_KEY, "true");
    return;
  }
  for (const u of legacy) {
    try {
      await apiPost<University>("/api/universities", u);
    } catch (err) {
      console.warn(`Failed to migrate locally-saved university "${u.name}" to the server:`, err);
      return; // leaves MIGRATED_KEY unset so this retries next load instead of losing the rest
    }
  }
  window.localStorage.setItem(MIGRATED_KEY, "true");
  await refreshUniversities();
}
