import { UNIVERSITIES, DOCUMENTS } from "../data/mockData";
import { getAllApplications } from "../data/applicationsStore";
import { loadUploadedDocs } from "../data/applicationDocsStore";
import { buildChecklist, buildCoreChecklist } from "./documentChecklist";
import type { AppStatus } from "../types";

// Fixed to the demo counsellor account — there's no auth backend, mirrors how the student side
// is fixed to CURRENT_STUDENT_ID.
export const COUNSELLOR_ID = "c1";

export const CLOSED_STATUSES = new Set(["Withdrawn", "Rejected", "Deferred"]);

export function activeApplicationsFor(studentId: string) {
  return getAllApplications().filter((a) => a.studentId === studentId && !CLOSED_STATUSES.has(a.status));
}

export function missingDocsCountFor(studentId: string): number {
  let count = buildCoreChecklist(studentId).filter((r) => !r.own).length;
  activeApplicationsFor(studentId).forEach((app) => {
    const university = UNIVERSITIES.find((u) => u.name === app.university);
    if (!university) return;
    const docs = [
      ...DOCUMENTS.filter((d) => d.studentId === studentId && d.applicationId === app.id),
      ...loadUploadedDocs(app.id),
    ];
    count += buildChecklist(university, studentId, app.id, docs).filter((r) => !r.own && !r.reused).length;
  });
  return count;
}

/** Total checklist rows vs. how many are fulfilled (own or reused), across core + every active
 * application's requirements — the raw numbers behind a completion-rate report. */
export function docCompletionFor(studentId: string): { total: number; fulfilled: number } {
  const core = buildCoreChecklist(studentId);
  let total = core.length;
  let fulfilled = core.filter((r) => r.own).length;
  activeApplicationsFor(studentId).forEach((app) => {
    const university = UNIVERSITIES.find((u) => u.name === app.university);
    if (!university) return;
    const docs = [
      ...DOCUMENTS.filter((d) => d.studentId === studentId && d.applicationId === app.id),
      ...loadUploadedDocs(app.id),
    ];
    const rows = buildChecklist(university, studentId, app.id, docs);
    total += rows.length;
    fulfilled += rows.filter((r) => r.own || r.reused).length;
  });
  return { total, fulfilled };
}

export type PipelineBucket = "Documents" | "Under Review" | "Offer Received" | "Visa Process" | "Enrolled";

const DOC_STATUSES = new Set<AppStatus>([
  "Draft", "Profile Incomplete", "Documents Pending", "Additional Documents Requested",
  "Application Preparing", "Ready to Submit", "Ready for Review", "Eligibility Review",
]);
const REVIEW_STATUSES = new Set<AppStatus>(["Submitted", "University Review", "Compliance Hold"]);
const OFFER_STATUSES = new Set<AppStatus>(["Offer Received", "Offer Conditions Pending", "Deposit Pending", "Deposit Paid"]);
const VISA_STATUSES = new Set<AppStatus>(["CAS/COE Pending", "CAS/COE Issued", "Visa Preparation", "Visa Submitted", "Visa Decision"]);

export function pipelineBucketFor(status: AppStatus): PipelineBucket | null {
  if (DOC_STATUSES.has(status)) return "Documents";
  if (REVIEW_STATUSES.has(status)) return "Under Review";
  if (OFFER_STATUSES.has(status)) return "Offer Received";
  if (VISA_STATUSES.has(status)) return "Visa Process";
  if (status === "Enrolled") return "Enrolled";
  return null;
}

export const VISA_BUCKET_STATUSES = VISA_STATUSES;
