import { APPLICATIONS, stages } from "./mockData";
import type { Application, AppStatus } from "../types";

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
type ApplicationOverride = Partial<Pick<Application, "status" | "nextAction" | "waitingOn" | "updatedAt">>;
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

/** A counsellor moving an application to a new status — also lets them update the next action
 * shown to the student, since the two usually change together. */
export function updateApplicationStatus(applicationId: string, status: AppStatus, nextAction?: string) {
  const overrides = loadOverrides();
  overrides[applicationId] = {
    ...overrides[applicationId],
    status,
    ...(nextAction !== undefined ? { nextAction } : {}),
    updatedAt: new Date().toISOString().slice(0, 10),
  };
  saveOverrides(overrides);
  recordStatusChange(applicationId, status);
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
  };
  const created = loadCreated();
  created.push(application);
  saveCreated(created);
  return application;
}
