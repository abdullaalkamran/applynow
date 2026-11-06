// Server-backed copy of the student profile sections (see StudentProfileSection in schema.prisma,
// server/src/routes/studentProfile.js). The profile stores (studentProfileDetailsStore, academicProfileStore,
// profileCompletion) used to live only in localStorage, so staff, the AI agent and server jobs couldn't
// see anything a student typed into another browser. Same synchronous-cache pattern as the other migrated
// stores: reads stay synchronous (server cache first, then the old localStorage value, then the seed
// fallback each store already had); every save also goes to the server.
import { apiGet, apiPut, apiPutOnUnload } from "../utils/apiClient";
import { createCoalescedWriter } from "../utils/coalescedWriter";
import { notifyCacheChange, dedupeInFlight } from "../utils/syncCache";

type Sections = Record<string, unknown>;
let cache: Record<string, Sections> = {};
let lastWriteAt = 0;
let migrated = false;

export function getServerSection<T>(studentId: string, section: string): T | undefined {
  return cache[studentId]?.[section] as T | undefined;
}

// Students the server says it can't find (deleted, or not visible to this login) — remembered for a day so a stale local draft
// is not re-sent on every page load only to be answered "Student not found" again. The draft itself is never deleted.
const UNREACHABLE_KEY = "sd-profile-unreachable";
const UNREACHABLE_TTL_MS = 24 * 60 * 60 * 1000;

function readUnreachable(): Record<string, number> {
  if (typeof window === "undefined") return {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(UNREACHABLE_KEY) ?? "{}") as Record<string, number>;
    const now = Date.now();
    return Object.fromEntries(Object.entries(raw).filter(([, at]) => now - at < UNREACHABLE_TTL_MS));
  } catch {
    return {};
  }
}
export function isStudentUnreachable(studentId: string): boolean {
  return studentId in readUnreachable();
}
function markUnreachable(studentId: string) {
  if (typeof window === "undefined") return;
  try { window.localStorage.setItem(UNREACHABLE_KEY, JSON.stringify({ ...readUnreachable(), [studentId]: Date.now() })); } catch { /* storage full/unavailable */ }
}

/** The browser-held draft (see the stores' own keys) for a section — removed once the server has confirmed the same data. */
function removeLocalDraft(studentId: string, section: string) {
  if (typeof window === "undefined") return;
  try {
    if (section === "academic") window.localStorage.removeItem(`sd-academic-levels:${studentId}`);
    else if (section.startsWith("step:")) window.localStorage.removeItem(`sd-profile-step:${studentId}:${section.slice(5)}`);
    else window.localStorage.removeItem(`sd-profile-details:${section}:${studentId}`);
  } catch { /* storage unavailable */ }
}

const SEP = "\u0000";
const split = (key: string): [string, string] => { const i = key.indexOf(SEP); return [key.slice(0, i), key.slice(i + 1)]; };
const pathFor = (studentId: string, section: string) => `/api/student-profile/${encodeURIComponent(studentId)}/${encodeURIComponent(section)}`;

// Saves are coalesced: an unchanged value is never re-sent, rapid edits become one request (~0.8 s after the last), the
// latest value is flushed when the page is hidden or closed, and a failing send is retried a few times, then dropped (the
// value stays in memory and in the local draft) instead of retrying forever.
const writer = createCoalescedWriter<unknown>({
  send: (key, data) => { const [studentId, section] = split(key); return apiPut(pathFor(studentId, section), { data }).then(() => undefined); },
  sendOnUnload: (key, data) => { const [studentId, section] = split(key); apiPutOnUnload(pathFor(studentId, section), { data }); },
  // The local draft was only a safety net until the server had the value — drop it now that it does.
  onSaved: (key) => { const [studentId, section] = split(key); removeLocalDraft(studentId, section); },
  onGiveUp: (key, err) => {
    const [studentId, section] = split(key);
    const status = (err as { status?: number })?.status;
    if (status === 404 && /student not found/i.test((err as Error).message)) { markUnreachable(studentId); return; }
    console.warn(`Failed to save profile section ${section}:`, err);
  },
});

if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => writer.flushOnUnload());
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") writer.flushOnUnload(); });
}

/** Sends anything still waiting (call before a route change that would lose it, or in tests). */
export function flushProfileSaves(): Promise<void> {
  return writer.flushAll();
}

/** Records a save in the cache and sends it to the server. Deliberately doesn't notify subscribers —
 * the saving form already has the value, and a remount mid-edit would drop the user's place. */
export function putServerSection(studentId: string, section: string, data: unknown) {
  lastWriteAt = Date.now();
  cache = { ...cache, [studentId]: { ...cache[studentId], [section]: data } };
  if (isStudentUnreachable(studentId)) return; // the server has told us this student isn't there; keep the value locally
  writer.write(`${studentId}${SEP}${section}`, data);
}

// Pushes anything this browser holds that the server doesn't have yet (data entered before profiles were
// server-backed) — once per session, and never overwrites a section the server already has.
function migrateLocalOnce() {
  if (migrated || typeof window === "undefined") return;
  migrated = true;
  try {
    const ls = window.localStorage;
    for (let i = 0; i < ls.length; i++) {
      const key = ls.key(i) ?? "";
      let studentId: string | undefined;
      let section: string | undefined;
      let value: unknown;
      let m: RegExpMatchArray | null;
      if ((m = key.match(/^sd-profile-details:([^:]+):(.+)$/))) { section = m[1]; studentId = m[2]; }
      else if ((m = key.match(/^sd-academic-levels:(.+)$/))) { section = "academic"; studentId = m[1]; }
      else if ((m = key.match(/^sd-profile-step:([^:]+):(.+)$/))) { studentId = m[1]; section = `step:${m[2]}`; }
      if (!studentId || !section || getServerSection(studentId, section) !== undefined || isStudentUnreachable(studentId)) continue;
      const raw = ls.getItem(key);
      if (raw === null) continue;
      try { value = JSON.parse(raw); } catch { continue; }
      if (section.startsWith("step:") && value !== true) continue;
      putServerSection(studentId, section, value);
    }
  } catch { /* storage unavailable — nothing to migrate */ }
}

export function refreshProfileSections(): Promise<void> {
  return dedupeInFlight("profile-sections", async () => {
    const startedAt = Date.now();
    const next = await apiGet<Record<string, Sections>>("/api/student-profile");
    // A save made while this request was in flight, or one still waiting to be sent, is newer than what the server returned.
    if (lastWriteAt >= startedAt || writer.pending() > 0) return;
    const changed = JSON.stringify(next) !== JSON.stringify(cache);
    cache = next;
    writer.forgetSaved(); // the server may have changed elsewhere; don't skip a later write as "unchanged"
    migrateLocalOnce();
    if (changed) notifyCacheChange();
  });
}

export function clearProfileCache() {
  void writer.flushAll(); // edits made in the last moment still go out before the next login replaces the session
  cache = {};
  migrated = false;
}
