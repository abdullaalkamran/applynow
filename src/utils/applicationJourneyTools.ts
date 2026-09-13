// Pure read functions over the journey/requirement/document/activity stores — shared by both the
// AI tool registries (student + counsellor) and, later, the ApplicationJourneyPanel UI, so
// "what the AI says" and "what the human sees" are always the exact same computation, never two
// implementations that can quietly drift apart.
import { getAllApplications } from "../data/applicationsStore";
import { loadJourney } from "../data/applicationJourneyStore";
import { loadActivityDescending } from "../data/applicationActivityStore";
import { computeBlockers, computeNextAction, computeCurrentStage } from "./applicationJourneyEngine";
import { getCountryId } from "../data/countryRegistry";
import { getApplicableRules } from "../data/requirementRules";
import { loadStageDocuments, getMissingDocuments as getMissingStageDocuments } from "../data/documentsStore";
import { STAGE_LABEL, STAGE_ORDER, type StageType, type ApplicationJourney } from "../types/journey";
import type { Application } from "../types";

function findApplication(applicationId: string): Application | { error: string } {
  const application = getAllApplications().find((a) => a.id === applicationId);
  return application ?? { error: `No application with id "${applicationId}".` };
}

function isError<T>(value: T | { error: string }): value is { error: string } {
  return typeof value === "object" && value !== null && "error" in value;
}

/** The compact snapshot an AI turn should read first — never the raw journey record. */
export function getApplicationSummary(applicationId: string) {
  const application = findApplication(applicationId);
  if (isError(application)) return application;

  const journey = loadJourney(applicationId);
  const currentStage = computeCurrentStage(journey);
  const blockers = computeBlockers(journey);
  const nextAction = computeNextAction(journey);

  return {
    application_id: application.id,
    student_id: application.studentId,
    academic: { university: application.university, course: application.course, intake: application.intake, country: application.country },
    journey: {
      current_stage: currentStage ? STAGE_LABEL[currentStage] : "Complete",
      current_status: currentStage ? journey.stages[currentStage]?.status ?? null : null,
    },
    progress: application.progress,
    blockers: blockers.map((b) => ({ stage: STAGE_LABEL[b.stageType], description: b.description, severity: b.severity })),
    next_action: nextAction ? { title: nextAction.title, owner: nextAction.owner.role, stage: STAGE_LABEL[nextAction.stageType] } : null,
  };
}

export function getApplicationStage(applicationId: string, stageType: StageType) {
  const application = findApplication(applicationId);
  if (isError(application)) return application;
  const journey = loadJourney(applicationId);
  const record = journey.stages[stageType];
  if (!record) return { error: `Stage "${stageType}" has no record yet for this application.` };
  return record;
}

export function getApplicationTimeline(applicationId: string, limit = 20) {
  const application = findApplication(applicationId);
  if (isError(application)) return application;
  return loadActivityDescending(applicationId).slice(0, limit);
}

/** The data-driven requirement checklist — every applicable rule for this application's country,
 * cross-referenced with real document status, never a guess. */
export function getApplicationRequirements(applicationId: string) {
  const application = findApplication(applicationId);
  if (isError(application)) return application;

  const scope = { countryId: getCountryId(application.country) };
  const docs = loadStageDocuments(applicationId);

  return getApplicableRules(scope).map((rule) => {
    if (rule.requirementType !== "document") {
      return { name: rule.name, stage: STAGE_LABEL[rule.stageType], required: rule.isRequired, status: "Not Applicable" as const, configuration: rule.configuration };
    }
    const doc = docs.find((d) => d.documentType === rule.name);
    return { name: rule.name, stage: STAGE_LABEL[rule.stageType], required: rule.isRequired, status: doc?.status ?? (rule.isRequired ? "Missing" : "Not Required") };
  });
}

export function getMissingDocuments(applicationId: string, stageType?: StageType) {
  const application = findApplication(applicationId);
  if (isError(application)) return application;
  return getMissingStageDocuments(applicationId, stageType).map((d) => ({ ...d, stageLabel: STAGE_LABEL[d.stageType] }));
}

export function getDocumentStatus(applicationId: string, documentId: string) {
  const application = findApplication(applicationId);
  if (isError(application)) return application;
  const doc = loadStageDocuments(applicationId).find((d) => d.id === documentId);
  return doc ?? { error: `No document with id "${documentId}" on this application.` };
}

export function getNextAction(applicationId: string) {
  const application = findApplication(applicationId);
  if (isError(application)) return application;
  const journey = loadJourney(applicationId);
  const action = computeNextAction(journey);
  if (!action) return { message: "No open next action — every applicable stage is complete." };
  return { title: action.title, owner: action.owner, stage: STAGE_LABEL[action.stageType] };
}

export function getBlockers(applicationId: string) {
  const application = findApplication(applicationId);
  if (isError(application)) return application;
  const journey = loadJourney(applicationId);
  return computeBlockers(journey).map((b) => ({ stage: STAGE_LABEL[b.stageType], description: b.description, severity: b.severity, responsibleParty: b.responsibleParty.role }));
}

// Which fields on each stage's data are actual deadlines — data-driven so a new deadline field is
// a table edit, not new per-stage logic.
const DEADLINE_FIELDS: Partial<Record<StageType, string[]>> = {
  offer: ["offerExpiryDate", "depositDeadline"],
  financial_readiness: ["maturityDate"],
  university_document: ["expiryDate"],
  visa: ["appointmentDate", "submissionDate"],
  enrolment: ["enrolmentDeadline", "classStartDate"],
};

export function getDeadlines(applicationId: string) {
  const application = findApplication(applicationId);
  if (isError(application)) return application;
  const journey = loadJourney(applicationId);

  const deadlines: { stage: string; field: string; date: string }[] = [];
  for (const stageType of STAGE_ORDER) {
    const record = journey.stages[stageType];
    if (!record?.applicable) continue;
    const fields = DEADLINE_FIELDS[stageType] ?? [];
    for (const field of fields) {
      const value = (record.data as Record<string, unknown>)[field];
      if (typeof value === "string" && value) deadlines.push({ stage: STAGE_LABEL[stageType], field, date: value });
    }
  }
  return deadlines;
}

/** One factory backing all eight get_*_status tools instead of eight hand-written duplicates. */
export function stageStatus(applicationId: string, stageType: StageType) {
  return getApplicationStage(applicationId, stageType);
}

export type { ApplicationJourney };
