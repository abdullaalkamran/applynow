// Server-side port of src/data/requirementRules.ts + src/utils/applicationJourneyEngine.ts +
// src/data/applicationJourneyStore.ts's initializeJourney — kept as plain data/pure functions so
// the applications/journey routes and the seed script share one source of truth, same as the
// frontend's store/engine split. Simplification vs. the frontend version: computeBlockers() here
// does not check for missing documents, since the Document table isn't populated until a later
// migration phase (documentsStore.ts is still localStorage-only) — status derivation still works,
// it just can't yet surface a "document X is missing" blocker server-side.

const STAGE_ORDER = [
  "application", "offer", "financial_readiness", "payment",
  "interview", "university_document", "visa", "evisa", "enrolment",
];

const STAGE_LABEL = {
  application: "Application",
  offer: "Offer",
  financial_readiness: "Financial Readiness",
  payment: "Payment",
  interview: "Interview",
  university_document: "University Immigration Document",
  visa: "Visa",
  evisa: "E-Visa",
  enrolment: "Enrolment",
};

// --- Requirement Engine (country -> immigration doc type / bank holding period) ---
// Keyed directly by country name (server has no countryRegistry id layer) — the seeded country
// names below match mockData.ts's Application.country / University.country values exactly.
const DOC_TYPE_BY_COUNTRY = { UK: "CAS", Australia: "COE", Canada: "PAL", "United States": "I-20" };
const HOLDING_DAYS_BY_COUNTRY = { UK: 28, Australia: 90, Canada: 30, "United States": 365 };

function resolveImmigrationDocType(countryName) {
  return DOC_TYPE_BY_COUNTRY[countryName] || "Other";
}

function resolveHoldingPeriodDays(countryName) {
  return HOLDING_DAYS_BY_COUNTRY[countryName] ?? 180;
}

function buildInitialStages(countryName) {
  const docType = resolveImmigrationDocType(countryName);
  const holdingPeriodDays = resolveHoldingPeriodDays(countryName);
  const base = (stageType, applicable, required, status, data) => ({ stageType, applicable, required, status, data });

  // The Application row itself is created straight into "Submitted" (POST /api/applications) — a
  // student can only reach Confirm once their profile and core documents are complete, and a
  // counsellor creating one on their behalf is recording a submission, not a draft. So the journey's
  // first stage must agree: "Submitted to Portal" is the stage status that maps back to "Submitted".
  // Starting it at "Incomplete Profile" made the journey strip/summary contradict the status card.
  return {
    application: base("application", true, true, "Submitted to Portal", { appliedVia: "Direct University Portal" }),
    offer: base("offer", true, true, "Waiting", {}),
    financial_readiness: base("financial_readiness", true, true, "Not Started", { evidenceRequired: true, holdingPeriodDays, bankStatus: "Not Started" }),
    payment: base("payment", true, true, "Preparing", {}),
    interview: base("interview", true, false, "Not Required", {}),
    university_document: base("university_document", true, true, "Waiting for Documents", { docType, medical: { required: false, tbRequired: false, status: "Not Required" } }),
    visa: base("visa", true, true, "Not Started", { visaRequired: true }),
    evisa: base("evisa", false, false, "Not Required", { shareCodeStatus: "Not Required" }),
    enrolment: base("enrolment", true, true, "Not Started", {}),
  };
}

/** Journeys created before buildInitialStages() started at "Submitted to Portal" still carry the
 * old "Incomplete Profile" default even though their Application row says "Submitted". Returns a
 * corrected `stages` object when that's the case (the caller persists it), or null when nothing
 * needs fixing. Only fires when the row's status is NOT "Profile Incomplete" — that's the one
 * case where staff deliberately set the stage back, and it must be left alone. */
function repairLegacyApplicationStage(stages, appStatusHuman) {
  const record = stages?.application;
  if (!record || record.status !== "Incomplete Profile" || record.completedAt) return null;
  if (appStatusHuman === "Profile Incomplete") return null;
  return { ...stages, application: { ...record, status: "Submitted to Portal" } };
}

/** Rebuilds a journey's financial_readiness stage from the student's shared
 * StudentFinancialReadiness row — the source of truth — so the per-application copy never goes
 * stale. Without this, a record saved before the application existed (or through a sibling
 * application) left this journey's copy blank, and a counsellor's next one-field edit here merged
 * into that blank copy and wrote it back over the real data. Returns `stages` unchanged when
 * there's no shared row yet. */
function syncFinancialReadinessStage(stages, shared) {
  if (!shared) return stages;
  const current = stages?.financial_readiness || { stageType: "financial_readiness", applicable: true, required: true, data: {} };
  const toDate = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);
  const data = {
    ...current.data,
    evidenceRequired: shared.evidenceRequired,
    requiredAmount: shared.requiredAmount ?? undefined,
    currency: shared.currency || undefined,
    holdingPeriodDays: shared.holdingPeriodDays ?? current.data?.holdingPeriodDays,
    openingDate: toDate(shared.openingDate),
    maturityDate: toDate(shared.maturityDate),
    bankStatus: shared.bankStatus,
    accountHolder: shared.accountHolder || undefined,
    accountType: shared.accountType || undefined,
    depositType: shared.depositType || undefined,
  };
  return {
    ...stages,
    financial_readiness: {
      ...current,
      status: shared.bankStatus,
      completedAt: shared.completedAt ? new Date(shared.completedAt).toISOString() : current.completedAt,
      data,
    },
  };
}

const STAGE_TERMINAL_STATUS = {
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

const NON_BLOCKING_STATUS = {
  interview: ["Not Required"],
  evisa: ["Not Required"],
};

const PROBLEM_STATUSES = {
  application: ["On Hold", "Rejected"],
  offer: ["Document Missing", "On Hold", "Rejected"],
  payment: ["Failed"],
  university_document: ["Rejected"],
  visa: ["Additional Documents Required", "Rejected", "Withdrawn"],
};

const DEFAULT_NEXT_ACTION = {
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

const STAGE_STATUS_TO_APP_STATUS = {
  application: {
    "Incomplete Profile": "Profile Incomplete", "Waiting for Documents": "Documents Pending",
    "Documents Ready": "Ready to Submit", "Submitted to Portal": "Submitted",
    "Submitted to University": "University Review", "Payment Required": "Deposit Pending",
    "Interview Required": "Eligibility Review", "On Hold": "Compliance Hold", "Rejected": "Rejected",
  },
  offer: {
    Waiting: "University Review", Conditional: "Offer Conditions Pending", Unconditional: "Offer Received",
    "Document Missing": "Additional Documents Requested", "On Hold": "Compliance Hold", Rejected: "Rejected",
  },
  financial_readiness: {
    "Not Required": "Deposit Pending", "Not Started": "Deposit Pending", Preparing: "Deposit Pending",
    Maintaining: "Deposit Pending", Matured: "Deposit Paid", Ready: "Deposit Paid", Expired: "Deposit Pending",
  },
  payment: {
    Preparing: "Deposit Pending", "Not Yet Paid": "Deposit Pending", "Waiting for Confirmation": "Deposit Pending",
    Paid: "Deposit Paid", Failed: "Deposit Pending", Refunded: "Deposit Pending",
  },
  interview: {
    "Not Required": "Eligibility Review", Preparing: "Eligibility Review", Scheduled: "Eligibility Review",
    Completed: "Eligibility Review", "Waiting for Result": "Eligibility Review", Passed: "Eligibility Review", Failed: "Rejected",
  },
  university_document: {
    "Waiting for Documents": "CAS/COE Pending", "Documents Received": "CAS/COE Pending", "Waiting for Payment": "CAS/COE Pending",
    "Waiting for Interview": "CAS/COE Pending", "Form Filling": "CAS/COE Pending", Processing: "CAS/COE Pending",
    Received: "CAS/COE Issued", Rejected: "Rejected",
  },
  visa: {
    "Not Started": "Visa Preparation", Preparing: "Visa Preparation", "Ready to Submit": "Visa Preparation",
    Submitted: "Visa Submitted", "Application Running": "Visa Submitted", "Additional Documents Required": "Visa Submitted",
    "Interview Required": "Visa Submitted", "Decision Pending": "Visa Submitted", Approved: "Visa Decision",
    Rejected: "Rejected", Withdrawn: "Withdrawn",
  },
  evisa: { "Not Required": "Visa Decision", Pending: "Visa Decision", Completed: "Visa Decision" },
  enrolment: {
    "Not Started": "Visa Decision", Preparing: "Visa Decision", Enrolled: "Enrolled",
    "Not Enrolled": "Withdrawn", Deferred: "Deferred", Withdrawn: "Withdrawn",
  },
};

function currentStageOf(stages) {
  for (const stageType of STAGE_ORDER) {
    const record = stages[stageType];
    if (!record?.applicable) continue;
    if (record.completedAt) continue;
    if (NON_BLOCKING_STATUS[stageType]?.includes(record.status)) continue;
    return stageType;
  }
  return null;
}

function computeBlockers(stages) {
  const blockers = [];
  for (const stageType of STAGE_ORDER) {
    const record = stages[stageType];
    if (!record?.applicable) continue;
    if (record.blocked) {
      blockers.push({ stageType, description: record.blockedReason || `${STAGE_LABEL[stageType]} is blocked.`, severity: "high", responsibleParty: { role: "Other" } });
    } else if (PROBLEM_STATUSES[stageType]?.includes(record.status)) {
      blockers.push({ stageType, description: `${STAGE_LABEL[stageType]} status is "${record.status}".`, severity: "medium", responsibleParty: { role: "Counsellor" } });
    }
  }
  return blockers;
}

function computeNextAction(stages) {
  const stageType = currentStageOf(stages);
  if (!stageType) return null;
  const blockers = computeBlockers(stages).filter((b) => b.stageType === stageType);
  if (blockers.length > 0) {
    return { title: `Resolve: ${blockers[0].description}`, owner: blockers[0].responsibleParty, stageType };
  }
  const fallback = DEFAULT_NEXT_ACTION[stageType];
  return { title: fallback.title, owner: { role: fallback.role }, stageType };
}

function deriveAppStatus(stages) {
  const stageType = currentStageOf(stages);
  if (!stageType) {
    const enrolment = stages.enrolment;
    return (enrolment && STAGE_STATUS_TO_APP_STATUS.enrolment?.[enrolment.status]) || "Enrolled";
  }
  const record = stages[stageType];
  const mapped = record && STAGE_STATUS_TO_APP_STATUS[stageType]?.[record.status];
  return mapped ?? "University Review";
}

module.exports = {
  STAGE_ORDER, STAGE_LABEL, STAGE_TERMINAL_STATUS,
  resolveImmigrationDocType, resolveHoldingPeriodDays, buildInitialStages, repairLegacyApplicationStage, syncFinancialReadinessStage,
  currentStageOf, computeBlockers, computeNextAction, deriveAppStatus,
};
