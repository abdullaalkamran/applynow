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
  // Basic contact number captured at signup — distinct from the (possibly more current, OTP-
  // verified) phone recorded in Personal Information during onboarding. A lead has this from the
  // moment their account exists, well before they'd have completed that later step.
  phone?: string;
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
  // Per-application responsible staff — distinct from Student.agentId/counsellorId (the student's
  // overall relationship) since a student's applications can, in principle, be split across
  // counsellors, and admission-officer coverage is assigned per application, not per student.
  // Platform-assigned; counsellor-assigned respectively — see data/applicationsStore.ts's
  // assignCounsellor()/assignAdmissionOfficer().
  responsibleCounsellorId?: string;
  responsibleAdmissionOfficerId?: string;
  // Absent on seeded demo data (none of it predates this field) — applicationSortKey() in
  // applicationsStore.ts falls back to parsing a creation order out of the id itself for those,
  // so ordering "oldest first" still works app-wide without needing to backfill every seed row.
  createdAt?: string;
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
  // For status-change email notifications — absent means this contact just doesn't get emailed
  // (WhatsApp still works off `phone` alone).
  email?: string;
  avatarColor: string;
}

export interface CourseAccreditation {
  name: string;
  logoUrl?: string;
}

export interface University {
  id: string;
  name: string;
  city: string;
  country: string;
  tags: string[];
  subjects: string[];
  intakes: string[];
  // `worldRank` stays the single generic figure every existing sort/display site already reads —
  // derived from whichever of the two named rankings below is set (QS preferred, Times Higher as
  // fallback) so nothing consuming it needs to change. The two named fields are what Data
  // Management actually enters, since a university's QS and Times Higher positions rarely match.
  worldRank: string;
  qsRanking?: string;
  timesHigherRanking?: string;
  employability: string;
  studentCount: string;
  description: string;
  highlights: string[];
  courses: {
    id: string;
    name: string;
    level: string;
    duration: string;
    subject: string;
    feeUSD: number;
    // Course-specific intake months and application deadline — a subset of the university's own
    // `intakes`, since a course needn't run every session the university offers. Falls back to the
    // university's own intake data on display when absent (older courses, or ones on the general schedule).
    intakes?: string[];
    applicationDeadline?: string;
    // Course-specific entry requirements, distinct from the university-wide `requirements` above —
    // e.g. a specific prior degree or portfolio this particular course additionally expects. Absent
    // (or empty) means the course follows the university's own academic requirements as-is.
    requirements?: string[];
    // Course-specific English test requirements, same shape as University.englishRequirements —
    // absent means the course follows the university's own English requirements as-is. Only set
    // this when the course genuinely differs (e.g. a more competitive program with a higher bar).
    englishRequirements?: {
      testName: string;
      minScore?: string;
      skillScores?: { skill: string; score: string }[];
    }[];
    // Fee currency for this course — falls back to the university's own `currencySymbol` when unset.
    currencySymbol?: string;
    // Which of the university's campuses this course runs at (ids from `campuses` below) — absent
    // or empty means it runs at every campus.
    campusIds?: string[];
    // Course-page content entered directly on the course (see Data Management's CourseForm).
    // `description` unset → a generated one-line blurb; `studyMode` unset → "Full-time";
    // `modules`/`careers` unset → the subject's own authored lists, then the generic curriculum
    // (see subjectCurriculum.ts's curriculumForCourse).
    description?: string;
    studyMode?: string;
    modules?: string[];
    careers?: string[];
    // Bodies that accredit this specific course (distinct from the university-level
    // `accreditations` list below); `logoUrl` is a data URL, like the university's own logo.
    accreditations?: CourseAccreditation[];
  }[];
  // Real per-campus data, where the university has told us about more than one — falls back to a
  // synthetic "Main Campus" + one generated variant (see campusesFor) when this is absent, so
  // seeded universities that predate this field still show something on the Campus Options page.
  campuses?: { id: string; name: string; city: string; feeUSD?: number }[];
  // Academic entry requirements, split by degree level — a university's Bachelor's and Postgraduate
  // admissions criteria are rarely the same list, so this isn't one shared array a course's own
  // `level` (above) has to guess its way through. A course whose own `requirements` (above) is unset
  // falls back to whichever of these two matches its `level`.
  requirements: {
    undergraduate: string[];
    postgraduate: string[];
  };
  fees: { label: string; amount: number }[];
  // Minimum deposit required to secure a place after an offer — distinct from the itemized `fees`
  // above, and typically due before visa/CAS issuance. `depositRules` are free-text conditions,
  // e.g. refundability, deadlines, or how it's later adjusted against tuition. `depositMode` records
  // whether the amount was set as a flat figure or as a fraction of the first year's tuition fee —
  // "half"/"full" display as a rule of thumb (e.g. "50% of first year tuition fees") rather than a
  // raw number, since it should track the tuition fee if that later changes.
  minimumDepositAmount?: number;
  depositMode?: "custom" | "half" | "full";
  paymentDeadline?: string;
  depositRules?: string[];
  // Ordered admission/application steps for this university, e.g. "Submit application" → "Receive
  // offer" → "Pay deposit" → "Get CAS" — shown as a numbered checklist so applicants know what's
  // next. Absent/empty means the university hasn't documented its own procedure yet.
  admissionSteps?: string[];
  // Sub-national regions/divisions this university does NOT accept applicants from — based on
  // either the applicant's passport/permanent address or where they studied (education board or
  // prior institution), e.g. "Sylhet Division" for a university that restricts intake from a
  // specific district due to a history of visa refusals/overstays from there. Free text since each
  // source country has its own subdivision system (divisions, states, provinces, etc.) — shown as
  // a prominent warning, not tucked into a collapsible section, since it's a hard eligibility gate.
  restrictedRegions?: string[];
  currencySymbol: string;
  minIELTS: number;
  minGPA: number;
  // Every English test the university accepts, split by degree level the same way `requirements`
  // above is — distinct from `minIELTS`, which stays the single figure existing search filtering
  // compares against. `minScore` is the overall score required; `skillScores` additionally sets a
  // minimum per named skill, e.g. Speaking 7.0 while Listening/Reading/Writing stay at 6.5.
  englishRequirements?: {
    undergraduate: { testName: string; minScore?: string; skillScores?: { skill: string; score: string }[] }[];
    postgraduate: { testName: string; minScore?: string; skillScores?: { skill: string; score: string }[] }[];
  };
  // Medium of Instruction (MOI) letters accepted in place of a formal English test — postgraduate
  // only, since it depends on the applicant's own undergraduate degree having been taught in
  // English. `moiAcceptedUniversities` names exactly which home universities' MOI letters qualify
  // — kept as a controlled list (see bangladeshUniversities.ts) rather than free text, since exact,
  // consistent names matter once this is used to match a student's own university against it.
  moiAccepted?: boolean;
  moiAcceptedUniversities?: string[];
  // The university's own English test, run in place of IELTS/TOEFL/etc. — offered to both
  // Undergraduate and Postgraduate applicants alike, unlike MOI above.
  internalEnglishTestOffered?: boolean;
  internalEnglishTestFree?: boolean;
  internalEnglishTestFee?: number;
  accreditations: string[];
  scholarshipsAvailable: boolean;
  // Named scholarships this university offers, each with its own award amount and eligibility
  // note — optional detail beyond the plain `scholarshipsAvailable` flag above, e.g. "Vice-
  // Chancellor's Excellence Scholarship — up to $10,000 — for students with a GPA of 3.7+".
  scholarships?: { name: string; amount: string; description?: string }[];
  // The intake currently open for applications, e.g. "September 2026" — distinct from `intakes`,
  // which lists every intake session the university runs each year.
  openIntake: string;
  // Per-month open/closed status for every month in `intakes` — lets a university mark more than
  // one intake open at once even though `openIntake` (above) only ever displays the first for
  // backward compatibility with pages that show a single "currently open" value.
  intakeStatus?: Record<string, boolean>;
  // Key dates for each offered intake month, keyed the same way as `intakeStatus` — the last day
  // to submit an application, the last day to request a CAS/CoE, and the date study formally
  // begins. All optional since not every intake has every date confirmed yet.
  intakeDates?: Record<string, { applicationDeadline?: string; casRequestDeadline?: string; enrollmentDate?: string }>;
  // Official public domain, e.g. "manchester.ac.uk" — no scheme/path.
  website: string;
  tone: "violet" | "amber" | "teal" | "rose";
  // Uploaded via Data Management (data: URL — base64-embedded, small files only, same as
  // countryRegistry.ts's RequiredDocument sample uploads). `tone`'s SkylineArt/initials badge is
  // the fallback everywhere these are absent, so both stay optional rather than required.
  logoUrl?: string;
  coverPhotoUrl?: string;
}
