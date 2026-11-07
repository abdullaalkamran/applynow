// Postgres-backed via /api/universities (server/src/routes/universities.js) — the real partner-
// university catalog, shared across every account instead of living only in the browser that
// created it. Same synchronous-cache pattern as applicationsStore.ts: reads stay synchronous (the
// dozens of existing call sites — student/agent/counsellor browse pages, the AI tool registry,
// universityFilter.ts — never need to change), backed by a cache warmed after login and kept
// current after every write.
import { loadStoredAuth } from "../utils/authClient";
import { apiGet, apiPost, apiPatch, apiDelete, apiGetList } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged, dedupeInFlight } from "../utils/syncCache";
import { getCountryId } from "./countryRegistry";
import type { University } from "../types";
import { reportSaveError } from "../utils/toast";

type Course = University["courses"][number];

let cache: University[] = [];
let refreshSeq = 0;

// The catalog loads in two sizes. By default only the SUMMARY (every university, no courses — a few KB) is held, which is all
// the Explore page needs because it searches on the server (see catalogSearchApi.ts). The FULL catalog (every course — tens of
// MB) is downloaded only when something actually asks for courses: getAllUniversities() / getUniversityById() are that ask,
// getUniversitySummaries() is not. Until the full catalog lands, summary entries carry `courses: []` and `coursesLoaded: false`.
let fullRequested = false;
let fullLoaded = false;
// Why the last load failed ("" when it didn't) — lets a screen say so, and offer a retry, instead of sitting empty. A failed
// full-catalog load is not retried for FULL_RETRY_MS, so a slow server isn't hit again on every re-render.
let loadError = "";
let lastFullFailureAt = 0;
const FULL_RETRY_MS = 30_000;
const messageOf = (err: unknown) => (err instanceof Error && err.message ? err.message : "The server didn't answer — please try again.");

/** The reason the last university load failed, or "" when there is no problem. */
export function getUniversitiesLoadError(): string {
  return loadError;
}

/** How many courses a university has — from the summary's count while its courses haven't been downloaded yet (they are an empty
 * list until then, which would otherwise read as "0 courses"), from the list itself once they have. */
export function courseCountOf(u: Pick<University, "courses" | "coursesLoaded" | "courseCount">): number {
  return u.coursesLoaded === false ? u.courseCount ?? 0 : (u.courses ?? []).length;
}

function loadFull(): Promise<void> {
  return dedupeInFlight("universities-full", async () => {
    const seq = ++refreshSeq;
    const next = await apiGetList<University>("/api/universities");
    // A slower, older response landing after a newer one must not win.
    if (seq !== refreshSeq) return;
    fullLoaded = true;
    loadError = "";
    if (!cacheChanged(next, cache)) return;
    cache = next;
    notifyCacheChange();
  });
}

function loadSummary(): Promise<void> {
  return dedupeInFlight("universities-summary", async () => {
    const seq = ++refreshSeq;
    let summary: University[];
    try {
      summary = await apiGetList<University>("/api/universities/summary");
    } catch (err) {
      if ((err as Error)?.name !== "StaleSessionError" && cache.length === 0) { loadError = messageOf(err); notifyCacheChange(); }
      throw err;
    }
    if (seq !== refreshSeq || fullLoaded) return; // the full catalog already covers this
    loadError = "";
    if (!cacheChanged(summary, cache)) return;
    cache = summary;
    notifyCacheChange();
  });
}

/** Called after login and on the slow refresh: keeps whichever size has been asked for current. */
export function refreshUniversities(): Promise<void> {
  return fullRequested ? loadFull() : loadSummary();
}

/** Asks for the full catalog (idempotent). Everything that reads courses calls this, directly or via getAllUniversities(). */
export function ensureFullCatalog(): Promise<void> {
  if (fullLoaded) return Promise.resolve();
  if (!fullRequested) {
    fullRequested = true;
    return loadFull().catch((err) => {
      fullRequested = false;
      if ((err as Error)?.name === "StaleSessionError") return;
      lastFullFailureAt = Date.now();
      loadError = messageOf(err);
      console.warn("Failed to load the full catalog:", err);
      notifyCacheChange();
    });
  }
  return loadFull();
}

/** Every university WITH its courses. Starts the full download the first time it is called; callers are re-rendered when it
 * arrives (until then they see summary entries with no courses). */
export function getAllUniversities(): University[] {
  if (!fullRequested && cache.length > 0 && Date.now() - lastFullFailureAt > FULL_RETRY_MS) void ensureFullCatalog();
  return Array.isArray(cache) ? cache : [];
}

/** "Try again" after a failed load: forgets the failure and loads again straight away. */
export function retryUniversities(): Promise<void> {
  lastFullFailureAt = 0;
  loadError = "";
  notifyCacheChange();
  return cache.length > 0 ? ensureFullCatalog() : loadSummary().catch(() => undefined);
}

/** Every university without needing its courses — never starts the full download. */
export function getUniversitySummaries(): University[] {
  return Array.isArray(cache) ? cache : [];
}

export function getUniversityById(id: string): University | undefined {
  if (!fullRequested && cache.length > 0 && Date.now() - lastFullFailureAt > FULL_RETRY_MS) void ensureFullCatalog();
  return cache.find((u) => u.id === id);
}

/** One university by id for a page that fetches its own record (useUniversity) — no full download. */
export function peekUniversityById(id: string): University | undefined {
  return cache.find((u) => u.id === id);
}

/** Fetches one university's full record (with courses) and swaps it into the cache — used when its page opens while only
 * the fast summary is loaded. */
export async function hydrateUniversity(id: string): Promise<void> {
  const full = await apiGet<University>(`/api/universities/${encodeURIComponent(id)}`);
  cache = cache.map((u) => (u.id === id && u.coursesLoaded === false ? full : u));
  notifyCacheChange();
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
        reportSaveError("Failed to persist new university:", err);
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
        reportSaveError("Failed to persist university update:", err);
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
      reportSaveError("Failed to delete university:", err);
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
      reportSaveError("Failed to persist new course:", err);
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
    reportSaveError("Failed to persist course update:", err)
  );
}

export function removeCourse(universityId: string, courseId: string) {
  cache = cache.map((u) => (u.id === universityId ? { ...u, courses: u.courses.filter((c) => c.id !== courseId) } : u));
  notifyCacheChange();
  apiDelete(`/api/universities/${universityId}/courses/${courseId}`).catch((err) =>
    reportSaveError("Failed to delete course:", err)
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
  fullLoaded = false;
  fullRequested = false;
  loadError = "";
  lastFullFailureAt = 0;
}
