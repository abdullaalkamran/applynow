// Postgres-backed via /api/universities (server/src/routes/universities.js) — the real partner-
// university catalog, shared across every account instead of living only in the browser that
// created it. Same synchronous-cache pattern as applicationsStore.ts: reads stay synchronous (the
// dozens of existing call sites — student/agent/counsellor browse pages, the AI tool registry,
// universityFilter.ts — never need to change), backed by a cache warmed after login and kept
// current after every write.
import { loadStoredAuth } from "../utils/authClient";
import { apiGet, apiPost, apiPatch, apiDelete } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";
import { getCountryId } from "./countryRegistry";
import type { University } from "../types";

type Course = University["courses"][number];

let cache: University[] = [];
let refreshSeq = 0;

export async function refreshUniversities(): Promise<void> {
  const seq = ++refreshSeq;
  const next = await apiGet<University[]>("/api/universities");
  // A slower, older response landing after a newer one must not win.
  if (seq !== refreshSeq) return;
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

// `saved` lets a caller that cares (UniversityForm's own Save button) await the real server
// outcome and show a real error instead of navigating on the strength of the optimistic value
// alone — a form embedding a logo/cover photo as a data: URL can genuinely fail server-side (body
// too large, network drop) well after the optimistic update already made the change look saved.
export function addUniversity(data: Omit<University, "id">): { optimistic: University; saved: Promise<University> } {
  const id = `u-custom-${Date.now().toString(36)}`;
  const optimistic: University = { ...data, id };
  const prev = cache;
  cache = [...cache, optimistic];
  notifyCacheChange();
  getCountryId(optimistic.country);

  const saved = apiPost<University>("/api/universities", { id, ...data })
    .then((created) => {
      cache = cache.map((u) => (u.id === id ? created : u));
      notifyCacheChange();
      return created;
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name !== "StaleSessionError") {
        cache = prev;
        notifyCacheChange();
        console.warn("Failed to persist new university:", err);
      }
      throw err;
    });

  return { optimistic, saved };
}

export function updateUniversity(id: string, patch: Partial<University>): Promise<void> {
  if (patch.country) getCountryId(patch.country);
  const prev = cache;
  cache = cache.map((u) => (u.id === id ? { ...u, ...patch } : u));
  notifyCacheChange();

  return apiPatch<University>(`/api/universities/${id}`, patch)
    .then((updated) => {
      cache = cache.map((u) => (u.id === id ? updated : u));
      notifyCacheChange();
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name !== "StaleSessionError") {
        cache = prev;
        notifyCacheChange();
        console.warn("Failed to persist university update:", err);
      }
      throw err;
    });
}

export function deleteUniversity(id: string) {
  const prev = cache;
  cache = cache.filter((u) => u.id !== id);
  notifyCacheChange();
  apiDelete(`/api/universities/${id}`).catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to delete university:", err);
    });
}

export function addCourse(universityId: string, course: Omit<Course, "id">): Course {
  const id = `crs-custom-${Date.now().toString(36)}`;
  const newCourse: Course = { ...course, id };
  const prev = cache;
  cache = cache.map((u) => (u.id === universityId ? { ...u, courses: [...u.courses, newCourse] } : u));
  notifyCacheChange();

  apiPost<Course>(`/api/universities/${universityId}/courses`, { id, ...course })
    .then((serverCourse) => {
      cache = cache.map((u) =>
        u.id === universityId ? { ...u, courses: u.courses.map((c) => (c.id === id ? serverCourse : c)) } : u
      );
      notifyCacheChange();
    })
    .catch((err) => {
      // Roll the optimistic change back so the UI never shows a save that didn't happen — unless
      // the session ended meanwhile, in which case the cache was already cleared on purpose.
      if ((err as Error)?.name === "StaleSessionError") return;
      cache = prev;
      notifyCacheChange();
      console.warn("Failed to persist new course:", err);
    });

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
  // Only Data Management (or an admin) may write the catalog — any other role would just get a
  // 403 from the server for every legacy row, on every load.
  const role = loadStoredAuth()?.user.role;
  if (role !== "data" && role !== "admin") return;
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

/** Drops everything cached for the current session — called on logout/login (see warmCaches.ts)
 * so the next user on this browser never sees the previous one's data. */
export function clearUniversityCatalogCache() {
  cache = [];
}
