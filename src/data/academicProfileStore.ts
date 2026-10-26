import { CURRENT_STUDENT_ID } from "./mockData";
import { getServerSection, putServerSection } from "./profileSync";

export interface AcademicLevelEntry {
  level: string;
  institution: string;
  board?: string;
  group?: string;
  major?: string;
  grade?: string;
  passingYear?: string;
}

const STORAGE_PREFIX = "sd-academic-levels:";

export function loadAcademicLevels(studentId: string = CURRENT_STUDENT_ID): AcademicLevelEntry[] {
  const fromServer = getServerSection<AcademicLevelEntry[]>(studentId, "academic");
  if (fromServer !== undefined) return fromServer;
  const fallback: AcademicLevelEntry[] = [];
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + studentId);
    return raw ? (JSON.parse(raw) as AcademicLevelEntry[]) : fallback;
  } catch {
    return fallback;
  }
}

export function saveAcademicLevels(entries: AcademicLevelEntry[], studentId: string = CURRENT_STUDENT_ID) {
  putServerSection(studentId, "academic", entries);
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + studentId, JSON.stringify(entries));
}
