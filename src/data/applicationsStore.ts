import { APPLICATIONS, stages } from "./mockData";
import { recordActivity } from "./applicationActivityStore";
import type { Application, AppStatus, Role } from "../types";

type Actor = { id: string; role: Role; name: string };

const STORAGE_KEY = "sd-created-applications";

function loadCreated(): Application[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as Application[]) : [];
  } catch {
    return [];
  }
}

function saveCreated(apps: Application[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(apps));
}

// Staff-editable fields layered on top of an application (seeded or created) without mutating the
// static seed data directly — keyed by application id, merged in on every read.
type ApplicationOverride = Partial<Pick<Application, "status" | "nextAction" | "waitingOn" | "updatedAt" | "responsibleCounsellorId" | "responsibleAdmissionOfficerId">>;
const OVERRIDES_KEY = "sd-application-overrides";

function loadOverrides(): Record<string, ApplicationOverride> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(OVERRIDES_KEY);
    return raw ? (JSON.parse(raw) as Record<string, ApplicationOverride>) : {};
  } catch {
    return {};
  }
}

function saveOverrides(overrides: Record<string, ApplicationOverride>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(OVERRIDES_KEY, JSON.stringify(overrides));
}

/** Every application — the seeded demo set plus any the student has applied to this session,
 * with any staff-made status changes applied on top. */
export function getAllApplications(): Application[] {
  const overrides = loadOverrides();
  return [...APPLICATIONS, ...loadCreated()].map((a) => (overrides[a.id] ? { ...a, ...overrides[a.id] } : a));
}

/** A comparable "when was this actually created" number — real `createdAt` when present (every
 * app created via createApplication has one); for older seed data (which predates that field and
 * will never have it) falls back to parsing a creation order out of the id itself, so "oldest
 * first" numbering still works without needing to backfill every seed row. Seeded ids ("app1",
 * "app2"...) sort as small integers, always before any real millisecond timestamp — i.e. before
 * anything created later through the running app. */
function applicationSortKey(a: Application): number {
  if (a.createdAt) return new Date(a.createdAt).getTime();
  const seedMatch = a.id.match(/^app(\d+)$/);
  if (seedMatch) return parseInt(seedMatch[1], 10);
  const customMatch = a.id.match(/^app-custom-(\d+)$/);
  if (customMatch) return parseInt(customMatch[1], 10);
  return 0;
}

/** The same applications, oldest-created first — the ordering "application #1, #2, ..." numbering
 * should use, since progress/updatedAt change constantly and would reshuffle the numbers. */
export function sortByCreatedAscending(apps: Application[]): Application[] {
  return [...apps].sort((a, b) => applicationSortKey(a) - applicationSortKey(b));
}

/** A counsellor moving an application to a new status — also lets them update the next action
 * shown to the student, since the two usually change together. `actor` is optional (existing call
 * sites predate the activity timeline) but should be passed by any new caller so the change is
 * properly attributed in the audit log. */
export function updateApplicationStatus(applicationId: string, status: AppStatus, nextAction?: string, actor?: Actor) {
  const previousStatus = getAllApplications().find((a) => a.id === applicationId)?.status;
  const overrides = loadOverrides();
  overrides[applicationId] = {
    ...overrides[applicationId],
    status,
    ...(nextAction !== undefined ? { nextAction } : {}),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  saveOverrides(overrides);
  recordStatusChange(applicationId, status);
  if (actor) {
    recordActivity({ applicationId, action: "status_changed", oldValue: previousStatus, newValue: status, performedBy: actor });
  }
}

/** Platform-assigned responsible counsellor for this specific application. */
export function assignCounsellor(applicationId: string, counsellorId: string, actor: Actor) {
  const overrides = loadOverrides();
  const previous = overrides[applicationId]?.responsibleCounsellorId;
  overrides[applicationId] = { ...overrides[applicationId], responsibleCounsellorId: counsellorId };
  saveOverrides(overrides);
  recordActivity({ applicationId, action: "counsellor_assigned", oldValue: previous, newValue: counsellorId, performedBy: actor });
}

/** Counsellor-assigned responsible admission officer for this specific application. */
export function assignAdmissionOfficer(applicationId: string, officerId: string, actor: Actor) {
  const overrides = loadOverrides();
  const previous = overrides[applicationId]?.responsibleAdmissionOfficerId;
  overrides[applicationId] = { ...overrides[applicationId], responsibleAdmissionOfficerId: officerId };
  saveOverrides(overrides);
  recordActivity({ applicationId, action: "admission_officer_assigned", oldValue: previous, newValue: officerId, performedBy: actor });
}

export interface StatusHistoryEntry {
  status: AppStatus;
  changedAt: string;
}

const HISTORY_PREFIX = "sd-application-status-history:";

function loadRawHistory(applicationId: string): StatusHistoryEntry[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(HISTORY_PREFIX + applicationId);
    return raw ? (JSON.parse(raw) as StatusHistoryEntry[]) : [];
  } catch {
    return [];
  }
}

function recordStatusChange(applicationId: string, status: AppStatus) {
  if (typeof window === "undefined") return;
  const history = loadRawHistory(applicationId);
  history.push({ status, changedAt: new Date().toISOString().slice(0, 10) });
  window.localStorage.setItem(HISTORY_PREFIX + applicationId, JSON.stringify(history));
}

/** Full status timeline for an application — its original seeded/created status first, then every
 * real change a counsellor has made since, oldest to newest. */
export function getStatusHistory(applicationId: string): StatusHistoryEntry[] {
  const base = [...APPLICATIONS, ...loadCreated()].find((a) => a.id === applicationId);
  const seedEntry: StatusHistoryEntry[] = base ? [{ status: base.status, changedAt: base.updatedAt }] : [];
  return [...seedEntry, ...loadRawHistory(applicationId)];
}

export interface NewApplicationInput {
  studentId: string;
  university: string;
  course: string;
  intake: string;
  country: string;
  campus: string;
  // Who confirmed it — defaults to "counsellor" (the caller already knows about it). Pass
  // "student" from the student's own Apply flow so it surfaces as new on the counsellor side.
  source?: "student" | "counsellor";
}

// A freshly confirmed application starts already past Profile/Documents (the student's profile is
// assumed current) and sitting in the Application stage, awaiting the university's acknowledgement.
export function createApplication(input: NewApplicationInput): Application {
  const application: Application = {
    id: `app-custom-${Date.now()}`,
    studentId: input.studentId,
    university: input.university,
    course: input.course,
    intake: input.intake,
    country: input.country,
    campus: input.campus,
    status: "Submitted",
    progress: 15,
    nextAction: "Awaiting university confirmation of receipt",
    waitingOn: "university",
    stages: stages(2),
    updatedAt: new Date().toISOString().slice(0, 10),
    source: input.source ?? "counsellor",
    createdAt: new Date().toISOString(),
  };
  const created = loadCreated();
  created.push(application);
  saveCreated(created);
  return application;
}
