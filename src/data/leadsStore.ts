// A "lead" is not its own record — it's simply a Student account that's been created on the
// website (possibly with some profile progress) but has never submitted an application. As soon
// as that account gets its first application, it naturally drops off this list on its own; there's
// no separate "convert" step because the account was always real.

import { loadAssignedStudents } from "./counsellorStudentsStore";
import { getAllApplications } from "./applicationsStore";
import type { LeadFollowUpStatus, Student } from "../types";

const STATUS_KEY = "sd-lead-followup-status";

function loadStatusMap(): Record<string, LeadFollowUpStatus> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(STATUS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, LeadFollowUpStatus>) : {};
  } catch {
    return {};
  }
}

function saveStatusMap(map: Record<string, LeadFollowUpStatus>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STATUS_KEY, JSON.stringify(map));
}

/** Every assigned student who has never submitted an application. */
export function loadLeads(): Student[] {
  const applicantIds = new Set(getAllApplications().map((a) => a.studentId));
  return loadAssignedStudents().filter((s) => !applicantIds.has(s.id));
}

export function loadLeadFollowUpStatus(studentId: string): LeadFollowUpStatus {
  return loadStatusMap()[studentId] ?? "New";
}

export function setLeadFollowUpStatus(studentId: string, status: LeadFollowUpStatus) {
  const map = loadStatusMap();
  map[studentId] = status;
  saveStatusMap(map);
}
