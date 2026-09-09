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
  status: AppStatus;
  progress: number; // 0-100 weighted
  nextAction: string;
  waitingOn: "student" | "staff" | "university" | "none";
  stages: WorkflowStage[];
  updatedAt: string;
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
  courses: { name: string; level: string; duration: string }[];
  requirements: string[];
  fees: { label: string; amount: number }[];
  currencySymbol: string;
  minIELTS: number;
  tone: "violet" | "amber" | "teal" | "rose";
}
