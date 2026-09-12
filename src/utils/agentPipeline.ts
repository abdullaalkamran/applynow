import type { AppStatus } from "../types";

// The agent portal's 5-stage pipeline — coarser than the full AppStatus lifecycle, matching how
// a B2B agent thinks about a case: has this enquiry become an application yet, is the university
// reviewing it, is there an offer, are they now working through their visa.
export type AgentStage = "Enquiry" | "Application" | "Under Review" | "Offer" | "Visa";
export const AGENT_STAGES: AgentStage[] = ["Enquiry", "Application", "Under Review", "Offer", "Visa"];

const APPLICATION_STATUSES = new Set<AppStatus>([
  "Draft", "Profile Incomplete", "Documents Pending", "Application Preparing", "Ready to Submit", "Ready for Review", "Eligibility Review",
]);
const UNDER_REVIEW_STATUSES = new Set<AppStatus>(["Submitted", "University Review", "Additional Documents Requested", "Compliance Hold"]);
const OFFER_STATUSES = new Set<AppStatus>(["Offer Received", "Offer Conditions Pending", "Deposit Pending", "Deposit Paid"]);
const VISA_STATUSES = new Set<AppStatus>(["CAS/COE Pending", "CAS/COE Issued", "Visa Preparation", "Visa Submitted", "Visa Decision"]);

/** Which pipeline column an application's status belongs in — `null` for closed/terminal
 * statuses (Enrolled, Withdrawn, Rejected, Deferred), which drop off the active pipeline. */
export function agentStageFor(status: AppStatus): AgentStage | null {
  if (APPLICATION_STATUSES.has(status)) return "Application";
  if (UNDER_REVIEW_STATUSES.has(status)) return "Under Review";
  if (OFFER_STATUSES.has(status)) return "Offer";
  if (VISA_STATUSES.has(status)) return "Visa";
  return null;
}

export const VISA_STAGE_STATUSES = VISA_STATUSES;
export const OFFER_STAGE_STATUSES = OFFER_STATUSES;
