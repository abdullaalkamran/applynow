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
import { recordActivity } from "./applicationActivityStore";
import { deriveAppStatus, computeNextAction } from "../utils/applicationJourneyEngine";
import { apiGet, apiPatch } from "../utils/apiClient";
import { notifyCacheChange } from "../utils/syncCache";
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
 * the server's canonical copy has loaded, and as the request body's implicit shape reference. */
export function initializeJourney(
  applicationId: string,
  scope: { countryId?: string; universityId?: string; courseId?: string }
): ApplicationJourney {
  const docType = resolveImmigrationDocType(scope);
  const holdingPeriodDays = resolveHoldingPeriodDays(scope);

  const journey: ApplicationJourney = {
    applicationId,
    stages: {
      application: stage<ApplicationStageStatus, ApplicationStageData>(
        "application", true, true, "Incomplete Profile", { appliedVia: "Direct University Portal" }
      ),
      offer: stage<OfferStageStatus, OfferStageData>("offer", true, true, "Waiting", {}),
      financial_readiness: stage<BankStatus, FinancialReadinessStageData>(
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
    initializeJourney(applicationId, { countryId });
    refreshFromServer(applicationId);
  }
  return cache[applicationId];
}

/** Merges a patch into one stage's data, auto-stamping startedAt/completedAt off the new status,
 * recording an activity event, and deriving+applying the resulting flat AppStatus — mirrors the
 * pre-migration behavior exactly, just against the cache instead of localStorage. The real
 * persistence (and the server-side notification dispatch that comes with it) happens via the
 * background PATCH; the local update is what makes the UI feel instant. */
export function updateStage<TData>(
  applicationId: string,
  stageType: StageType,
  patch: Partial<TData> & { status?: string; blocked?: boolean; blockedReason?: string },
  actor: { id: string; role: Role; name: string },
  _token?: string
): ApplicationJourney {
  const journey = loadJourney(applicationId);
  const current = journey.stages[stageType];
  const oldStatus = current?.status;
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

  recordActivity({
    applicationId,
    stageType,
    action: "stage_updated",
    oldValue: oldStatus,
    newValue: updated.status,
    performedBy: actor,
  });

  const derivedStatus = deriveAppStatus(nextJourney);
  const derivedNextAction = computeNextAction(nextJourney)?.title ?? "Every stage of the journey is complete.";
  applyLocalStatusUpdate(applicationId, derivedStatus, derivedNextAction);

  apiPatch<ApplicationJourney>(`/api/applications/${applicationId}/journey/${stageType}`, patch)
    .then((serverJourney) => {
      cache[applicationId] = serverJourney;
      notifyCacheChange();
      void refreshApplicationFromServer(applicationId);
    })
    .catch((err) => console.warn("Failed to persist journey stage update:", err));

  return nextJourney;
}
