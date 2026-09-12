// An agent manages many students at once, so "shortlist" can't be the single personal list the
// student app uses (data/shortlistStore.ts) — it has to say *which student* a program was
// shortlisted for. Keyed per student, so the same program can be shortlisted for several students
// independently, and each student's own shortlist survives regardless of what the agent does for
// anyone else's.

export interface ShortlistedProgram {
  universityId: string;
  universityName: string;
  courseName: string;
  addedAt: string;
}

const STORAGE_PREFIX = "agent-shortlist:";

function loadRaw(studentId: string): ShortlistedProgram[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + studentId);
    return raw ? (JSON.parse(raw) as ShortlistedProgram[]) : [];
  } catch {
    return [];
  }
}

function saveRaw(studentId: string, list: ShortlistedProgram[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + studentId, JSON.stringify(list));
}

export function loadShortlistFor(studentId: string): ShortlistedProgram[] {
  return loadRaw(studentId);
}

export function isShortlistedFor(studentId: string, universityId: string, courseName: string): boolean {
  return loadRaw(studentId).some((p) => p.universityId === universityId && p.courseName === courseName);
}

/** Adds/removes the program for one student and returns the new shortlisted state. */
export function toggleShortlistFor(studentId: string, universityId: string, universityName: string, courseName: string): boolean {
  const list = loadRaw(studentId);
  const idx = list.findIndex((p) => p.universityId === universityId && p.courseName === courseName);
  if (idx >= 0) {
    list.splice(idx, 1);
    saveRaw(studentId, list);
    return false;
  }
  list.push({ universityId, universityName, courseName, addedAt: new Date().toISOString().slice(0, 10) });
  saveRaw(studentId, list);
  return true;
}

export function removeShortlistFor(studentId: string, universityId: string, courseName: string) {
  saveRaw(studentId, loadRaw(studentId).filter((p) => !(p.universityId === universityId && p.courseName === courseName)));
}

/** How many of the given students currently have this exact program shortlisted — enough to show
 * a filled/counted bookmark on a shared browse view without knowing which student is "current". */
export function shortlistedStudentCountFor(students: { id: string }[], universityId: string, courseName: string): number {
  return students.filter((s) => isShortlistedFor(s.id, universityId, courseName)).length;
}
