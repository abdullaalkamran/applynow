import type { DocumentItem, RoleMeta } from "../types";

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

// A live binding, not a frozen constant: every module that imports `CURRENT_STUDENT_ID` (as a
// default parameter value or read inline) sees the *current* value on each read, per ES module
// semantics — so calling `setCurrentStudentId` once, from AuthContext.tsx whenever a real student
// session is established, is enough to make every one of those call sites resolve to whoever's
// actually logged in, with no changes needed at each of them. Empty until a student session exists
// (there's no student page reachable pre-login anyway).
export let CURRENT_STUDENT_ID = "";
export function setCurrentStudentId(id: string) {
  CURRENT_STUDENT_ID = id;
}

export function stages(currentIdx: number, blockedIdx: number | null = null) {
  const labels = ["Profile", "Documents", "Application", "Decision", "Acceptance", "Visa", "Enrolment"];
  return labels.map((label, i) => ({
    key: label.toLowerCase(),
    label,
    status: (blockedIdx === i ? "blocked" : i < currentIdx ? "done" : i === currentIdx ? "current" : "upcoming") as any,
  }));
}

// No seeded documents: every document is a real row from /api/documents (see applicationDocsStore.ts / coreDocsStore.ts).
export const DOCUMENTS: DocumentItem[] = [];

// Live binding, same mechanism as CURRENT_STUDENT_ID above — set from AuthContext.tsx whenever an
// agent session is established, so every agent page resolves to whoever is actually logged in
// instead of the seeded demo agent.
export let CURRENT_AGENT_ID = "";
export function setCurrentAgentId(id: string) {
  CURRENT_AGENT_ID = id;
}
