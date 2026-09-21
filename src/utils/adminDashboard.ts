// Data behind the admin Dashboard (features/admin/Dashboard.tsx) — groups the 24-value AppStatus
// enum into the six coarse "journey" stages the dashboard reasons in, and derives every number
// the page shows (stat cards, funnel, issues, average stage times, at-risk rows) from the real
// applications/students caches rather than any seeded figures.
import type { Application, AppStatus, Student } from "../types";

export type JourneyStage = "prepare" | "submit" | "review" | "offer" | "visa" | "enrolment";

export const JOURNEY_STAGES: { key: JourneyStage; label: string }[] = [
  { key: "prepare", label: "Prepare" },
  { key: "submit", label: "Submit" },
  { key: "review", label: "University Review" },
  { key: "offer", label: "Offer" },
  { key: "visa", label: "Visa" },
  { key: "enrolment", label: "Enrolment" },
];

const STAGE_OF: Record<AppStatus, JourneyStage | "terminal"> = {
  "Draft": "prepare",
  "Profile Incomplete": "prepare",
  "Documents Pending": "prepare",
  "Ready for Review": "prepare",
  "Eligibility Review": "prepare",
  "Application Preparing": "prepare",
  "Ready to Submit": "submit",
  "Submitted": "review",
  "University Review": "review",
  "Additional Documents Requested": "review",
  "Offer Received": "offer",
  "Offer Conditions Pending": "offer",
  "Deposit Pending": "offer",
  "Deposit Paid": "visa",
  "CAS/COE Pending": "visa",
  "CAS/COE Issued": "visa",
  "Visa Preparation": "visa",
  "Visa Submitted": "visa",
  "Visa Decision": "visa",
  "Enrolled": "enrolment",
  "Deferred": "terminal",
  "Withdrawn": "terminal",
  "Rejected": "terminal",
  "Compliance Hold": "terminal",
};

const STAGE_INDEX: Record<JourneyStage, number> = { prepare: 0, submit: 1, review: 2, offer: 3, visa: 4, enrolment: 5 };

export function journeyStageOf(a: Application): JourneyStage | "terminal" {
  return STAGE_OF[a.status] ?? "prepare";
}

/** 0–5 position on the six-dot timeline; terminal statuses sit wherever they stalled (treated as
 * the prepare stage since we can't know), which the row's tone then marks red. */
export function journeyIndexOf(a: Application): number {
  const stage = journeyStageOf(a);
  return stage === "terminal" ? 0 : STAGE_INDEX[stage];
}

export function isTerminal(a: Application): boolean {
  return journeyStageOf(a) === "terminal";
}

export const NOT_SUBMITTED: AppStatus[] = ["Draft", "Profile Incomplete", "Documents Pending", "Ready for Review", "Eligibility Review", "Application Preparing", "Ready to Submit"];
export const AWAITING_OFFER: AppStatus[] = ["Submitted", "University Review", "Additional Documents Requested"];
export const OFFER_STAGE: AppStatus[] = ["Offer Received", "Offer Conditions Pending"];
export const READY_FOR_VISA: AppStatus[] = ["Deposit Paid", "CAS/COE Pending", "CAS/COE Issued", "Visa Preparation"];
export const MISSING_DOCUMENTS: AppStatus[] = ["Documents Pending", "Additional Documents Requested"];

const DAY_MS = 24 * 60 * 60 * 1000;

export function daysSince(iso: string | undefined, now = Date.now()): number {
  if (!iso) return 0;
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return 0;
  return Math.max(0, Math.floor((now - t) / DAY_MS));
}

/** How long the application has been sitting in its current status. */
export function daysInStage(a: Application, now = Date.now()): number {
  return daysSince(a.updatedAt, now);
}

export const STALE_DAYS = 7;

export function isStale(a: Application, now = Date.now()): boolean {
  return daysInStage(a, now) > STALE_DAYS;
}

export function noOfferYet(a: Application, now = Date.now()): boolean {
  return AWAITING_OFFER.includes(a.status) && isStale(a, now);
}

export function isMissingDocuments(a: Application): boolean {
  return MISSING_DOCUMENTS.includes(a.status);
}

/** "At risk" = something an admin should look at today: stalled past the threshold, waiting on
 * the student with nothing moving, flagged compliance-side, or the student themselves is flagged. */
export function isAtRisk(a: Application, student: Student | undefined, now = Date.now()): boolean {
  if (a.status === "Compliance Hold" || a.status === "Rejected") return true;
  if (student?.riskFlag === "high") return true;
  if (isTerminal(a) || a.status === "Enrolled") return false;
  return isStale(a, now) || isMissingDocuments(a);
}

export function isRecentProgress(a: Application, now = Date.now()): boolean {
  return daysInStage(a, now) <= STALE_DAYS && !isTerminal(a);
}

export interface DashboardStats {
  notSubmitted: number;
  // Distinct students behind those applications — the card headline says "students".
  notSubmittedStudents: number;
  noOfferYet: number;
  offerReceived: number;
  readyForVisa: number;
}

export function computeStats(apps: Application[], now = Date.now()): DashboardStats {
  const notSubmitted = apps.filter((a) => NOT_SUBMITTED.includes(a.status));
  return {
    notSubmitted: notSubmitted.length,
    notSubmittedStudents: new Set(notSubmitted.map((a) => a.studentId)).size,
    noOfferYet: apps.filter((a) => noOfferYet(a, now)).length,
    offerReceived: apps.filter((a) => OFFER_STAGE.includes(a.status)).length,
    readyForVisa: apps.filter((a) => READY_FOR_VISA.includes(a.status)).length,
  };
}

export interface FunnelStep {
  label: string;
  count: number;
}

/** Cumulative: each step counts every application that has reached at least that stage, so the
 * bars only ever narrow going down. */
export function computeFunnel(apps: Application[]): FunnelStep[] {
  const live = apps.filter((a) => !isTerminal(a));
  const reached = (min: number) => live.filter((a) => journeyIndexOf(a) >= min).length;
  return [
    { label: "Interested", count: apps.length },
    { label: "Documents Ready", count: live.filter((a) => journeyIndexOf(a) >= 1 || ["Ready for Review", "Eligibility Review", "Application Preparing"].includes(a.status)).length },
    { label: "Submitted", count: reached(2) },
    { label: "Offer Received", count: reached(3) },
    { label: "Visa Applied", count: live.filter((a) => journeyIndexOf(a) >= 5 || ["Visa Submitted", "Visa Decision"].includes(a.status)).length },
    { label: "Enrolled", count: reached(5) },
  ];
}

export type IssueKey = "notSubmitted" | "noOffer" | "missingDocs" | "awaitingUniversity" | "paymentPending";

export interface Issue {
  key: IssueKey;
  label: string;
  count: number;
}

export function computeIssues(apps: Application[], now = Date.now()): Issue[] {
  return [
    { key: "notSubmitted", label: "Applications not submitted", count: apps.filter((a) => NOT_SUBMITTED.includes(a.status)).length },
    { key: "noOffer", label: `No offer after ${STALE_DAYS} days`, count: apps.filter((a) => noOfferYet(a, now)).length },
    { key: "missingDocs", label: "Missing documents", count: apps.filter(isMissingDocuments).length },
    { key: "awaitingUniversity", label: "University awaiting response", count: apps.filter((a) => a.status === "University Review").length },
    { key: "paymentPending", label: "Payment pending", count: apps.filter((a) => a.status === "Deposit Pending").length },
  ];
}

/** Average days the applications currently in each journey stage have been there — the closest
 * honest read on "how long does each step take" without a full status history (the client only
 * has each application's current status + last-changed time, see applicationsStore.ts's
 * getStatusHistory). Stages with nothing in them come back null so the UI can show "—". */
export function computeStageAverages(apps: Application[], now = Date.now()): Record<JourneyStage, number | null> {
  const buckets: Record<JourneyStage, number[]> = { prepare: [], submit: [], review: [], offer: [], visa: [], enrolment: [] };
  for (const a of apps) {
    const stage = journeyStageOf(a);
    if (stage === "terminal") continue;
    buckets[stage].push(daysInStage(a, now));
  }
  const out = {} as Record<JourneyStage, number | null>;
  for (const key of Object.keys(buckets) as JourneyStage[]) {
    const xs = buckets[key];
    out[key] = xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null;
  }
  return out;
}

/** Average days from creation to reaching the offer stage (or beyond), over applications that
 * carry a real `createdAt` (seeded rows don't — see the Application type). */
export function computeAverageOfferDays(apps: Application[], now = Date.now()): number | null {
  const xs = apps
    .filter((a) => journeyIndexOf(a) >= 3 && !isTerminal(a) && a.createdAt)
    .map((a) => Math.max(0, (new Date(a.updatedAt).getTime() - new Date(a.createdAt!).getTime()) / DAY_MS))
    .filter((d) => !Number.isNaN(d));
  void now;
  return xs.length ? Math.round(xs.reduce((s, x) => s + x, 0) / xs.length) : null;
}

/** Monthly series of that same average over the trailing six months, for the sparkline. A month
 * with no offers is null — the chart skips it rather than inventing a value. */
export function computeOfferTrend(apps: Application[], now = Date.now(), months = 6): (number | null)[] {
  const series: (number | null)[] = [];
  const start = new Date(now);
  start.setDate(1);
  start.setHours(0, 0, 0, 0);
  for (let i = months - 1; i >= 0; i--) {
    const from = new Date(start.getFullYear(), start.getMonth() - i, 1).getTime();
    const to = new Date(start.getFullYear(), start.getMonth() - i + 1, 1).getTime();
    const inMonth = apps.filter((a) => {
      const t = new Date(a.updatedAt).getTime();
      return t >= from && t < to;
    });
    series.push(computeAverageOfferDays(inMonth, now));
  }
  return series;
}

export type DateRangeKey = "thisMonth" | "lastMonth" | "last30" | "last90" | "thisYear" | "all";

export const DATE_RANGE_OPTIONS: { key: DateRangeKey; label: string }[] = [
  { key: "thisMonth", label: "This month" },
  { key: "lastMonth", label: "Last month" },
  { key: "last30", label: "Last 30 days" },
  { key: "last90", label: "Last 90 days" },
  { key: "thisYear", label: "This year" },
  { key: "all", label: "All time" },
];

export interface DateRange {
  from: Date | null;
  to: Date | null;
}

export function resolveDateRange(key: DateRangeKey, now = new Date()): DateRange {
  const y = now.getFullYear();
  const m = now.getMonth();
  const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
  switch (key) {
    case "thisMonth": return { from: new Date(y, m, 1), to: endOfDay(new Date(y, m + 1, 0)) };
    case "lastMonth": return { from: new Date(y, m - 1, 1), to: endOfDay(new Date(y, m, 0)) };
    case "last30": return { from: new Date(now.getTime() - 30 * DAY_MS), to: endOfDay(now) };
    case "last90": return { from: new Date(now.getTime() - 90 * DAY_MS), to: endOfDay(now) };
    case "thisYear": return { from: new Date(y, 0, 1), to: endOfDay(new Date(y, 11, 31)) };
    default: return { from: null, to: null };
  }
}

const RANGE_FMT = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" });

export function formatDateRange(range: DateRange): string {
  if (!range.from || !range.to) return "All time";
  return `${RANGE_FMT.format(range.from)} - ${RANGE_FMT.format(range.to)}`;
}

/** Applications with activity inside the range — `updatedAt` moves on every status change, so
 * this is "what was worked on in the period", which is what an operations view wants. */
export function inDateRange(a: Application, range: DateRange): boolean {
  if (!range.from || !range.to) return true;
  const t = parseLocalDate(a.updatedAt).getTime();
  return t >= range.from.getTime() && t <= range.to.getTime();
}

/** `YYYY-MM-DD` is parsed by `new Date()` as UTC midnight, which west of UTC lands on the
 * previous local day and drops the 1st of the month out of "This month"; a date-only string is
 * read as local midnight instead, matching how resolveDateRange builds its bounds. */
function parseLocalDate(iso: string): Date {
  const m = /^(d{4})-(d{2})-(d{2})$/.exec(iso);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(iso);
}

/** Human-readable application number — mirrors displayId.ts's APP-0001 but in the #APP-2026-001
 * form the dashboard design uses; derived from the same sequence so both stay in step. */
export function dashboardAppId(formatted: string, a: Application): string {
  const seq = formatted.replace(/^APP-/, "");
  const year = new Date(a.createdAt ?? a.updatedAt).getFullYear() || new Date().getFullYear();
  return `#APP-${year}-${seq.slice(-3)}`;
}
