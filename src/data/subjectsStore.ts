// The subject/field-of-study taxonomy — seeded from FIELDS_OF_STUDY plus anything Data Management
// adds. Kept live (not a frozen array) so a newly added subject immediately becomes selectable
// everywhere a subject is picked: the university form's own checklist, student/agent filters, and
// the student profile's preferred-fields step.

import { FIELDS_OF_STUDY } from "./fields";

const STORAGE_KEY = "data-mgmt-custom-subjects";

function loadCustom(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as string[]) : [];
  } catch {
    return [];
  }
}

function saveCustom(list: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
}

export function getAllSubjects(): string[] {
  return [...FIELDS_OF_STUDY, ...loadCustom()];
}

/** Adds a new subject to the taxonomy — returns false without changing anything if it's blank or
 * already exists (case-insensitively), so callers can tell the difference from a real addition. */
export function addSubject(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (getAllSubjects().some((s) => s.toLowerCase() === trimmed.toLowerCase())) return false;
  saveCustom([...loadCustom(), trimmed]);
  return true;
}
