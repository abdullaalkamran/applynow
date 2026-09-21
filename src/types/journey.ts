// The structured Application → Enrolment journey — kept separate from the flat `Application`/
// `AppStatus` in ./index.ts (which stays exactly as-is and keeps driving every existing page).
// This is the richer, stage-by-stage model: nine stages, each with its own shape, gated by the
// Requirement Engine (see ../data/requirementRules.ts) so which stages/fields apply to a given
// application is data-driven per country/university/course — never a hardcoded `if country===`.

export type StageType =
  | "application"
  | "offer"
  | "financial_readiness"
  | "payment"
  | "interview"
  | "university_document"
  | "visa"
  | "evisa"
  | "enrolment";

export const STAGE_ORDER: StageType[] = [
  "application", "offer", "financial_readiness", "payment",
  "interview", "university_document", "visa", "evisa", "enrolment",
];

export const STAGE_LABEL: Record<StageType, string> = {
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

// Who's actually responsible for moving a stage forward — deliberately broader than the app's own
// `Role` union, since "the university" or an unmodelled third party are both real owners of a step
// (e.g. waiting on the university to issue CAS) that don't correspond to a StudyOne account.
export interface StageOwner {
  id?: string;
  role: "Student" | "Counsellor" | "AdmissionOfficer" | "University" | "Other";
  name?: string;
}

export interface StageRecord<TStatus extends string, TData> {
  stageType: StageType;
  applicable: boolean;
  required: boolean;
  status: TStatus;
  startedAt?: string;
  completedAt?: string;
  blocked?: boolean;
  blockedReason?: string;
  data: TData;
}

// --- Stage 01: Application ---
export type ApplicationStageStatus =
  | "Incomplete Profile" | "Waiting for Documents" | "Documents Ready" | "Submitted to Portal"
  | "Submitted to University" | "Payment Required" | "Interview Required" | "On Hold" | "Rejected";

export interface ApplicationStageData {
  appliedVia: "Direct University Portal" | "B2B Portal" | "Agent Portal" | "Partner Portal" | "Email" | "Other";
  portalName?: string;
  portalId?: string;
  applicationRef?: string;
  portalUrl?: string;
  responsibleCounsellorId?: string;
  responsibleAdmissionOfficerId?: string;
  portalSubmissionDate?: string;
  universitySubmissionDate?: string;
  universityStudentId?: string;
}

// --- Stage 02: Offer ---
export type OfferStageStatus = "Waiting" | "Conditional" | "Unconditional" | "Document Missing" | "On Hold" | "Rejected";

export interface OfferStageData {
  conditionalOfferDate?: string;
  unconditionalOfferDate?: string;
  offerExpiryDate?: string;
  offerLetterUrl?: string;
  tuitionFee?: number;
  scholarship?: number;
  netTuition?: number;
  depositRequired?: boolean;
  depositAmount?: number;
  depositDeadline?: string;
  livingCostRequirement?: number;
}

// --- Stage 03: Financial Readiness ---
export type BankStatus = "Not Required" | "Not Started" | "Preparing" | "Maintaining" | "Matured" | "Ready" | "Expired";

export interface FinancialReadinessStageData {
  evidenceRequired: boolean;
  requiredAmount?: number;
  currency?: string;
  holdingPeriodDays?: number; // resolved by the Requirement Engine, e.g. 28 / 180 / 365
  openingDate?: string;
  maturityDate?: string; // computed: openingDate + holdingPeriodDays
  bankStatus: BankStatus;
  bankName?: string;
  accountHolder?: "Student" | "Mother" | "Father" | "Brother/Sister" | "Other";
  accountType?: "Savings" | "Current" | "FDR" | "Other";
  depositType?: DepositType;
}

export type DepositType = "Cash Deposit" | "Cheque Deposit" | "Bank Transfer";
export const DEPOSIT_TYPES: DepositType[] = ["Cash Deposit", "Cheque Deposit", "Bank Transfer"];

// --- Stage 04: Payment ---
export type PaymentStageStatus = "Preparing" | "Not Yet Paid" | "Waiting for Confirmation" | "Paid" | "Failed" | "Refunded";

export interface PaymentStageData {
  requiredAmount?: number;
  paidAmount?: number;
  currency?: string;
  paymentDate?: string;
  paymentReference?: string;
  paymentMethod?: "Bank" | "Card" | "Flywire" | "Convera" | "Other";
}

// --- Stage 05: Interview ---
export type InterviewStageStatus = "Not Required" | "Preparing" | "Scheduled" | "Completed" | "Waiting for Result" | "Passed" | "Failed";

export interface InterviewStageData {
  interviewLink?: string;
  interviewDate?: string;
  interviewType?: string;
  result?: string;
  notes?: string;
}

// --- Stage 06: University Immigration Document (CAS/COE/PAL/I-20 — one dynamic stage) ---
export type UniversityDocumentStatus =
  | "Waiting for Documents" | "Documents Received" | "Waiting for Payment" | "Waiting for Interview"
  | "Form Filling" | "Processing" | "Received" | "Rejected";

// Medical/TB lives here as a sub-record, not a standalone top-level stage (confirmed with the
// user — the platform's immigration-document step is what actually gates on it in practice).
export interface MedicalSubRecord {
  required: boolean;
  tbRequired: boolean;
  status: "Not Required" | "Not Started" | "Appointment Booked" | "Completed" | "Uploaded" | "Verified" | "Expired";
  testDate?: string;
  clinic?: string;
  certificateNumber?: string;
  expiryDate?: string;
}

export interface UniversityDocumentStageData {
  docType: "CAS" | "COE" | "PAL" | "I-20" | "Other"; // resolved per country/university by the Requirement Engine
  requestDate?: string;
  receivedDate?: string;
  documentNumber?: string;
  issueDate?: string;
  expiryDate?: string;
  paymentReadiness?: "Ready" | "Preparing" | "Not Ready";
  ihsFeeStatus?: "Not Required" | "Not Yet Paid" | "Paid" | "Rejected";
  medical: MedicalSubRecord;
}

// --- Stage 07: Visa ---
export type VisaStageStatus =
  | "Not Started" | "Preparing" | "Ready to Submit" | "Submitted" | "Application Running"
  | "Additional Documents Required" | "Interview Required" | "Decision Pending" | "Approved" | "Rejected" | "Withdrawn";

export interface VisaStageData {
  visaRequired: boolean;
  visaType?: string;
  visaApplicationNumber?: string;
  submissionDate?: string;
  appointmentDate?: string;
  biometricDate?: string;
  interviewDate?: string;
  visaFeeStatus?: "Not Yet Paid" | "Paid";
  ihsFeeStatus?: "Not Required" | "Not Yet Paid" | "Paid";
}

// --- Stage 08: E-Visa / Share Code ---
export type EvisaStageStatus = "Not Required" | "Pending" | "Completed";

export interface EvisaStageData {
  shareCodeStatus: "Not Required" | "Waiting" | "Received" | "Expired";
  generatedDate?: string;
  expiryDate?: string;
}

// --- Stage 09: Enrolment ---
export type EnrolmentStageStatus = "Not Started" | "Preparing" | "Enrolled" | "Not Enrolled" | "Deferred" | "Withdrawn";

export interface EnrolmentStageData {
  classStartDate?: string;
  orientationDate?: string;
  enrolmentDeadline?: string;
  universityStudentId?: string;
  enrolmentDate?: string;
  arrivalDate?: string;
  actualCourseStartDate?: string;
}

export interface ApplicationJourney {
  applicationId: string;
  stages: {
    application?: StageRecord<ApplicationStageStatus, ApplicationStageData>;
    offer?: StageRecord<OfferStageStatus, OfferStageData>;
    financial_readiness?: StageRecord<BankStatus, FinancialReadinessStageData>;
    payment?: StageRecord<PaymentStageStatus, PaymentStageData>;
    interview?: StageRecord<InterviewStageStatus, InterviewStageData>;
    university_document?: StageRecord<UniversityDocumentStatus, UniversityDocumentStageData>;
    visa?: StageRecord<VisaStageStatus, VisaStageData>;
    evisa?: StageRecord<EvisaStageStatus, EvisaStageData>;
    enrolment?: StageRecord<EnrolmentStageStatus, EnrolmentStageData>;
  };
}
