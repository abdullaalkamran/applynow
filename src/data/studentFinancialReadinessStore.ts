// Postgres-backed via /api/financial-readiness (server/src/routes/studentFinancialReadiness.js) —
// one shared record per student, edited from any of their applications' Financial Readiness stage
// (see applicationJourneyStore.ts's updateStage, which both writes here and broadcasts the same
// data to every one of the student's other applications) rather than each application tracking an
// independent copy that could drift out of sync. Same synchronous-cache pattern as every other
// migrated store.
import { apiGet, apiPatch } from "../utils/apiClient";
import { notifyCacheChange, cacheChanged } from "../utils/syncCache";

export interface StudentFinancialReadiness {
  studentId: string;
  evidenceRequired: boolean;
  requiredAmount?: number;
  currency?: string;
  holdingPeriodDays?: number;
  openingDate?: string;
  maturityDate?: string;
  bankStatus: string;
  accountHolder?: string;
  accountType?: string;
  completedAt?: string;
}

let cache: StudentFinancialReadiness[] = [];

/** Every student's Financial Readiness record the caller's account can see — call once after
 * login (see utils/warmCaches.ts), same as every other migrated store. */
export async function refreshFinancialReadiness(): Promise<void> {
  const next = await apiGet<StudentFinancialReadiness[]>("/api/financial-readiness");
  if (!cacheChanged(next, cache)) return;
  cache = next;
  notifyCacheChange();
}

export function loadFinancialReadiness(studentId: string): StudentFinancialReadiness | undefined {
  return cache.find((r) => r.studentId === studentId);
}

export function isFinancialReadinessComplete(studentId: string): boolean {
  return !!loadFinancialReadiness(studentId)?.completedAt;
}

/** Merges a patch into the student's one shared record — called from applicationJourneyStore.ts's
 * updateStage, not directly from UI, so every edit (from whichever application's editor made it)
 * lands here the same way a per-application stage patch always has. */
export function updateFinancialReadiness(studentId: string, patch: Partial<StudentFinancialReadiness>): StudentFinancialReadiness {
  const current = loadFinancialReadiness(studentId);
  const optimistic: StudentFinancialReadiness = {
    studentId,
    evidenceRequired: true,
    bankStatus: "Not Started",
    ...current,
    ...patch,
  };
  cache = current ? cache.map((r) => (r.studentId === studentId ? optimistic : r)) : [...cache, optimistic];
  notifyCacheChange();

  apiPatch<StudentFinancialReadiness>(`/api/financial-readiness/${studentId}`, patch)
    .then((serverRecord) => {
      cache = cache.map((r) => (r.studentId === studentId ? serverRecord : r));
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to persist financial readiness:", err));

  return optimistic;
}
