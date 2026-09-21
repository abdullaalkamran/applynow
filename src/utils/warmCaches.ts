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
import { refreshNextSteps } from "../data/applicationNextStepsStore";
import { refreshDocDueDates } from "../data/documentDueDatesStore";
import { refreshFinancialReadiness } from "../data/studentFinancialReadinessStore";
import { refreshCachedJourneys } from "../data/applicationJourneyStore";
import { refreshCachedActivity } from "../data/applicationActivityStore";
import { refreshInbox } from "../data/inboxStore";
import { refreshCachedStudentComments } from "../data/studentCommentsStore";
import { refreshThreadsList, refreshContacts, refreshCachedMessageThreads } from "../data/messagesStore";
import { refreshSubjectCatalog } from "../data/subjectCatalogStore";
import { refreshCommissionRates } from "../data/commissionRatesStore";
import { clearApplicationsCache } from "../data/applicationsStore";
import { clearTasksCache } from "../data/tasksStore";
import { clearStaffCache } from "../data/staffStore";
import { clearAgentStudentsCache } from "../data/agentStudentsStore";
import { clearCounsellorStudentsCache } from "../data/counsellorStudentsStore";
import { clearAllStudentsCache } from "../data/allStudentsStore";
import { clearCoreDocsCache } from "../data/coreDocsStore";
import { clearApplicationDocsCache } from "../data/applicationDocsStore";
import { clearApplicationNextStepsCache } from "../data/applicationNextStepsStore";
import { clearDocumentDueDatesCache } from "../data/documentDueDatesStore";
import { clearStudentFinancialReadinessCache } from "../data/studentFinancialReadinessStore";
import { clearApplicationJourneyCache } from "../data/applicationJourneyStore";
import { clearApplicationActivityCache } from "../data/applicationActivityStore";
import { clearInboxCache } from "../data/inboxStore";
import { clearStudentCommentsCache } from "../data/studentCommentsStore";
import { clearMessagesCache } from "../data/messagesStore";
import { clearSubjectCatalogCache } from "../data/subjectCatalogStore";
import { clearUniversityCatalogCache } from "../data/universityCatalogStore";
import { clearCommissionRatesCache } from "../data/commissionRatesStore";
import { notifyCacheChange } from "./syncCache";
import { refreshUniversities, migrateLegacyLocalUniversities } from "../data/universityCatalogStore";

export function warmCaches() {
  refreshApplications().catch((err) => console.warn("Failed to warm applications cache:", err));
  refreshTasks().catch((err) => console.warn("Failed to warm tasks cache:", err));
  refreshStaff().catch((err) => console.warn("Failed to warm staff cache:", err));
  refreshAgentStudents().catch((err) => console.warn("Failed to warm agent-students cache:", err));
  refreshAssignedStudents().catch((err) => console.warn("Failed to warm counsellor-students cache:", err));
  refreshAllStudents().catch((err) => console.warn("Failed to warm all-students cache:", err));
  refreshCoreDocs().catch((err) => console.warn("Failed to warm core-docs cache:", err));
  refreshApplicationDocs().catch((err) => console.warn("Failed to warm application-docs cache:", err));
  refreshNextSteps().catch((err) => console.warn("Failed to warm next-steps cache:", err));
  refreshDocDueDates().catch((err) => console.warn("Failed to warm document-due-dates cache:", err));
  refreshFinancialReadiness().catch((err) => console.warn("Failed to warm financial-readiness cache:", err));
  refreshInbox().catch((err) => console.warn("Failed to warm inbox cache:", err));
  refreshCachedStudentComments();
  refreshThreadsList().catch((err) => console.warn("Failed to warm message-threads cache:", err));
  refreshContacts().catch((err) => console.warn("Failed to warm message-contacts cache:", err));
  refreshCachedMessageThreads();
  refreshSubjectCatalog().catch((err) => console.warn("Failed to warm subject-catalog cache:", err));
  refreshCommissionRates().catch((err) => console.warn("Failed to warm commission-rates cache:", err));
  migrateLegacyLocalUniversities()
    .then(() => refreshUniversities())
    .catch((err) => console.warn("Failed to warm/migrate universities cache:", err));
  // Not a bulk fetch like the others — re-fetches whichever applications' journeys this session
  // has actually looked at (see applicationJourneyStore.ts's own comment on why this needs to be
  // on the same poll/focus schedule as everything else).
  refreshCachedJourneys();
  // Same reasoning — a lazily-fetched, per-application cache (see applicationActivityStore.ts).
  refreshCachedActivity();
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

/** Empties every store above — run on logout and again right before a new login warms them, so
 * nothing from the previous session (a different user on a shared browser, or the same user
 * whose permissions changed) can be rendered before the fresh fetches land. */
export function clearAllCaches() {
  clearApplicationsCache();
  clearTasksCache();
  clearStaffCache();
  clearAgentStudentsCache();
  clearCounsellorStudentsCache();
  clearAllStudentsCache();
  clearCoreDocsCache();
  clearApplicationDocsCache();
  clearApplicationNextStepsCache();
  clearDocumentDueDatesCache();
  clearStudentFinancialReadinessCache();
  clearApplicationJourneyCache();
  clearApplicationActivityCache();
  clearInboxCache();
  clearStudentCommentsCache();
  clearMessagesCache();
  clearSubjectCatalogCache();
  clearUniversityCatalogCache();
  clearCommissionRatesCache();
  notifyCacheChange();
}
