// Server-backed copy of the student profile sections (see StudentProfileSection in schema.prisma,
// server/src/routes/studentProfile.js). The profile stores (studentProfileDetailsStore, academicProfileStore,
// profileCompletion) used to live only in localStorage, so staff, the AI agent and server jobs couldn't
// see anything a student typed into another browser. Same synchronous-cache pattern as the other migrated
// stores: reads stay synchronous (server cache first, then the old localStorage value, then the seed
// fallback each store already had); every save also goes to the server.
import { apiGet, apiPut } from "../utils/apiClient";
import { notifyCacheChange, dedupeInFlight } from "../utils/syncCache";

type Sections = Record<string, unknown>;
let cache: Record<string, Sections> = {};
let lastWriteAt = 0;
let migrated = false;

export function getServerSection<T>(studentId: string, section: string): T | undefined {
  return cache[studentId]?.[section] as T | undefined;
}

/** Records a save in the cache and sends it to the server. Deliberately doesn't notify subscribers —
 * the saving form already has the value, and a remount mid-edit would drop the user's place. */
export function putServerSection(studentId: string, section: string, data: unknown) {
  lastWriteAt = Date.now();
  cache = { ...cache, [studentId]: { ...cache[studentId], [section]: data } };
  apiPut(`/api/student-profile/${encodeURIComponent(studentId)}/${encodeURIComponent(section)}`, { data })
    .catch((err) => {
      if ((err as Error)?.name !== "StaleSessionError") console.warn(`Failed to save profile section ${section}:`, err);
    });
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
      if (!studentId || !section || getServerSection(studentId, section) !== undefined) continue;
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
    // A save made while this request was in flight is newer than what the server returned.
    if (lastWriteAt >= startedAt) return;
    const changed = JSON.stringify(next) !== JSON.stringify(cache);
    cache = next;
    migrateLocalOnce();
    if (changed) notifyCacheChange();
  });
}

export function clearProfileCache() {
  cache = {};
  migrated = false;
}
