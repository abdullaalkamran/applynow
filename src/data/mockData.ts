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
  { id: "s6", name: "Amara Chukwu", email: "amara.chukwu@example.com", country: "Nigeria", counsellorId: "c1", avatarColor: "bg-indigo-500", riskFlag: "none" },
  { id: "s7", name: "Carlos Mendes", email: "carlos.mendes@example.com", country: "Brazil", counsellorId: "c1", avatarColor: "bg-teal-500", riskFlag: "none" },
];

export const CURRENT_STUDENT_ID = "s1";

export const COUNSELLORS: SupportContact[] = [
  { id: "c1", name: "Maria Fernandez", role: "Study Counsellor", phone: "+44 7700 900123", avatarColor: "bg-sky-500" },
  { id: "c2", name: "David Osei", role: "Study Counsellor", phone: "+44 7700 900456", avatarColor: "bg-emerald-500" },
];

export const AGENTS: SupportContact[] = [
  { id: "a1", name: "Rafiq Hossain", role: "Education Agent", organization: "Global Pathways Consultants", phone: "+880 1811-223344", avatarColor: "bg-amber-500" },
  { id: "a2", name: "Nusrat Jahan", role: "Education Agent", organization: "BrightFuture Education", phone: "+880 1911-556677", avatarColor: "bg-violet-500" },
];

// Pooled review-team roles (not assigned 1:1 per student like Counsellor/Agent) — whoever is
// currently handling submission and compliance review across applications.
export const ADMISSION_OFFICERS: SupportContact[] = [
  { id: "ad1", name: "Aisha Rahman", role: "Admission Officer", phone: "+44 7700 900654", avatarColor: "bg-indigo-500" },
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

export const APPLICATIONS: Application[] = [
  {
    id: "app1", studentId: "s1", university: "University of Manchester", course: "MSc Data Science",
    intake: "Jan 2027", country: "UK", status: "University Review", progress: 62, nextAction: "Awaiting university decision",
    waitingOn: "university", stages: stages(3), updatedAt: "2026-09-02",
  },
  {
    id: "app2", studentId: "s1", university: "University of Melbourne", course: "Master of Data Science",
    intake: "Feb 2027", country: "Australia", status: "Documents Pending", progress: 28, nextAction: "Upload bank statement",
    waitingOn: "student", stages: stages(1), updatedAt: "2026-09-05",
  },
  {
    id: "app3", studentId: "s2", university: "University of Toronto", course: "MBA",
    intake: "Sep 2027", country: "Canada", status: "Additional Documents Requested", progress: 45, nextAction: "Submit updated IELTS score",
    waitingOn: "student", stages: stages(2), updatedAt: "2026-09-01",
  },
  {
    id: "app4", studentId: "s3", university: "University of Auckland", course: "MSc Data Science",
    intake: "Jul 2027", country: "New Zealand", status: "Offer Received", progress: 78, nextAction: "Accept offer & pay deposit",
    waitingOn: "student", stages: stages(4), updatedAt: "2026-08-28",
  },
  {
    id: "app5", studentId: "s4", university: "University of Leeds", course: "BSc Business",
    intake: "Jan 2027", country: "UK", status: "Compliance Hold", progress: 38, nextAction: "Compliance review of financial documents",
    waitingOn: "staff", stages: stages(1, 1), updatedAt: "2026-09-06",
  },
  {
    id: "app6", studentId: "s5", university: "University of Melbourne", course: "MSc Finance",
    intake: "Feb 2027", country: "Australia", status: "Deposit Paid", progress: 88, nextAction: "Awaiting CAS/COE issuance",
    waitingOn: "university", stages: stages(5), updatedAt: "2026-09-04",
  },
];

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

export const CURRENT_AGENT_ID = "a1";

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

export const UNIVERSITIES: University[] = [
  {
    id: "u1", name: "University of Manchester", city: "Manchester", country: "UK",
    tags: ["Top 30 Global", "Research Intensive"],
    subjects: ["Computer Science & IT", "Data Science & AI", "Social Sciences"],
    intakes: ["September", "January"],
    worldRank: "#32", employability: "93%", studentCount: "40,000+",
    description: "A world-class university known for its research, innovation and diverse community.",
    highlights: ["Global recognition", "Wide range of scholarships", "Vibrant student life", "Excellent career support"],
    courses: [
      { name: "MSc Data Science", level: "Postgraduate", duration: "1 year", subject: "Data Science & AI", feeUSD: 35000 },
      { name: "MSc Computer Science", level: "Postgraduate", duration: "1 year", subject: "Computer Science & IT", feeUSD: 33500 },
      { name: "BSc Economics", level: "Undergraduate", duration: "3 years", subject: "Social Sciences", feeUSD: 24500 },
    ],
    requirements: ["Bachelor's degree, 2:1 or equivalent", "IELTS 6.5 overall, no band below 6.0", "Statement of purpose", "Two academic references"],
    fees: [{ label: "Tuition Fee", amount: 26500 }, { label: "Accommodation", amount: 8000 }, { label: "Living Expenses", amount: 9000 }, { label: "Travel", amount: 1200 }, { label: "Visa & Insurance", amount: 1500 }],
    currencySymbol: "£",
    minIELTS: 6.5,
    minGPA: 3.3,
    accreditations: ["Russell Group"],
    scholarshipsAvailable: true,
    openIntake: "September 2026",
    website: "manchester.ac.uk",
    tone: "violet",
  },
  {
    id: "u2", name: "King's College London", city: "London", country: "UK",
    tags: ["Top 40 Global", "High Employability"],
    subjects: ["Business & Management", "Law"],
    intakes: ["September", "January"],
    worldRank: "#40", employability: "95%", studentCount: "31,000+",
    description: "One of the UK's most prestigious universities, at the heart of London.",
    highlights: ["Central London campus", "Strong alumni network", "Award-winning research", "High graduate employability"],
    courses: [
      { name: "MSc International Management", level: "Postgraduate", duration: "1 year", subject: "Business & Management", feeUSD: 39000 },
      { name: "LLM Law", level: "Postgraduate", duration: "1 year", subject: "Law", feeUSD: 40500 },
    ],
    requirements: ["Bachelor's degree, 2:1 or equivalent", "IELTS 7.0 overall, no band below 6.5", "Statement of purpose"],
    fees: [{ label: "Tuition Fee", amount: 29800 }, { label: "Accommodation", amount: 11500 }, { label: "Living Expenses", amount: 10200 }, { label: "Travel", amount: 1200 }, { label: "Visa & Insurance", amount: 1500 }],
    currencySymbol: "£",
    minIELTS: 7.0,
    minGPA: 3.3,
    accreditations: ["Russell Group"],
    scholarshipsAvailable: true,
    openIntake: "January 2027",
    website: "kcl.ac.uk",
    tone: "amber",
  },
  {
    id: "u3", name: "University of Edinburgh", city: "Edinburgh", country: "UK",
    tags: ["Top 50 Global", "Great Support"],
    subjects: ["Data Science & AI", "Engineering"],
    intakes: ["September", "January"],
    worldRank: "#22", employability: "91%", studentCount: "35,000+",
    description: "A historic, research-led university set in the heart of Scotland's capital.",
    highlights: ["Dedicated international student support", "Rich campus heritage", "Strong scholarship program", "Thriving student societies"],
    courses: [
      { name: "MSc Artificial Intelligence", level: "Postgraduate", duration: "1 year", subject: "Data Science & AI", feeUSD: 36000 },
      { name: "BEng Mechanical Engineering", level: "Undergraduate", duration: "4 years", subject: "Engineering", feeUSD: 26000 },
    ],
    requirements: ["Bachelor's degree, 2:1 or equivalent", "IELTS 6.5 overall, no band below 6.0", "Portfolio (for some courses)"],
    fees: [{ label: "Tuition Fee", amount: 27200 }, { label: "Accommodation", amount: 9200 }, { label: "Living Expenses", amount: 9500 }, { label: "Travel", amount: 1200 }, { label: "Visa & Insurance", amount: 1500 }],
    currencySymbol: "£",
    minIELTS: 6.5,
    minGPA: 3.3,
    accreditations: ["Russell Group"],
    scholarshipsAvailable: true,
    openIntake: "September 2026",
    website: "ed.ac.uk",
    tone: "teal",
  },
  {
    id: "u4", name: "University of Birmingham", city: "Birmingham", country: "UK",
    tags: ["Top 100 Global", "Diverse Community"],
    subjects: ["Business & Management", "Computer Science & IT"],
    intakes: ["September", "January"],
    worldRank: "#78", employability: "89%", studentCount: "38,000+",
    description: "A leading Russell Group university with one of the UK's most diverse student communities.",
    highlights: ["Large international student body", "Modern campus facilities", "Strong industry links", "Affordable cost of living"],
    courses: [
      { name: "MSc Business Analytics", level: "Postgraduate", duration: "1 year", subject: "Business & Management", feeUSD: 33000 },
      { name: "BSc Computer Science", level: "Undergraduate", duration: "3 years", subject: "Computer Science & IT", feeUSD: 23000 },
    ],
    requirements: ["Bachelor's degree, 2:2 or equivalent", "IELTS 6.0 overall, no band below 5.5", "Statement of purpose"],
    fees: [{ label: "Tuition Fee", amount: 24800 }, { label: "Accommodation", amount: 7500 }, { label: "Living Expenses", amount: 8800 }, { label: "Travel", amount: 1200 }, { label: "Visa & Insurance", amount: 1500 }],
    currencySymbol: "£",
    minIELTS: 6.0,
    minGPA: 3.0,
    accreditations: ["Russell Group"],
    scholarshipsAvailable: true,
    openIntake: "September 2026",
    website: "birmingham.ac.uk",
    tone: "rose",
  },
  {
    id: "u5", name: "Boston University", city: "Boston", country: "United States",
    tags: ["Top 110 Global", "Research Intensive"],
    subjects: ["Business & Management", "Data Science & AI", "Social Sciences"],
    intakes: ["September", "January"],
    worldRank: "#108", employability: "88%", studentCount: "34,000+",
    description: "A major private research university in the heart of Boston with strong industry connections.",
    highlights: ["Central Boston campus", "Extensive alumni network", "Co-op and internship programs", "Vibrant international community"],
    courses: [
      { name: "MS Business Analytics", level: "Postgraduate", duration: "1.5 years", subject: "Business & Management", feeUSD: 60000 },
      { name: "BA Economics", level: "Undergraduate", duration: "4 years", subject: "Social Sciences", feeUSD: 54000 },
    ],
    requirements: ["Bachelor's degree, GPA 3.0+", "TOEFL 90 or IELTS 6.5 overall", "Statement of purpose", "Two academic references"],
    fees: [{ label: "Tuition Fee", amount: 58000 }, { label: "Accommodation", amount: 16000 }, { label: "Living Expenses", amount: 14000 }, { label: "Travel", amount: 1500 }, { label: "Visa & Insurance", amount: 700 }],
    currencySymbol: "$",
    minIELTS: 6.5,
    minGPA: 3.0,
    accreditations: ["NEASC"],
    scholarshipsAvailable: true,
    openIntake: "September 2026",
    website: "bu.edu",
    tone: "amber",
  },
  {
    id: "u6", name: "University of Southern California", city: "Los Angeles", country: "United States",
    tags: ["Top 90 Global", "High Employability"],
    subjects: ["Computer Science & IT", "Arts & Humanities", "Business & Management"],
    intakes: ["September", "January"],
    worldRank: "#85", employability: "91%", studentCount: "47,000+",
    description: "A leading private research university known for its strong industry ties across tech and media.",
    highlights: ["Strong ties to LA's tech and entertainment industries", "Large international student body", "Extensive career services", "Renowned faculty"],
    courses: [
      { name: "MS Computer Science", level: "Postgraduate", duration: "1.5 years", subject: "Computer Science & IT", feeUSD: 66000 },
      { name: "BA Communication", level: "Undergraduate", duration: "4 years", subject: "Arts & Humanities", feeUSD: 60000 },
    ],
    requirements: ["Bachelor's degree, GPA 3.2+", "TOEFL 100 or IELTS 7.0 overall", "Statement of purpose", "Portfolio (for some programs)"],
    fees: [{ label: "Tuition Fee", amount: 64000 }, { label: "Accommodation", amount: 17000 }, { label: "Living Expenses", amount: 15000 }, { label: "Travel", amount: 1500 }, { label: "Visa & Insurance", amount: 700 }],
    currencySymbol: "$",
    minIELTS: 7.0,
    minGPA: 3.2,
    accreditations: ["WSCUC"],
    scholarshipsAvailable: false,
    openIntake: "January 2027",
    website: "usc.edu",
    tone: "violet",
  },
  {
    id: "u7", name: "University of Toronto", city: "Toronto", country: "Canada",
    tags: ["Top 25 Global", "Research Intensive"],
    subjects: ["Computer Science & IT", "Engineering", "Medicine & Health Sciences"],
    intakes: ["September", "January"],
    worldRank: "#21", employability: "92%", studentCount: "97,000+",
    description: "Canada's leading research university, known worldwide for innovation across every discipline.",
    highlights: ["World-renowned faculty", "Extensive research funding", "Large, diverse student body", "Strong co-op and internship network"],
    courses: [
      { name: "MEng Computer Engineering", level: "Postgraduate", duration: "1.5 years", subject: "Engineering", feeUSD: 35000 },
      { name: "BSc Computer Science", level: "Undergraduate", duration: "4 years", subject: "Computer Science & IT", feeUSD: 29000 },
    ],
    requirements: ["Bachelor's degree, B+ average or equivalent", "IELTS 6.5 overall, no band below 6.0", "Statement of purpose"],
    fees: [{ label: "Tuition Fee", amount: 45000 }, { label: "Accommodation", amount: 12000 }, { label: "Living Expenses", amount: 11000 }, { label: "Travel", amount: 1200 }, { label: "Visa & Insurance", amount: 235 }],
    currencySymbol: "C$",
    minIELTS: 6.5,
    minGPA: 3.3,
    accreditations: ["U15"],
    scholarshipsAvailable: true,
    openIntake: "September 2026",
    website: "utoronto.ca",
    tone: "teal",
  },
  {
    id: "u8", name: "McGill University", city: "Montreal", country: "Canada",
    tags: ["Top 30 Global", "Great Support"],
    subjects: ["Medicine & Health Sciences", "Arts & Humanities", "Law"],
    intakes: ["September", "January"],
    worldRank: "#27", employability: "90%", studentCount: "40,000+",
    description: "A historic, research-intensive university known for its beautiful Montreal campus and global outlook.",
    highlights: ["Historic downtown campus", "Strong international student support", "Renowned medical and law faculties", "Bilingual city environment"],
    courses: [
      { name: "MA Political Science", level: "Postgraduate", duration: "2 years", subject: "Arts & Humanities", feeUSD: 31000 },
      { name: "BSc Biology", level: "Undergraduate", duration: "3 years", subject: "Medicine & Health Sciences", feeUSD: 26000 },
    ],
    requirements: ["Bachelor's degree, B average or equivalent", "IELTS 6.5 overall, no band below 6.0", "Statement of purpose", "Two academic references"],
    fees: [{ label: "Tuition Fee", amount: 40000 }, { label: "Accommodation", amount: 11000 }, { label: "Living Expenses", amount: 10500 }, { label: "Travel", amount: 1200 }, { label: "Visa & Insurance", amount: 235 }],
    currencySymbol: "C$",
    minIELTS: 6.5,
    minGPA: 3.0,
    accreditations: ["U15"],
    scholarshipsAvailable: true,
    openIntake: "January 2027",
    website: "mcgill.ca",
    tone: "rose",
  },
  {
    id: "u9", name: "University of Melbourne", city: "Melbourne", country: "Australia",
    tags: ["Top 15 Global", "High Employability"],
    subjects: ["Data Science & AI", "Business & Management", "Law"],
    intakes: ["February", "July"],
    worldRank: "#14", employability: "93%", studentCount: "52,000+",
    description: "Australia's top-ranked university, known for research excellence and a large international community.",
    highlights: ["Global top-15 ranking", "Extensive scholarship program", "Vibrant campus culture", "Strong graduate outcomes"],
    courses: [
      { name: "Master of Data Science", level: "Postgraduate", duration: "2 years", subject: "Data Science & AI", feeUSD: 31000 },
      { name: "Bachelor of Commerce", level: "Undergraduate", duration: "3 years", subject: "Business & Management", feeUSD: 25000 },
    ],
    requirements: ["Bachelor's degree, distinction average or equivalent", "IELTS 6.5 overall, no band below 6.0", "Statement of purpose"],
    fees: [{ label: "Tuition Fee", amount: 45000 }, { label: "Accommodation", amount: 13000 }, { label: "Living Expenses", amount: 12000 }, { label: "Travel", amount: 1500 }, { label: "Visa & Insurance", amount: 710 }],
    currencySymbol: "A$",
    minIELTS: 6.5,
    minGPA: 3.7,
    accreditations: ["Group of Eight"],
    scholarshipsAvailable: true,
    openIntake: "February 2027",
    website: "unimelb.edu.au",
    tone: "violet",
  },
  {
    id: "u10", name: "University of Sydney", city: "Sydney", country: "Australia",
    tags: ["Top 20 Global", "Diverse Community"],
    subjects: ["Engineering", "Computer Science & IT", "Architecture"],
    intakes: ["February", "July"],
    worldRank: "#19", employability: "91%", studentCount: "73,000+",
    description: "One of Australia's oldest and most prestigious universities, with a strong global reputation.",
    highlights: ["Historic sandstone campus", "Large, diverse international community", "Strong industry partnerships", "Excellent career services"],
    courses: [
      { name: "Master of Engineering", level: "Postgraduate", duration: "2 years", subject: "Engineering", feeUSD: 32500 },
      { name: "Bachelor of Architecture", level: "Undergraduate", duration: "5 years", subject: "Architecture", feeUSD: 27000 },
    ],
    requirements: ["Bachelor's degree, credit average or equivalent", "IELTS 6.5 overall, no band below 6.0", "Portfolio (for some programs)"],
    fees: [{ label: "Tuition Fee", amount: 47000 }, { label: "Accommodation", amount: 13500 }, { label: "Living Expenses", amount: 12000 }, { label: "Travel", amount: 1500 }, { label: "Visa & Insurance", amount: 710 }],
    currencySymbol: "A$",
    minIELTS: 6.5,
    minGPA: 3.0,
    accreditations: ["Group of Eight"],
    scholarshipsAvailable: true,
    openIntake: "February 2027",
    website: "sydney.edu.au",
    tone: "amber",
  },
  {
    id: "u11", name: "Trinity College Dublin", city: "Dublin", country: "Ireland",
    tags: ["Top 100 Global", "Great Support"],
    subjects: ["Business & Management", "Arts & Humanities", "Computer Science & IT"],
    intakes: ["September", "January"],
    worldRank: "#81", employability: "89%", studentCount: "20,000+",
    description: "Ireland's oldest university, offering a historic campus in the heart of Dublin.",
    highlights: ["Historic city-centre campus", "Dedicated international student office", "Strong EU and UK industry links", "Rich cultural heritage"],
    courses: [
      { name: "MSc Business Analytics", level: "Postgraduate", duration: "1 year", subject: "Business & Management", feeUSD: 27500 },
      { name: "BA English Studies", level: "Undergraduate", duration: "4 years", subject: "Arts & Humanities", feeUSD: 21000 },
    ],
    requirements: ["Bachelor's degree, 2:1 or equivalent", "IELTS 6.5 overall, no band below 6.0", "Statement of purpose"],
    fees: [{ label: "Tuition Fee", amount: 24000 }, { label: "Accommodation", amount: 9000 }, { label: "Living Expenses", amount: 8500 }, { label: "Travel", amount: 800 }, { label: "Visa & Insurance", amount: 300 }],
    currencySymbol: "€",
    minIELTS: 6.5,
    minGPA: 3.3,
    accreditations: ["IUA"],
    scholarshipsAvailable: true,
    openIntake: "September 2026",
    website: "tcd.ie",
    tone: "teal",
  },
  {
    id: "u12", name: "Technical University of Munich", city: "Munich", country: "Germany",
    tags: ["Top 40 Global", "Research Intensive"],
    subjects: ["Engineering", "Computer Science & IT", "Data Science & AI"],
    intakes: ["October", "April"],
    worldRank: "#37", employability: "92%", studentCount: "51,000+",
    description: "One of Europe's leading technical universities, renowned for engineering and applied sciences.",
    highlights: ["Low tuition fees", "Strong industry partnerships across Europe", "Cutting-edge research facilities", "English-taught postgraduate programs"],
    courses: [
      { name: "MSc Data Engineering & Analytics", level: "Postgraduate", duration: "2 years", subject: "Data Science & AI", feeUSD: 3200 },
      { name: "BSc Mechanical Engineering", level: "Undergraduate", duration: "3 years", subject: "Engineering", feeUSD: 2800 },
    ],
    requirements: ["Bachelor's degree in a related field", "IELTS 6.5 overall, no band below 6.0", "Statement of purpose", "Relevant coursework transcript"],
    fees: [{ label: "Tuition Fee", amount: 3000 }, { label: "Accommodation", amount: 7000 }, { label: "Living Expenses", amount: 8000 }, { label: "Travel", amount: 700 }, { label: "Visa & Insurance", amount: 75 }],
    currencySymbol: "€",
    minIELTS: 6.5,
    minGPA: 3.0,
    accreditations: ["TU9"],
    scholarshipsAvailable: false,
    openIntake: "October 2026",
    website: "tum.de",
    tone: "rose",
  },
  {
    id: "u13", name: "American University of Sharjah", city: "Sharjah", country: "United Arab Emirates",
    tags: ["Top 500 Global", "Diverse Community"],
    subjects: ["Business & Management", "Engineering", "Architecture"],
    intakes: ["September", "January"],
    worldRank: "#430", employability: "85%", studentCount: "6,000+",
    description: "A leading American-style university in the UAE, drawing students from over 90 countries.",
    highlights: ["American-accredited curriculum", "Highly international student body", "Modern purpose-built campus", "Strong regional employer links"],
    courses: [
      { name: "MBA", level: "Postgraduate", duration: "2 years", subject: "Business & Management", feeUSD: 24000 },
      { name: "BSc Architecture", level: "Undergraduate", duration: "5 years", subject: "Architecture", feeUSD: 21000 },
    ],
    requirements: ["Bachelor's degree, GPA 3.0+", "IELTS 6.0 overall, no band below 5.5", "Statement of purpose"],
    fees: [{ label: "Tuition Fee", amount: 85000 }, { label: "Accommodation", amount: 25000 }, { label: "Living Expenses", amount: 20000 }, { label: "Travel", amount: 2000 }, { label: "Visa & Insurance", amount: 3000 }],
    currencySymbol: "AED ",
    minIELTS: 6.0,
    minGPA: 3.0,
    accreditations: ["MSCHE"],
    scholarshipsAvailable: true,
    openIntake: "September 2026",
    website: "aus.edu",
    tone: "violet",
  },
];

export const AUDIT_LOG: AuditLogEntry[] = [
  { id: "al1", actor: "D. Osei", role: "data", action: "Published catalog record", target: "University of Manchester", timestamp: "2026-08-01 09:12" },
  { id: "al2", actor: "R. Fernandez", role: "compliance", action: "Froze application", target: "app5 — Duy Nguyen", timestamp: "2026-09-06 14:03" },
  { id: "al3", actor: "System (AI)", role: "compliance", action: "Flagged document for anomaly review", target: "Sponsor_Bank_Statement.pdf", timestamp: "2026-09-03 08:41" },
  { id: "al4", actor: "M. Islam", role: "finance", action: "Approved commission", target: "cm3 — University of Auckland", timestamp: "2026-08-29 16:20" },
  { id: "al5", actor: "K. Patel", role: "admin", action: "Updated RBAC permission", target: "Role: Admission Officer", timestamp: "2026-08-22 11:05" },
];
