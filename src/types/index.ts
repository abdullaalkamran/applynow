export type Role =
  | "student"
  | "agent"
  | "counsellor"
  | "admission"
  | "compliance"
  | "data"
  | "finance"
  | "admin";

export interface RoleMeta {
  id: Role;
  label: string;
  group: "Student" | "Agent" | "Staff" | "Admin";
  description: string;
}

export type AppStatus =
  | "Draft"
  | "Profile Incomplete"
  | "Documents Pending"
  | "Ready for Review"
  | "Eligibility Review"
  | "Application Preparing"
  | "Ready to Submit"
  | "Submitted"
  | "University Review"
  | "Additional Documents Requested"
  | "Offer Received"
  | "Offer Conditions Pending"
  | "Deposit Pending"
  | "Deposit Paid"
  | "CAS/COE Pending"
  | "CAS/COE Issued"
  | "Visa Preparation"
  | "Visa Submitted"
  | "Visa Decision"
  | "Enrolled"
  | "Deferred"
  | "Withdrawn"
  | "Rejected"
  | "Compliance Hold";

export interface Student {
  id: string;
  name: string;
  email: string;
  country: string;
  agentId?: string;
  counsellorId?: string;
  avatarColor: string;
  riskFlag?: "none" | "watch" | "high";
}

// A "lead" isn't a separate record — it's any Student account that's been created (signed up,
// possibly filled in some of their profile) but hasn't submitted an application yet. This tracks
// only the counsellor's own follow-up progress with that account.
export type LeadFollowUpStatus = "New" | "Contacted" | "Nurturing" | "Not Interested";

export interface WorkflowStage {
  key: string;
  label: string;
  status: "done" | "current" | "upcoming" | "blocked";
}

export interface Application {
  id: string;
  studentId: string;
  university: string;
  course: string;
  intake: string;
  country: string;
  campus?: string;
  status: AppStatus;
  progress: number; // 0-100 weighted
  nextAction: string;
  waitingOn: "student" | "staff" | "university" | "none";
  stages: WorkflowStage[];
  updatedAt: string;
  // Who confirmed the application — absent on seeded demo data. A "student" application the
  // counsellor hasn't opened yet is flagged as new on the counsellor's Applications page.
  source?: "student" | "counsellor";
}

export interface DocumentItem {
  id: string;
  studentId: string;
  applicationId?: string;
  name: string;
  type: string;
  status: "pending" | "verified" | "rejected" | "flagged";
  uploadedAt: string;
  rejectionReason?: string;
}

export interface CommissionTx {
  id: string;
  agentId: string;
  studentId: string;
  university: string;
  amount: number;
  currency: string;
  status: "Not Eligible" | "Expected" | "Pending" | "Approved" | "Invoiced" | "Paid" | "Disputed" | "Clawed Back";
  milestone: string;
  updatedAt: string;
}

export interface ComplianceCase {
  id: string;
  subjectType: "Student" | "Agent" | "Document" | "Application";
  subjectName: string;
  reason: string;
  riskLevel: "low" | "medium" | "high";
  status: "Open" | "Investigating" | "Frozen" | "Cleared" | "Escalated";
  openedAt: string;
  evidence: string[];
}

export interface CatalogRecord {
  id: string;
  type: "University" | "Course" | "Intake" | "Requirement" | "Scholarship";
  name: string;
  country: string;
  source: string;
  effectiveDate: string;
  verificationDate: string;
  status: "Draft" | "In Review" | "Published" | "Stale";
  owner: string;
}

export interface AuditLogEntry {
  id: string;
  actor: string;
  role: Role;
  action: string;
  target: string;
  timestamp: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  country: string;
  version: string;
  stages: number;
  status: "Active" | "Draft" | "Archived";
  lastUpdated: string;
}

export interface SupportContact {
  id: string;
  name: string;
  role: string;
  organization?: string;
  phone: string;
  avatarColor: string;
}

export interface University {
  id: string;
  name: string;
  city: string;
  country: string;
  tags: string[];
  subjects: string[];
  intakes: string[];
  worldRank: string;
  employability: string;
  studentCount: string;
  description: string;
  highlights: string[];
  courses: { id: string; name: string; level: string; duration: string; subject: string; feeUSD: number }[];
  // Real per-campus data, where the university has told us about more than one — falls back to a
  // synthetic "Main Campus" + one generated variant (see campusesFor) when this is absent, so
  // seeded universities that predate this field still show something on the Campus Options page.
  campuses?: { id: string; name: string; city: string; feeUSD?: number }[];
  requirements: string[];
  fees: { label: string; amount: number }[];
  currencySymbol: string;
  minIELTS: number;
  minGPA: number;
  // Every English test the university accepts, each with its own minimum overall score/band —
  // distinct from `minIELTS`, which stays the single figure existing search filtering compares
  // against. `minBand` is a single "no section below X" floor applied to every skill; `skillScores`
  // lets a data manager instead (or additionally) set a distinct minimum per named skill, e.g.
  // Speaking 7.0 while Listening/Reading/Writing stay at 6.5 — both are optional since not every
  // test publishes per-section floors, and not every university requires them.
  englishRequirements?: {
    testName: string;
    minScore: string;
    minBand?: string;
    skillScores?: { skill: string; score: string }[];
  }[];
  accreditations: string[];
  scholarshipsAvailable: boolean;
  // The intake currently open for applications, e.g. "September 2026" — distinct from `intakes`,
  // which lists every intake session the university runs each year.
  openIntake: string;
  // Per-month open/closed status for every month in `intakes` — lets a university mark more than
  // one intake open at once even though `openIntake` (above) only ever displays the first for
  // backward compatibility with pages that show a single "currently open" value.
  intakeStatus?: Record<string, boolean>;
  // Official public domain, e.g. "manchester.ac.uk" — no scheme/path.
  website: string;
  tone: "violet" | "amber" | "teal" | "rose";
}
