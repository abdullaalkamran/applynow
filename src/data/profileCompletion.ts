import { CURRENT_STUDENT_ID } from "./mockData";

export interface ProfileStep {
  key: string;
  label: string;
  path: string;
  required: boolean;
}

export const PROFILE_STEPS: ProfileStep[] = [
  { key: "personal-information", label: "Personal Information", path: "/student/profile/personal-information", required: true },
  { key: "academic-details", label: "Academic Details", path: "/student/profile/academic-details", required: true },
  { key: "english-proficiency", label: "English Proficiency", path: "/student/profile/english-proficiency", required: true },
  { key: "work-experience", label: "Work Experience", path: "/student/profile/work-experience", required: false },
  { key: "preferences", label: "Preferences", path: "/student/profile/preferences", required: false },
];

// Seeded per assigned student, so a counsellor can see real completion state for anyone in their
// caseload, not just whoever's signed into the student app in this demo. Sarah's profile is
// realistic everywhere except Preferences (not yet saved) — a fresh browser starts at a believable
// 80%. The others have a plausible partial state of their own. A student with no entry here (e.g.
// one just added via "Add New Student") genuinely hasn't started, so defaults to all-false.
const DEFAULT_COMPLETE_BY_STUDENT: Record<string, Record<string, boolean>> = {
  s1: { "personal-information": true, "academic-details": true, "english-proficiency": true, "work-experience": true, "preferences": false },
  s2: { "personal-information": false, "academic-details": true, "english-proficiency": false, "work-experience": false, "preferences": false },
  s3: { "personal-information": false, "academic-details": true, "english-proficiency": false, "work-experience": false, "preferences": false },
  // s6 signed up and picked their study preferences but hasn't filled in the rest yet — a real
  // "lead" still warming up. s7 just created an account and hasn't started (all-false default).
  s6: { "personal-information": false, "academic-details": false, "english-proficiency": false, "work-experience": false, "preferences": true },
};

const STORAGE_PREFIX = "sd-profile-step:";

export function isStepComplete(key: string, studentId: string = CURRENT_STUDENT_ID): boolean {
  const defaults = DEFAULT_COMPLETE_BY_STUDENT[studentId] ?? {};
  if (typeof window === "undefined") return defaults[key] ?? false;
  const stored = window.localStorage.getItem(`${STORAGE_PREFIX}${studentId}:${key}`);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return defaults[key] ?? false;
}

export function markStepComplete(key: string, studentId: string = CURRENT_STUDENT_ID) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(`${STORAGE_PREFIX}${studentId}:${key}`, "true");
}

export interface ProfileCompletion {
  steps: (ProfileStep & { complete: boolean })[];
  pendingSteps: (ProfileStep & { complete: boolean })[];
  percent: number;
  requiredRemaining: number;
}

export function getProfileCompletion(studentId: string = CURRENT_STUDENT_ID): ProfileCompletion {
  const steps = PROFILE_STEPS.map((s) => ({ ...s, complete: isStepComplete(s.key, studentId) }));
  const pendingSteps = steps.filter((s) => !s.complete);
  const percent = Math.round(((steps.length - pendingSteps.length) / steps.length) * 100);
  const requiredRemaining = pendingSteps.filter((s) => s.required).length;
  return { steps, pendingSteps, percent, requiredRemaining };
}
