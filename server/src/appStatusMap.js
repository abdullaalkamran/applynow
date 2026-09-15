// Bridges the frontend's human-readable AppStatus strings (src/types/index.ts) and the Prisma
// AppStatus enum's generated identifiers (schema.prisma can't use "/" or spaces in an enum
// identifier, so each maps via @map to the exact string below).
const HUMAN_TO_ENUM = {
  "Draft": "Draft",
  "Profile Incomplete": "ProfileIncomplete",
  "Documents Pending": "DocumentsPending",
  "Ready for Review": "ReadyForReview",
  "Eligibility Review": "EligibilityReview",
  "Application Preparing": "ApplicationPreparing",
  "Ready to Submit": "ReadyToSubmit",
  "Submitted": "Submitted",
  "University Review": "UniversityReview",
  "Additional Documents Requested": "AdditionalDocumentsRequested",
  "Offer Received": "OfferReceived",
  "Offer Conditions Pending": "OfferConditionsPending",
  "Deposit Pending": "DepositPending",
  "Deposit Paid": "DepositPaid",
  "CAS/COE Pending": "CasCoePending",
  "CAS/COE Issued": "CasCoeIssued",
  "Visa Preparation": "VisaPreparation",
  "Visa Submitted": "VisaSubmitted",
  "Visa Decision": "VisaDecision",
  "Enrolled": "Enrolled",
  "Deferred": "Deferred",
  "Withdrawn": "Withdrawn",
  "Rejected": "Rejected",
  "Compliance Hold": "ComplianceHold",
};

const ENUM_TO_HUMAN = Object.fromEntries(Object.entries(HUMAN_TO_ENUM).map(([human, key]) => [key, human]));

function toEnum(human) {
  const key = HUMAN_TO_ENUM[human];
  if (!key) throw Object.assign(new Error(`Unknown application status "${human}"`), { status: 400 });
  return key;
}

function toHuman(key) {
  return ENUM_TO_HUMAN[key] || key;
}

module.exports = { toEnum, toHuman, HUMAN_TO_ENUM };
