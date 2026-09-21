import type {
  Student, Application, DocumentItem, CommissionTx, ComplianceCase,
  CatalogRecord, AuditLogEntry, WorkflowTemplate, RoleMeta, University, SupportContact,
} from "../types";

export const ROLES: RoleMeta[] = [
  { id: "student", label: "Student", group: "Student", description: "Mobile experience" },
  { id: "agent", label: "B2B Agent", group: "Agent", description: "Agent portal" },
  { id: "counsellor", label: "Counsellor", group: "Staff", description: "Leads, cases, applications" },
  { id: "admission", label: "Admission Officer", group: "Staff", description: "Submission & tracking" },
  { id: "compliance", label: "Compliance Officer", group: "Staff", description: "Fraud & risk review" },
  { id: "data", label: "Data Management", group: "Staff", description: "Catalog authoring" },
  { id: "finance", label: "Finance", group: "Staff", description: "Commission & payments" },
  { id: "admin", label: "Admin", group: "Admin", description: "System configuration" },
];

export const STUDENTS: Student[] = [
  { id: "s1", name: "Sarah Khan", email: "sarah.khan@email.com", country: "Bangladesh", agentId: "a1", counsellorId: "c1", avatarColor: "bg-rose-500", riskFlag: "none" },
  { id: "s2", name: "Tomiwa Adeyemi", email: "tomiwa.a@example.com", country: "Nigeria", agentId: "a1", counsellorId: "c1", avatarColor: "bg-amber-500", riskFlag: "watch" },
  { id: "s3", name: "Priya Nair", email: "priya.n@example.com", country: "India", agentId: "a2", counsellorId: "c1", avatarColor: "bg-emerald-500", riskFlag: "none" },
  { id: "s4", name: "Duy Nguyen", email: "duy.n@example.com", country: "Vietnam", agentId: "a2", counsellorId: "c2", avatarColor: "bg-sky-500", riskFlag: "high" },
  { id: "s5", name: "Fatima Al-Sayed", email: "fatima.a@example.com", country: "Egypt", agentId: "a1", counsellorId: "c2", avatarColor: "bg-violet-500", riskFlag: "none" },
  // Signed up on the website and started their profile, but haven't submitted an application yet —
  // these are what show up on the counsellor's Leads page (no matching entry in APPLICATIONS).
  { id: "s6", name: "Amara Chukwu", email: "amara.chukwu@example.com", phone: "+234 803 555 0142", country: "Nigeria", counsellorId: "c1", avatarColor: "bg-indigo-500", riskFlag: "none" },
  { id: "s7", name: "Carlos Mendes", email: "carlos.mendes@example.com", phone: "+55 11 98765 4321", country: "Brazil", counsellorId: "c1", avatarColor: "bg-teal-500", riskFlag: "none" },
  // Referred by an agent partner but not yet claimed by a specific counsellor — still shows up on
  // the counsellor's Leads/Applications pages so an agent referral never sits invisible.
  { id: "s8", name: "Grace Mensah", email: "grace.mensah@example.com", phone: "+233 24 555 0198", country: "Ghana", agentId: "a2", avatarColor: "bg-rose-400", riskFlag: "none" },
  { id: "s9", name: "Youssef Ibrahim", email: "youssef.ibrahim@example.com", phone: "+20 100 555 0176", country: "Egypt", agentId: "a1", avatarColor: "bg-sky-400", riskFlag: "none" },
  // Signed up and applied entirely on their own, no agent involved — a genuine "Platform" applicant.
  { id: "s10", name: "Ana Torres", email: "ana.torres@example.com", phone: "+52 55 5555 0163", country: "Mexico", counsellorId: "c1", avatarColor: "bg-emerald-400", riskFlag: "none" },
  // Fresh enquiries with the agent — registered interest but haven't started an application yet
  // (the "Enquiry" stage of the agent's pipeline).
  { id: "s11", name: "Rafid Tajwar", email: "rafid.tajwar@example.com", phone: "+880 1812-345678", country: "Bangladesh", agentId: "a1", avatarColor: "bg-sky-500", riskFlag: "none" },
  { id: "s12", name: "Meher Nabila", email: "meher.nabila@example.com", phone: "+880 1912-987654", country: "Bangladesh", agentId: "a1", avatarColor: "bg-rose-400", riskFlag: "none" },
];

// A live binding, not a frozen constant: every module that imports `CURRENT_STUDENT_ID` (as a
// default parameter value or read inline) sees the *current* value on each read, per ES module
// semantics — so calling `setCurrentStudentId` once, from AuthContext.tsx whenever a real student
// session is established, is enough to make every one of those call sites resolve to whoever's
// actually logged in, with no changes needed at each of them. Defaults to the seeded demo student
// so nothing breaks before a session exists (there's no student page reachable pre-login anyway).
export let CURRENT_STUDENT_ID = "s1";
export function setCurrentStudentId(id: string) {
  CURRENT_STUDENT_ID = id;
}

export const COUNSELLORS: SupportContact[] = [
  { id: "c1", name: "Maria Fernandez", role: "Study Counsellor", phone: "+44 7700 900123", email: "maria.fernandez@studyone.dev", avatarColor: "bg-sky-500" },
  { id: "c2", name: "David Osei", role: "Study Counsellor", phone: "+44 7700 900456", email: "david.osei@studyone.dev", avatarColor: "bg-emerald-500" },
];

export const AGENTS: SupportContact[] = [
  { id: "a1", name: "Rafiq Hossain", role: "Education Agent", organization: "Global Pathways Consultants", phone: "+880 1811-223344", email: "rafiq.hossain@globalpathways.example", avatarColor: "bg-amber-500" },
  { id: "a2", name: "Nusrat Jahan", role: "Education Agent", organization: "BrightFuture Education", phone: "+880 1911-556677", email: "nusrat.jahan@brightfuture.example", avatarColor: "bg-violet-500" },
];

// Pooled review-team roles (not assigned 1:1 per student like Counsellor/Agent) — whoever is
// currently handling submission and compliance review across applications.
// More than one seeded officer so per-application assignment (Application.responsibleAdmissionOfficerId)
// is actually demonstrable — previously a single-element array meant every application showed the
// same hardcoded officer everywhere, with no real assignment possible.
export const ADMISSION_OFFICERS: SupportContact[] = [
  { id: "ad1", name: "Aisha Rahman", role: "Admission Officer", phone: "+44 7700 900654", email: "aisha.rahman@studyone.dev", avatarColor: "bg-indigo-500" },
  { id: "ad2", name: "Tanvir Ahmed", role: "Admission Officer", phone: "+44 7700 900321", email: "tanvir.ahmed@studyone.dev", avatarColor: "bg-sky-600" },
  { id: "ad3", name: "Priya Sharma", role: "Admission Officer", phone: "+44 7700 900432", email: "priya.sharma@studyone.dev", avatarColor: "bg-violet-600" },
];

export const COMPLIANCE_OFFICERS: SupportContact[] = [
  { id: "co1", name: "R. Fernandez", role: "Compliance Officer", phone: "+44 7700 900987", avatarColor: "bg-rose-500" },
];

export function stages(currentIdx: number, blockedIdx: number | null = null) {
  const labels = ["Profile", "Documents", "Application", "Decision", "Acceptance", "Visa", "Enrolment"];
  return labels.map((label, i) => ({
    key: label.toLowerCase(),
    label,
    status: (blockedIdx === i ? "blocked" : i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming") as any,
  }));
}

// Demo applications removed — Application is now Postgres-backed (see src/data/applicationsStore.ts
// and server/src/routes/applications.js); this array only ever fed the still-unmigrated
// src/features/staff/admission/SubmissionQueue.tsx and utils/displayId.ts's id-counter seed, both
// of which handle an empty array gracefully.
export const APPLICATIONS: Application[] = [];

export const DOCUMENTS: DocumentItem[] = [
  { id: "d1", studentId: "s1", applicationId: "app1", name: "Passport.pdf", type: "Identity", status: "verified", uploadedAt: "2026-07-10" },
  { id: "d2", studentId: "s1", applicationId: "app1", name: "Transcript_BSc.pdf", type: "Academic", status: "verified", uploadedAt: "2026-07-11" },
  { id: "d3", studentId: "s1", applicationId: "app2", name: "Bank_Statement.pdf", type: "Financial", status: "pending", uploadedAt: "2026-09-05" },
  { id: "d4", studentId: "s2", applicationId: "app3", name: "IELTS_Score.pdf", type: "English Proficiency", status: "rejected", uploadedAt: "2026-08-20", rejectionReason: "Score below requirement — resubmit with updated attempt." },
  { id: "d5", studentId: "s4", applicationId: "app5", name: "Sponsor_Bank_Statement.pdf", type: "Financial", status: "flagged", uploadedAt: "2026-09-03", rejectionReason: "Inconsistent formatting detected — routed to Compliance." },
  { id: "d6", studentId: "s5", applicationId: "app6", name: "Passport.pdf", type: "Identity", status: "verified", uploadedAt: "2026-06-15" },
];

export const COMMISSIONS: CommissionTx[] = [
  { id: "cm1", agentId: "a1", studentId: "s1", university: "University of Manchester", amount: 1450, currency: "USD", status: "Pending", milestone: "Enrolment", updatedAt: "2026-09-02" },
  { id: "cm2", agentId: "a1", studentId: "s2", university: "University of Toronto", amount: 2100, currency: "USD", status: "Expected", milestone: "Offer Accepted", updatedAt: "2026-09-01" },
  { id: "cm3", agentId: "a2", studentId: "s3", university: "University of Auckland", amount: 1275, currency: "USD", status: "Approved", milestone: "Deposit Paid", updatedAt: "2026-08-29" },
  { id: "cm4", agentId: "a1", studentId: "s5", university: "University of Melbourne", amount: 1600, currency: "USD", status: "Invoiced", milestone: "CAS Issued", updatedAt: "2026-09-04" },
  { id: "cm5", agentId: "a2", studentId: "s4", university: "University of Leeds", amount: 900, currency: "USD", status: "Disputed", milestone: "Enrolment", updatedAt: "2026-09-06" },
  { id: "cm6", agentId: "a1", studentId: "s1", university: "University of Manchester", amount: 1450, currency: "USD", status: "Paid", milestone: "Enrolment (prior intake)", updatedAt: "2026-05-20" },
];

// Live binding, same mechanism as CURRENT_STUDENT_ID above — set from AuthContext.tsx whenever an
// agent session is established, so every agent page resolves to whoever is actually logged in
// instead of the seeded demo agent.
export let CURRENT_AGENT_ID = "a1";
export function setCurrentAgentId(id: string) {
  CURRENT_AGENT_ID = id;
}

export const COMPLIANCE_CASES: ComplianceCase[] = [
  { id: "cc1", subjectType: "Document", subjectName: "Sponsor_Bank_Statement.pdf (Duy Nguyen)", reason: "Formatting anomaly detected by Document AI", riskLevel: "high", status: "Investigating", openedAt: "2026-09-03", evidence: ["AI anomaly score: 0.91", "Font inconsistency on page 2", "Metadata edited after issue date"] },
  { id: "cc2", subjectType: "Agent", subjectName: "Global Reach Consultants", reason: "Duplicate application submitted for same student via two sub-agents", riskLevel: "medium", status: "Open", openedAt: "2026-09-05", evidence: ["Application app5 and app5b share identical documents", "Different sub-agent IDs used"] },
  { id: "cc3", subjectType: "Student", subjectName: "Tomiwa Adeyemi", reason: "IELTS certificate number does not match issuing body record", riskLevel: "medium", status: "Escalated", openedAt: "2026-08-30", evidence: ["Certificate number lookup failed", "Student re-submitted under review"] },
  { id: "cc4", subjectType: "Application", subjectName: "app6 — Fatima Al-Sayed", reason: "Routine KYC spot-check (random sample)", riskLevel: "low", status: "Cleared", openedAt: "2026-08-15", evidence: ["Liveness check passed", "Document hash matches original upload"] },
];

export const CATALOG_RECORDS: CatalogRecord[] = [
  { id: "cat1", type: "University", name: "University of Manchester", country: "UK", source: "Official university website", effectiveDate: "2026-01-01", verificationDate: "2026-08-01", status: "Published", owner: "D. Osei" },
  { id: "cat2", type: "Requirement", name: "UK Tier 4 Financial Proof — Postgraduate", country: "UK", source: "UKVI Immigration Rules", effectiveDate: "2026-04-01", verificationDate: "2026-04-01", status: "Published", owner: "D. Osei" },
  { id: "cat3", type: "Course", name: "MSc Data Science — Melbourne", country: "Australia", source: "University handbook 2027", effectiveDate: "2026-07-01", verificationDate: "2026-07-01", status: "In Review", owner: "L. Chen" },
  { id: "cat4", type: "Scholarship", name: "Vice-Chancellor's Excellence Scholarship", country: "Australia", source: "University scholarship office", effectiveDate: "2026-02-01", verificationDate: "2025-11-01", status: "Stale", owner: "L. Chen" },
  { id: "cat5", type: "Intake", name: "January 2027 Intake — UK Postgraduate", country: "UK", source: "Internal calendar", effectiveDate: "2026-01-01", verificationDate: "2026-08-15", status: "Draft", owner: "D. Osei" },
];

export const WORKFLOW_TEMPLATES: WorkflowTemplate[] = [
  { id: "wf1", name: "UK Postgraduate — Standard", country: "UK", version: "v3.2", stages: 7, status: "Active", lastUpdated: "2026-07-20" },
  { id: "wf2", name: "Australia Postgraduate — Standard", country: "Australia", version: "v2.1", stages: 7, status: "Active", lastUpdated: "2026-06-11" },
  { id: "wf3", name: "Canada MBA — With Co-op", country: "Canada", version: "v1.4", stages: 8, status: "Draft", lastUpdated: "2026-09-01" },
  { id: "wf4", name: "UK Postgraduate — Legacy", country: "UK", version: "v2.9", stages: 6, status: "Archived", lastUpdated: "2025-12-02" },
];

// Demo universities removed — the catalog now starts empty; add real partner universities
// through Data Management (src/data/universityCatalogStore.ts's addUniversity/addCourse), or
// re-seed this array if you need placeholder data again.
export const UNIVERSITIES: University[] = [];

export const AUDIT_LOG: AuditLogEntry[] = [
  { id: "al1", actor: "D. Osei", role: "data", action: "Published catalog record", target: "University of Manchester", timestamp: "2026-08-01 09:12" },
  { id: "al2", actor: "R. Fernandez", role: "compliance", action: "Froze application", target: "app5 — Duy Nguyen", timestamp: "2026-09-06 14:03" },
  { id: "al3", actor: "System (AI)", role: "compliance", action: "Flagged document for anomaly review", target: "Sponsor_Bank_Statement.pdf", timestamp: "2026-09-03 08:41" },
  { id: "al4", actor: "M. Islam", role: "finance", action: "Approved commission", target: "cm3 — University of Auckland", timestamp: "2026-08-29 16:20" },
  { id: "al5", actor: "K. Patel", role: "admin", action: "Updated RBAC permission", target: "Role: Admission Officer", timestamp: "2026-08-22 11:05" },
];
