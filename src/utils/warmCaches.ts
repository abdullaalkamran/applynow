// Kicks off the initial fetch for every Postgres-backed store's in-memory cache — called once a
// valid JWT is known to exist (see AuthContext.tsx), since a fetch fired before login would just
// fail with 401. Each store's own cache stays synchronous for readers; this only starts the
// background load that fills it in.
import { refreshApplications } from "../data/applicationsStore";
import { refreshTasks } from "../data/tasksStore";
import { refreshStaff } from "../data/staffStore";
import { refreshAgentStudents } from "../data/agentStudentsStore";
import { refreshAssignedStudents } from "../data/counsellorStudentsStore";
import { refreshAllStudents } from "../data/allStudentsStore";
import { refreshCoreDocs } from "../data/coreDocsStore";
import { refreshApplicationDocs } from "../data/applicationDocsStore";

export function warmCaches() {
  refreshApplications().catch((err) => console.warn("Failed to warm applications cache:", err));
  refreshTasks().catch((err) => console.warn("Failed to warm tasks cache:", err));
  refreshStaff().catch((err) => console.warn("Failed to warm staff cache:", err));
  refreshAgentStudents().catch((err) => console.warn("Failed to warm agent-students cache:", err));
  refreshAssignedStudents().catch((err) => console.warn("Failed to warm counsellor-students cache:", err));
  refreshAllStudents().catch((err) => console.warn("Failed to warm all-students cache:", err));
  refreshCoreDocs().catch((err) => console.warn("Failed to warm core-docs cache:", err));
  refreshApplicationDocs().catch((err) => console.warn("Failed to warm application-docs cache:", err));
}

// Closes the "I have to refresh to see what someone else changed" gap: without this, every store
// above only ever re-fetches once, right after login (or after this session's own writes) — a
// change made from a different account/browser just sits invisible until the next full page
// reload. Each refreshX() only calls notifyCacheChange() when the fetched data actually differs
// from the cache (see syncCache.ts's cacheChanged), so a poll that finds nothing new is a no-op —
// it does NOT force the remount useCacheSync's doc comment describes, so open pages don't reset
// their scroll/expanded state/in-progress edits every tick for no reason.
const POLL_INTERVAL_MS = 12_000;
let pollHandle: ReturnType<typeof setInterval> | null = null;

function handleVisibilityChange() {
  if (document.visibilityState === "visible") warmCaches();
}

/** Called once after login (see AuthContext.tsx) — re-warms every cache on an interval, plus
 * immediately whenever the tab regains focus (catching up right away instead of waiting out
 * whatever's left of the interval, since that's the moment a user actually looks again). */
export function startCachePolling() {
  if (pollHandle || typeof window === "undefined") return;
  pollHandle = setInterval(() => {
    if (document.visibilityState === "visible") warmCaches();
  }, POLL_INTERVAL_MS);
  document.addEventListener("visibilitychange", handleVisibilityChange);
}

/** Called on logout — there's nothing to keep polling for once the session's gone. */
export function stopCachePolling() {
  if (pollHandle) {
    clearInterval(pollHandle);
    pollHandle = null;
  }
  document.removeEventListener("visibilitychange", handleVisibilityChange);
}
