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

// Sarah's demo profile already has realistic data pre-filled everywhere except Preferences,
// which she hasn't explicitly saved yet — so a fresh browser starts at a believable 80%,
// not 0%, while still leaving one real pending step to click through.
const DEFAULT_COMPLETE: Record<string, boolean> = {
  "personal-information": true,
  "academic-details": true,
  "english-proficiency": true,
  "work-experience": true,
  "preferences": false,
};

const STORAGE_PREFIX = "sd-profile-step:";

export function isStepComplete(key: string): boolean {
  if (typeof window === "undefined") return DEFAULT_COMPLETE[key] ?? false;
  const stored = window.localStorage.getItem(STORAGE_PREFIX + key);
  if (stored === "true") return true;
  if (stored === "false") return false;
  return DEFAULT_COMPLETE[key] ?? false;
}

export function markStepComplete(key: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_PREFIX + key, "true");
}

export interface ProfileCompletion {
  steps: (ProfileStep & { complete: boolean })[];
  pendingSteps: (ProfileStep & { complete: boolean })[];
  percent: number;
  requiredRemaining: number;
}

export function getProfileCompletion(): ProfileCompletion {
  const steps = PROFILE_STEPS.map((s) => ({ ...s, complete: isStepComplete(s.key) }));
  const pendingSteps = steps.filter((s) => !s.complete);
  const percent = Math.round(((steps.length - pendingSteps.length) / steps.length) * 100);
  const requiredRemaining = pendingSteps.filter((s) => s.required).length;
  return { steps, pendingSteps, percent, requiredRemaining };
}
