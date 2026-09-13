// Blockers and Next Action are always computed from the journey, never stored — "the application
// should have one calculated primary next action at any moment." Keeping this derivation in one
// place means the AI's answer and the UI's own display can never quietly disagree.
import { STAGE_ORDER, STAGE_LABEL, type ApplicationJourney, type StageType, type StageOwner } from "../types/journey";
import { getMissingDocuments } from "../data/documentsStore";
import type { AppStatus } from "../types";

// A conditional stage (Interview "if required", E-Visa "if applicable") defaults to a status that
// means "doesn't apply here" — but nobody necessarily ever touches it to formally complete it, so
// without this it would permanently block every later stage from ever being reached. These
// statuses count as "not blocking" even with no completedAt timestamp.
const NON_BLOCKING_STATUS: Partial<Record<StageType, string[]>> = {
  interview: ["Not Required"],
  evisa: ["Not Required"],
};

// Lives here (not in applicationJourneyStore.ts) specifically so this file never needs to import
// anything back from the store — deriveAppStatus below needs to run *from* the store's updateStage,
// and a store->engine->store cycle is exactly what would otherwise result.
export function currentStageOf(journey: ApplicationJourney): StageType | null {
  for (const stageType of STAGE_ORDER) {
    const record = journey.stages[stageType];
    if (!record?.applicable) continue;
    if (record.completedAt) continue;
    if (NON_BLOCKING_STATUS[stageType]?.includes(record.status)) continue;
    return stageType;
  }
  return null;
}

export interface JourneyBlocker {
  stageType: StageType;
  description: string;
  severity: "low" | "medium" | "high";
  responsibleParty: StageOwner;
}

export interface JourneyNextAction {
  title: string;
  owner: StageOwner;
  stageType: StageType;
  dueDate?: string;
}

// Statuses that mean "stuck," per stage — data-driven so adding a new problem status is a table
// edit, not a new branch of logic.
const PROBLEM_STATUSES: Partial<Record<StageType, string[]>> = {
  application: ["On Hold", "Rejected"],
  offer: ["Document Missing", "On Hold", "Rejected"],
  payment: ["Failed"],
  university_document: ["Rejected"],
  visa: ["Additional Documents Required", "Rejected", "Withdrawn"],
};

const DEFAULT_NEXT_ACTION: Record<StageType, { title: string; role: StageOwner["role"] }> = {
  application: { title: "Complete and submit the application", role: "Student" },
  offer: { title: "Awaiting the university's offer decision", role: "University" },
  financial_readiness: { title: "Open/maintain the required bank balance", role: "Student" },
  payment: { title: "Pay the required tuition/deposit", role: "Student" },
  interview: { title: "Schedule the interview", role: "Counsellor" },
  university_document: { title: "Request the immigration document from the university", role: "Counsellor" },
  visa: { title: "Submit the visa application", role: "Student" },
  evisa: { title: "Generate the e-visa share code", role: "Student" },
  enrolment: { title: "Confirm enrolment with the university", role: "Student" },
};

export function computeBlockers(journey: ApplicationJourney): JourneyBlocker[] {
  const blockers: JourneyBlocker[] = [];

  for (const stageType of STAGE_ORDER) {
    const record = journey.stages[stageType];
    if (!record?.applicable) continue;

    if (record.blocked) {
      blockers.push({
        stageType,
        description: record.blockedReason || `${STAGE_LABEL[stageType]} is blocked.`,
        severity: "high",
        responsibleParty: { role: "Other" },
      });
    } else if (PROBLEM_STATUSES[stageType]?.includes(record.status)) {
      blockers.push({
        stageType,
        description: `${STAGE_LABEL[stageType]} status is "${record.status}".`,
        severity: "medium",
        responsibleParty: { role: "Counsellor" },
      });
    }

    const missingDocs = getMissingDocuments(journey.applicationId, stageType);
    for (const doc of missingDocs) {
      blockers.push({
        stageType,
        description: `${doc.documentType} is ${doc.status === "Rejected" ? "rejected" : "missing"}.`,
        severity: doc.status === "Rejected" ? "high" : "medium",
        responsibleParty: { role: "Student" },
      });
    }
  }

  return blockers;
}

export function computeNextAction(journey: ApplicationJourney): JourneyNextAction | null {
  const stageType = currentStageOf(journey);
  if (!stageType) return null;

  const blockers = computeBlockers(journey).filter((b) => b.stageType === stageType);
  if (blockers.length > 0) {
    return { title: `Resolve: ${blockers[0].description}`, owner: blockers[0].responsibleParty, stageType };
  }

  const fallback = DEFAULT_NEXT_ACTION[stageType];
  return { title: fallback.title, owner: { role: fallback.role }, stageType };
}

// Maps the journey's real current stage+status onto the old flat AppStatus enum that the rest of
// the app (Applications list, VisaCompliance, dashboards, notifications) still reads everywhere.
// There is no perfect 1:1 mapping — AppStatus predates this 9-stage model and is coarser — but a
// best-effort "closest analog" per stage+status is far better than two independently-editable
// status fields that a counsellor has to keep in sync by hand. This is a data table, not a branch
// of if/else per status, so refining a mapping later is a table edit.
const STAGE_STATUS_TO_APP_STATUS: Partial<Record<StageType, Record<string, AppStatus>>> = {
  application: {
    "Incomplete Profile": "Profile Incomplete",
    "Waiting for Documents": "Documents Pending",
    "Documents Ready": "Ready to Submit",
    "Submitted to Portal": "Submitted",
    "Submitted to University": "University Review",
    "Payment Required": "Deposit Pending",
    "Interview Required": "Eligibility Review",
    "On Hold": "Compliance Hold",
    "Rejected": "Rejected",
  },
  offer: {
    Waiting: "University Review",
    Conditional: "Offer Conditions Pending",
    Unconditional: "Offer Received",
    "Document Missing": "Additional Documents Requested",
    "On Hold": "Compliance Hold",
    Rejected: "Rejected",
  },
  financial_readiness: {
    "Not Required": "Deposit Pending",
    "Not Started": "Deposit Pending",
    Preparing: "Deposit Pending",
    Maintaining: "Deposit Pending",
    Matured: "Deposit Paid",
    Ready: "Deposit Paid",
    Expired: "Deposit Pending",
  },
  payment: {
    Preparing: "Deposit Pending",
    "Not Yet Paid": "Deposit Pending",
    "Waiting for Confirmation": "Deposit Pending",
    Paid: "Deposit Paid",
    Failed: "Deposit Pending",
    Refunded: "Deposit Pending",
  },
  interview: {
    "Not Required": "Eligibility Review",
    Preparing: "Eligibility Review",
    Scheduled: "Eligibility Review",
    Completed: "Eligibility Review",
    "Waiting for Result": "Eligibility Review",
    Passed: "Eligibility Review",
    Failed: "Rejected",
  },
  university_document: {
    "Waiting for Documents": "CAS/COE Pending",
    "Documents Received": "CAS/COE Pending",
    "Waiting for Payment": "CAS/COE Pending",
    "Waiting for Interview": "CAS/COE Pending",
    "Form Filling": "CAS/COE Pending",
    Processing: "CAS/COE Pending",
    Received: "CAS/COE Issued",
    Rejected: "Rejected",
  },
  visa: {
    "Not Started": "Visa Preparation",
    Preparing: "Visa Preparation",
    "Ready to Submit": "Visa Preparation",
    Submitted: "Visa Submitted",
    "Application Running": "Visa Submitted",
    "Additional Documents Required": "Visa Submitted",
    "Interview Required": "Visa Submitted",
    "Decision Pending": "Visa Submitted",
    Approved: "Visa Decision",
    Rejected: "Rejected",
    Withdrawn: "Withdrawn",
  },
  evisa: {
    "Not Required": "Visa Decision",
    Pending: "Visa Decision",
    Completed: "Visa Decision",
  },
  enrolment: {
    "Not Started": "Visa Decision",
    Preparing: "Visa Decision",
    Enrolled: "Enrolled",
    "Not Enrolled": "Withdrawn",
    Deferred: "Deferred",
    Withdrawn: "Withdrawn",
  },
};

/** The single source the counsellor should actually edit is the journey stage — this derives the
 * legacy flat AppStatus from it automatically, so nothing needs updating twice. */
export function deriveAppStatus(journey: ApplicationJourney): AppStatus {
  const stageType = currentStageOf(journey);
  if (!stageType) {
    const enrolment = journey.stages.enrolment;
    return (enrolment && STAGE_STATUS_TO_APP_STATUS.enrolment?.[enrolment.status]) || "Enrolled";
  }
  const record = journey.stages[stageType];
  const mapped = record && STAGE_STATUS_TO_APP_STATUS[stageType]?.[record.status];
  return mapped ?? "University Review";
}

export { currentStageOf as computeCurrentStage };
