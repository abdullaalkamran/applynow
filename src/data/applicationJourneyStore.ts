// One structured, 9-stage journey record per application — the heart of this feature. Same
// localStorage convention as every other store here. `loadJourney` lazily initializes a journey
// from the Requirement Engine the first time an existing (seeded or created) application is looked
// at, so nothing needs a separate manual "provisioning" pass across the seed data.
import type { Role } from "../types";
import { getAllApplications, updateApplicationStatus } from "./applicationsStore";
import { getCountryId } from "./countryRegistry";
import { resolveImmigrationDocType, resolveHoldingPeriodDays } from "./requirementRules";
import { recordActivity } from "./applicationActivityStore";
// deriveAppStatus/computeNextAction are pure functions over an already-built ApplicationJourney —
// safe to import here since applicationJourneyEngine.ts no longer imports anything back from this
// file (currentStageOf lives there now), so there's no import cycle between store and engine.
import { deriveAppStatus, computeNextAction } from "../utils/applicationJourneyEngine";
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

const STORAGE_PREFIX = "sd-application-journey:";

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

function readRaw(applicationId: string): ApplicationJourney | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + applicationId);
    return raw ? (JSON.parse(raw) as ApplicationJourney) : null;
  } catch {
    return null;
  }
}

function persist(journey: ApplicationJourney) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + journey.applicationId, JSON.stringify(journey));
}

function stage<TStatus extends string, TData>(
  stageType: StageType, applicable: boolean, required: boolean, status: TStatus, data: TData
): StageRecord<TStatus, TData> {
  return { stageType, applicable, required, status, data };
}

/** Builds a fresh journey from the Requirement Engine — the country resolves which immigration
 * document type and financial holding period apply, so nothing here is a hardcoded per-country
 * branch. */
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

  persist(journey);
  return journey;
}

/** Reads a journey, lazily initializing one from the real application's country if none exists yet
 * — so every seeded/created application has a coherent journey without a separate migration step. */
export function loadJourney(applicationId: string): ApplicationJourney {
  const existing = readRaw(applicationId);
  if (existing) return existing;

  const application = getAllApplications().find((a) => a.id === applicationId);
  const countryId = application ? getCountryId(application.country) : undefined;
  return initializeJourney(applicationId, { countryId });
}

/** Merges a patch into one stage's data, auto-stamping startedAt/completedAt off the new status,
 * and recording an activity event — every stage write goes through here so "status changes
 * automatically create dates and audit events" happens once, not at every call site. */
export function updateStage<TData>(
  applicationId: string,
  stageType: StageType,
  patch: Partial<TData> & { status?: string; blocked?: boolean; blockedReason?: string },
  actor: { id: string; role: Role; name: string }
): ApplicationJourney {
  const journey = loadJourney(applicationId);
  const current = journey.stages[stageType];
  const oldStatus = current?.status;
  const nextData = { ...(current?.data ?? {}), ...patch };
  // status/blocked/blockedReason live on the record itself, not inside `data` — strip them back out.
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
  persist(nextJourney);

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
  updateApplicationStatus(applicationId, derivedStatus, derivedNextAction, actor);

  return nextJourney;
}
