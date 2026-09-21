// Postgres-backed via /api/applications/:id/journey (server/src/routes/applications.js), same
// synchronous-cache pattern as applicationsStore.ts. `loadJourney` returns a locally-computed
// fallback (the same Requirement-Engine init logic used before this migration) the first time an
// application is looked at, then swaps in the server's canonical copy once the background fetch
// resolves — the local computation and the server's are built from the same rules, so they agree
// in the overwhelming majority of cases; only genuinely already-edited server-side state can differ.
import type { Role } from "../types";
import { getAllApplications, applyLocalStatusUpdate, refreshApplicationFromServer } from "./applicationsStore";
import { getCountryId } from "./countryRegistry";
import { resolveImmigrationDocType, resolveHoldingPeriodDays } from "./requirementRules";
import { deriveAppStatus, computeNextAction } from "../utils/applicationJourneyEngine";
import { apiGet, apiPatch } from "../utils/apiClient";
import { notifyCacheChange } from "../utils/syncCache";
import {
  loadFinancialReadiness, updateFinancialReadiness, refreshFinancialReadiness, type StudentFinancialReadiness,
} from "./studentFinancialReadinessStore";
import {
  type ApplicationJourney, type StageType, type StageRecord,
  type ApplicationStageStatus, type ApplicationStageData,
  type OfferStageStatus, type OfferStageData,
  type BankStatus, type FinancialReadinessStageData,
  type PaymentStageStatus, type PaymentStageData,
  type InterviewStageStatus, type InterviewStageData,
  type UniversityDocumentStatus, type UniversityDocumentStageData,
  type VisaStageStatus, type VisaStageData,
  type EvisaStageStatus, type EvisaStageData,
  type EnrolmentStageStatus, type EnrolmentStageData,
} from "../types/journey";

const cache: Record<string, ApplicationJourney> = {};

// The status a stage is considered "done" at — used to auto-set completedAt on transition.
const STAGE_TERMINAL_STATUS: Record<StageType, string[]> = {
  application: ["Submitted to University"],
  offer: ["Unconditional"],
  financial_readiness: ["Ready", "Matured"],
  payment: ["Paid"],
  interview: ["Passed", "Not Required"],
  university_document: ["Received"],
  visa: ["Approved"],
  evisa: ["Completed", "Not Required"],
  enrolment: ["Enrolled"],
};

function stage<TStatus extends string, TData>(
  stageType: StageType, applicable: boolean, required: boolean, status: TStatus, data: TData
): StageRecord<TStatus, TData> {
  return { stageType, applicable, required, status, data };
}

/** Builds a fresh journey from the Requirement Engine — used as the instant local value before
 * the server's canonical copy has loaded, and as the request body's implicit shape reference.
 * `studentId` lets Financial Readiness start pre-filled from whatever that student's shared record
 * already has (see studentFinancialReadinessStore.ts) instead of always starting blank — the whole
 * point of it being one shared record is that a second application shouldn't have to redo it. */
export function initializeJourney(
  applicationId: string,
  scope: { countryId?: string; universityId?: string; courseId?: string; studentId?: string }
): ApplicationJourney {
  const docType = resolveImmigrationDocType(scope);
  const holdingPeriodDays = resolveHoldingPeriodDays(scope);
  const sharedFinancialReadiness = scope.studentId ? loadFinancialReadiness(scope.studentId) : undefined;

  const journey: ApplicationJourney = {
    applicationId,
    stages: {
      // Mirrors server/src/journeyLogic.js buildInitialStages: an application only exists once it
      // has been submitted, so the journey's first stage starts at "Submitted to Portal".
      application: stage<ApplicationStageStatus, ApplicationStageData>(
        "application", true, true, "Submitted to Portal", { appliedVia: "Direct University Portal" }
      ),
      offer: stage<OfferStageStatus, OfferStageData>("offer", true, true, "Waiting", {}),
      financial_readiness: sharedFinancialReadiness
        ? {
            stageType: "financial_readiness",
            applicable: true,
            required: true,
            status: sharedFinancialReadiness.bankStatus as BankStatus,
            completedAt: sharedFinancialReadiness.completedAt,
            data: {
              evidenceRequired: sharedFinancialReadiness.evidenceRequired,
              requiredAmount: sharedFinancialReadiness.requiredAmount,
              currency: sharedFinancialReadiness.currency,
              holdingPeriodDays: sharedFinancialReadiness.holdingPeriodDays ?? holdingPeriodDays,
              openingDate: sharedFinancialReadiness.openingDate,
              maturityDate: sharedFinancialReadiness.maturityDate,
              bankStatus: sharedFinancialReadiness.bankStatus as BankStatus,
              bankName: sharedFinancialReadiness.bankName,
              accountHolder: sharedFinancialReadiness.accountHolder as FinancialReadinessStageData["accountHolder"],
              accountType: sharedFinancialReadiness.accountType as FinancialReadinessStageData["accountType"],
              depositType: sharedFinancialReadiness.depositType as FinancialReadinessStageData["depositType"],
            },
          }
        : stage<BankStatus, FinancialReadinessStageData>(
            "financial_readiness", true, true, "Not Started", { evidenceRequired: true, holdingPeriodDays, bankStatus: "Not Started" }
          ),
      payment: stage<PaymentStageStatus, PaymentStageData>("payment", true, true, "Preparing", {}),
      interview: stage<InterviewStageStatus, InterviewStageData>("interview", true, false, "Not Required", {}),
      university_document: stage<UniversityDocumentStatus, UniversityDocumentStageData>(
        "university_document", true, true, "Waiting for Documents",
        { docType, medical: { required: false, tbRequired: false, status: "Not Required" } }
      ),
      visa: stage<VisaStageStatus, VisaStageData>("visa", true, true, "Not Started", { visaRequired: true }),
      evisa: stage<EvisaStageStatus, EvisaStageData>("evisa", false, false, "Not Required", { shareCodeStatus: "Not Required" }),
      enrolment: stage<EnrolmentStageStatus, EnrolmentStageData>("enrolment", true, true, "Not Started", {}),
    },
  };

  cache[applicationId] = journey;
  return journey;
}

/** Background fetch that swaps the local/cached journey for the server's canonical copy. */
function refreshFromServer(applicationId: string) {
  apiGet<ApplicationJourney>(`/api/applications/${applicationId}/journey`)
    .then((journey) => {
      cache[applicationId] = journey;
      notifyCacheChange();
    })
    .catch((err) => console.warn("Failed to load journey from server:", err));
}

/** Reads a journey, synchronously — instant local init (or the last-known cached/server copy) if
 * nothing has loaded from the server yet for this application, with a background fetch kicked off
 * to reconcile with the canonical copy. */
export function loadJourney(applicationId: string): ApplicationJourney {
  if (!cache[applicationId]) {
    const application = getAllApplications().find((a) => a.id === applicationId);
    const countryId = application ? getCountryId(application.country) : undefined;
    initializeJourney(applicationId, { countryId, studentId: application?.studentId });
    refreshFromServer(applicationId);
  }
  return cache[applicationId];
}

/** Unlike every other migrated store, a journey is fetched lazily (per applicationId, the first
 * time something actually looks at it) rather than warmed in bulk — so it was never part of
 * warmCaches.ts's periodic poll either, and once cached it stayed exactly as of that first fetch
 * for the rest of the browser session. That's fine for an application only one account ever edits,
 * but Financial Readiness is shared across a student's whole caseload and edited from a counsellor
 * or student session that's completely separate from whoever else has it open — without this, a
 * student who'd already viewed their application before a counsellor's edit would keep seeing the
 * stale pre-edit copy indefinitely, no matter how long they waited or how many times they
 * navigated around (there was nothing to ever trigger a re-fetch). Called from warmCaches.ts on
 * the same interval/focus schedule as everything else, this re-fetches every journey this session
 * has ever looked at, so it converges the same way the rest of the app's data already does. */
export function refreshCachedJourneys(): void {
  Object.keys(cache).forEach((applicationId) => refreshFromServer(applicationId));
}

/** Merges a patch into one stage's data, auto-stamping startedAt/completedAt off the new status,
 * and deriving+applying the resulting flat AppStatus — mirrors the pre-migration behavior exactly,
 * just against the cache instead of localStorage. The real persistence (and the server-side
 * notification dispatch and stage_updated activity row that come with it) happens via the
 * background PATCH; the local update is what makes the UI feel instant. `actor`/`token` are
 * accepted for call-site compatibility but no longer used client-side. */
export function updateStage<TData>(
  applicationId: string,
  stageType: StageType,
  patch: Partial<TData> & { status?: string; blocked?: boolean; blockedReason?: string },
  _actor: { id: string; role: Role; name: string },
  _token?: string
): ApplicationJourney {
  const journey = loadJourney(applicationId);
  const current = journey.stages[stageType];
  const nextData = { ...(current?.data ?? {}), ...patch };
  const { status: nextStatus, blocked, blockedReason, ...dataOnly } = nextData as Record<string, unknown>;

  const updated: StageRecord<string, unknown> = {
    stageType,
    applicable: current?.applicable ?? true,
    required: current?.required ?? true,
    status: (nextStatus as string) ?? current?.status ?? "",
    startedAt: current?.startedAt ?? new Date().toISOString(),
    completedAt: current?.completedAt,
    blocked: (blocked as boolean) ?? current?.blocked,
    blockedReason: (blockedReason as string) ?? current?.blockedReason,
    data: dataOnly,
  };

  if (nextStatus && STAGE_TERMINAL_STATUS[stageType]?.includes(nextStatus as string) && !updated.completedAt) {
    updated.completedAt = new Date().toISOString();
  }

  const nextJourney: ApplicationJourney = { ...journey, stages: { ...journey.stages, [stageType]: updated } };
  cache[applicationId] = nextJourney;
  notifyCacheChange();

  const derivedStatus = deriveAppStatus(nextJourney);
  const derivedNextAction = computeNextAction(nextJourney)?.title ?? "Every stage of the journey is complete.";
  applyLocalStatusUpdate(applicationId, derivedStatus, derivedNextAction);

  apiPatch<ApplicationJourney>(`/api/applications/${applicationId}/journey/${stageType}`, patch)
    .then((serverJourney) => {
      cache[applicationId] = serverJourney;
      notifyCacheChange();
      void refreshApplicationFromServer(applicationId);

      // Financial Readiness is one shared record per student (see
      // studentFinancialReadinessStore.ts) — the server (server/src/routes/applications.js) has
      // already persisted it and broadcast the same stage record to every one of this student's
      // other applications in this same request, so there's nothing left to compute here. Just
      // refetch each of them (and the shared record itself) so this client's own view catches up
      // right away instead of waiting on the next visit/poll. Doing the fan-out server-side
      // instead of replicating it in every client is what makes it actually reliable — a client-
      // only version of this used to silently fail to reach the shared record or a sibling
      // application whenever the PATCH for that specific one didn't land.
      if (stageType === "financial_readiness") {
        void refreshFinancialReadiness();
        const studentId = getAllApplications().find((a) => a.id === applicationId)?.studentId;
        getAllApplications()
          .filter((a) => a.studentId === studentId && a.id !== applicationId)
          .forEach((sibling) => {
            refreshFromServer(sibling.id);
            void refreshApplicationFromServer(sibling.id);
          });
      }
    })
    .catch((err) => console.warn("Failed to persist journey stage update:", err));

  return nextJourney;
}

/** Lets Financial Readiness be edited from a place that isn't tied to any one application — the
 * student's own Dashboard, in particular, since it's now one shared record per student (see
 * studentFinancialReadinessStore.ts) rather than something that lives inside a specific
 * application's journey. Reuses updateStage against the student's first application so the exact
 * same persist-and-broadcast-to-every-application behavior applies regardless of which door the
 * edit came through; falls back to writing the shared record directly when the student doesn't
 * have an application yet to broadcast to (there's nothing to sync until one exists — it'll pick
 * up this data automatically via initializeJourney's own seeding the moment one is created). */
export function updateFinancialReadinessForStudent(
  studentId: string,
  patch: Partial<FinancialReadinessStageData> & { status?: string },
  actor: { id: string; role: Role; name: string }
): void {
  const firstApplication = getAllApplications().find((a) => a.studentId === studentId);
  if (firstApplication) {
    updateStage(firstApplication.id, "financial_readiness", patch, actor);
    return;
  }
  updateFinancialReadiness(studentId, patch as unknown as Partial<StudentFinancialReadiness>);
}

/** Drops everything cached for the current session — called on logout/login (see warmCaches.ts)
 * so the next user on this browser never sees the previous one's data. */
export function clearApplicationJourneyCache() {
  for (const key of Object.keys(cache)) delete cache[key];
}
