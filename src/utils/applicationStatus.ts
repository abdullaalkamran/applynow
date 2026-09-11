import type { AppStatus, Application } from "../types";

// Every value AppStatus can take, in the order an application would typically move through it —
// the full option list for a staff-side "change status" control.
export const ALL_APP_STATUSES: AppStatus[] = [
  "Draft", "Profile Incomplete", "Documents Pending", "Ready for Review", "Eligibility Review",
  "Application Preparing", "Ready to Submit", "Submitted", "University Review", "Additional Documents Requested",
  "Offer Received", "Offer Conditions Pending", "Deposit Pending", "Deposit Paid",
  "CAS/COE Pending", "CAS/COE Issued", "Visa Preparation", "Visa Submitted", "Visa Decision",
  "Enrolled", "Deferred", "Withdrawn", "Rejected", "Compliance Hold",
];

export type StatusTone = "blue" | "green" | "amber" | "rose";

export function applicationStatusTone(status: string): StatusTone {
  const s = status.toLowerCase();
  if (s.includes("offer") || s.includes("deposit paid")) return "green";
  if (s.includes("hold") || s.includes("rejected")) return "rose";
  if (s.includes("pending") || s.includes("requested")) return "amber";
  return "blue";
}

// Shared 7-stage application pipeline — used by both the Application Detail timeline and the
// Dashboard's compact "Current Application" stepper, so they never fall out of sync.
export const APPLICATION_STAGES = ["Application Submitted", "Documents Verified", "Under Review", "Offer", "Acceptance", "CAS", "Visa Application"];

/** Index of the stage currently in progress (stages before it read as done). */
export function applicationStageIndex(status: AppStatus): number {
  if (["Draft", "Profile Incomplete", "Ready for Review", "Eligibility Review", "Application Preparing", "Ready to Submit"].includes(status)) return 0;
  if (["Submitted", "Documents Pending"].includes(status)) return 1;
  if (["University Review", "Additional Documents Requested"].includes(status)) return 2;
  if (["Offer Received", "Offer Conditions Pending"].includes(status)) return 3;
  if (["Deposit Pending", "Deposit Paid"].includes(status)) return 4;
  if (["CAS/COE Pending", "CAS/COE Issued"].includes(status)) return 5;
  if (["Visa Preparation", "Visa Submitted", "Visa Decision"].includes(status)) return 6;
  if (status === "Enrolled") return APPLICATION_STAGES.length;
  return 2;
}

export type ApplicationBucket = "inProgress" | "offer" | "completed";

/** Coarse bucket used to summarise an application for list filters and dashboard counters. */
export function applicationBucket(status: Application["status"]): ApplicationBucket {
  if (status === "Enrolled") return "completed";
  if (status === "Offer Received" || status === "Offer Conditions Pending") return "offer";
  return "inProgress";
}
