import { CURRENT_STUDENT_ID } from "./mockData";
import {
  loadPersonalInfo, type PersonalInfoDetails,
  loadEnglishTests, loadEnglishStatus,
  loadWorkExperience, loadWorkStatus,
} from "./studentProfileDetailsStore";
import { loadAcademicLevels } from "./academicProfileStore";

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

// The strict order a new/incomplete profile must be filled in — Preferences and Security aren't
// part of this chain (optional, freely editable anytime, same as today).
export const PROFILE_CHAIN = ["personal-information", "academic-details", "english-proficiency", "work-experience"] as const;

/** Whether every step in PROFILE_CHAIN is already complete — lets a page tell "still onboarding"
 * (auto-advance after save) apart from "already done, just editing one section again" (stay put).
 * Must be captured *before* the current save's markStepComplete call, or it'll always read true. */
export function isChainComplete(studentId: string = CURRENT_STUDENT_ID): boolean {
  return PROFILE_CHAIN.every((key) => isStepComplete(key, studentId));
}

/** The next not-yet-complete step in PROFILE_CHAIN after `afterKey`, or null if the rest of the
 * chain is already done (caller should send the student back to the Profile hub instead). */
export function nextChainStep(afterKey: string, studentId: string = CURRENT_STUDENT_ID): ProfileStep | null {
  const idx = PROFILE_CHAIN.indexOf(afterKey as (typeof PROFILE_CHAIN)[number]);
  if (idx === -1) return null;
  for (let i = idx + 1; i < PROFILE_CHAIN.length; i++) {
    if (!isStepComplete(PROFILE_CHAIN[i], studentId)) {
      return PROFILE_STEPS.find((s) => s.key === PROFILE_CHAIN[i]) ?? null;
    }
  }
  return null;
}

const blank = (v: string | undefined | null) => typeof v !== "string" || v.trim() === "";

// Every field the personal-information step must genuinely have before it can be called done —
// mirrors PersonalInformation.tsx's own data shape (not its handleSave, which only checks a few
// fields plus UI-only concerns like OTP verification and a "matches my passport" checkbox that
// have no stored equivalent here).
const CORE_PERSONAL_FIELDS: { field: keyof PersonalInfoDetails; label: string }[] = [
  { field: "firstName", label: "first name" }, { field: "lastName", label: "last name" },
  { field: "email", label: "email" }, { field: "phone", label: "phone number" },
  { field: "dob", label: "date of birth" }, { field: "gender", label: "gender" },
  { field: "nationality", label: "nationality" }, { field: "passportNumber", label: "passport number" },
  { field: "placeOfBirth", label: "place of birth" }, { field: "issuingAuthority", label: "passport issuing authority" },
  { field: "issueDate", label: "passport issue date" }, { field: "passportExpiry", label: "passport expiry date" },
  { field: "permanentAddress", label: "permanent address" }, { field: "city", label: "city" },
  { field: "country", label: "country" },
  { field: "emergencyContactName", label: "emergency contact name" },
  { field: "emergencyContactPhone", label: "emergency contact phone" },
];

function needsGroup(level: string) { return level === "SSC / O-Level" || level === "HSC / A-Level"; }
function needsMajor(level: string) { return level === "Diploma" || level === "Bachelor's" || level === "Master's" || level === "PhD"; }

/** Whether a profile step's actual saved data is genuinely complete, and what's still missing if
 * not — the real check behind mark_profile_step_complete, so the AI assistant (or anything else)
 * can never flag a step done just because it was asked to. */
export function isProfileDataComplete(key: string, studentId: string = CURRENT_STUDENT_ID): { complete: boolean; missing: string[] } {
  switch (key) {
    case "personal-information": {
      const info = loadPersonalInfo(studentId);
      if (!info) return { complete: false, missing: ["the whole Personal Information form"] };
      const missing = CORE_PERSONAL_FIELDS.filter(({ field }) => blank(info[field])).map((f) => f.label);
      return { complete: missing.length === 0, missing };
    }
    case "academic-details": {
      const entries = loadAcademicLevels(studentId);
      if (entries.length === 0) return { complete: false, missing: ["at least one education entry"] };
      const missing: string[] = [];
      for (const e of entries) {
        if (blank(e.institution)) missing.push(`${e.level} institution`);
        if (blank(e.grade)) missing.push(`${e.level} grade`);
        if (blank(e.passingYear)) missing.push(`${e.level} passing year`);
        if (needsGroup(e.level) && blank(e.board)) missing.push(`${e.level} education board`);
        if (needsGroup(e.level) && blank(e.group)) missing.push(`${e.level} section`);
        if (needsMajor(e.level) && blank(e.major)) missing.push(`${e.level} major`);
      }
      return { complete: missing.length === 0, missing };
    }
    case "english-proficiency": {
      const status = loadEnglishStatus(studentId);
      if (!status) return { complete: false, missing: ["whether the student has English proficiency proof"] };
      if (status.status === "no") return { complete: true, missing: [] };
      if (status.status === "preparing") {
        return blank(status.expectedExamDate)
          ? { complete: false, missing: ["expected English test date"] }
          : { complete: true, missing: [] };
      }
      const tests = loadEnglishTests(studentId);
      if (tests.length === 0) return { complete: false, missing: ["at least one English test result"] };
      const missing: string[] = [];
      for (const t of tests) {
        const label = t.testName || "English test";
        if (blank(t.overallScore)) missing.push(`${label} overall score`);
        if (blank(t.testDate)) missing.push(`${label} test date`);
        if (blank(t.reportNumber)) missing.push(`${label} report number`);
      }
      return { complete: missing.length === 0, missing };
    }
    case "work-experience": {
      const status = loadWorkStatus(studentId);
      if (!status) return { complete: false, missing: ["whether the student has any work experience"] };
      if (!status.hasExperience) return { complete: true, missing: [] };
      const entries = loadWorkExperience(studentId);
      if (entries.length === 0) return { complete: false, missing: ["at least one work experience entry"] };
      const missing: string[] = [];
      for (const e of entries) {
        if (blank(e.company)) missing.push("employer/company name");
        if (blank(e.title)) missing.push("job title");
        if (blank(e.startDate)) missing.push("start date");
        if (!e.currentlyWorking && blank(e.endDate)) missing.push("end date");
      }
      return { complete: missing.length === 0, missing };
    }
    default:
      return { complete: true, missing: [] };
  }
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
