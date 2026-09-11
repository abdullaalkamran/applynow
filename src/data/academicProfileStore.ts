import { CURRENT_STUDENT_ID } from "./mockData";

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

// Seeded per assigned student so a counsellor can see real education history for anyone in their
// caseload, not just whoever happens to be signed into the student app in this demo. Sarah's
// mirrors AcademicDetails.tsx's own defaults; the others are the same realistic shape for their
// stated country. A student with no entry here (e.g. one just added via "Add New Student") has
// genuinely never recorded anything, so they correctly get an empty list rather than a fabricated one.
const SEED_LEVELS: Record<string, AcademicLevelEntry[]> = {
  s1: [
    { level: "SSC / O-Level", institution: "Dhaka Residential Model College", board: "Dhaka", group: "Science", major: "", grade: "5.00", passingYear: "2019" },
    { level: "HSC / A-Level", institution: "Notre Dame College, Dhaka", board: "Dhaka", group: "Science", major: "", grade: "5.00", passingYear: "2021" },
    { level: "Bachelor's", institution: "University of Dhaka", board: "", group: "", major: "Computer Science and Engineering", grade: "3.85 / 4.00", passingYear: "2025" },
  ],
  s2: [
    { level: "SSC / O-Level", institution: "Corona Secondary School, Lagos" },
    { level: "HSC / A-Level", institution: "Federal Government College, Lagos" },
    { level: "Bachelor's", institution: "University of Lagos" },
  ],
  s3: [
    { level: "SSC / O-Level", institution: "Delhi Public School" },
    { level: "HSC / A-Level", institution: "Delhi Public School" },
    { level: "Bachelor's", institution: "University of Delhi" },
  ],
};

export function loadAcademicLevels(studentId: string = CURRENT_STUDENT_ID): AcademicLevelEntry[] {
  const fallback = SEED_LEVELS[studentId] ?? [];
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(STORAGE_PREFIX + studentId);
    return raw ? (JSON.parse(raw) as AcademicLevelEntry[]) : fallback;
  } catch {
    return fallback;
  }
}

export function saveAcademicLevels(entries: AcademicLevelEntry[], studentId: string = CURRENT_STUDENT_ID) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + studentId, JSON.stringify(entries));
}
