import { CURRENT_STUDENT_ID } from "./mockData";
import { getServerSection, putServerSection } from "./profileSync";

// Real, staff-visible records of exactly what a student submitted on each profile step — every
// field the student-side form collects, not a trimmed summary, so a counsellor sees the same
// information the student entered.

export interface PersonalInfoDetails {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dob: string;
  gender: string;
  nationality: string;
  fatherName: string;
  motherName: string;
  maritalStatus: string;
  passportNumber: string;
  personalNumber: string;
  previousPassportNumber: string;
  placeOfBirth: string;
  issuingAuthority: string;
  issueDate: string;
  passportExpiry: string;
  permanentAddress: string;
  presentAddress: string;
  city: string;
  country: string;
  emergencyContactName: string;
  emergencyContactRelationship: string;
  emergencyContactAddress: string;
  emergencyContactPhone: string;
  emergencyContactEmail: string;
}

export interface EnglishTestDetails {
  testName: string;
  testType: string;
  overallScore: string;
  listening: string;
  reading: string;
  writing: string;
  speaking: string;
  testDate: string;
  expiryDate: string;
  reportNumber: string;
  issuingInstitution: string;
}

// Answers the "do you have this at all?" gate each page now asks before showing its add-entry UI —
// stored separately from the entries array below so existing readers of EnglishTestDetails[] (the
// counsellor-facing checklist/AI-tool consumers) are unaffected by this addition.
export interface EnglishProficiencyStatus {
  status: "yes" | "preparing" | "no";
  expectedExamDate?: string;
}

export interface WorkExperienceStatus {
  hasExperience: boolean;
}

export interface WorkExperienceDetails {
  type: string;
  company: string;
  title: string;
  industry: string;
  startDate: string;
  endDate: string;
  currentlyWorking: boolean;
  description: string;
}

export interface PreferencesDetails {
  destinations: string[];
  studyLevel: string;
  fields: string[];
  intake: string;
  budget: string;
  accommodation: string;
  scholarshipInterest: boolean;
  emailUpdates: boolean;
  smsUpdates: boolean;
  whatsappUpdates: boolean;
  pushUpdates: boolean;
  contactLanguage: string;
}

// No seeded profiles: every student's details come from what they (or their agent/counsellor) actually saved.
const SEED_PERSONAL: Record<string, PersonalInfoDetails> = {};
const SEED_ENGLISH: Record<string, EnglishTestDetails[]> = {};
const SEED_WORK: Record<string, WorkExperienceDetails[]> = {};
const SEED_PREFERENCES: Record<string, PreferencesDetails> = {};

function keyFor(section: string, studentId: string) {
  return `sd-profile-details:${section}:${studentId}`;
}

function load<T>(section: string, studentId: string): T | null {
  const fromServer = getServerSection<T>(studentId, section);
  if (fromServer !== undefined) return fromServer;
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(section, studentId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save<T>(section: string, value: T, studentId: string) {
  putServerSection(studentId, section, value);
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(section, studentId), JSON.stringify(value));
}

export const loadPersonalInfo = (studentId: string = CURRENT_STUDENT_ID) => load<PersonalInfoDetails>("personal", studentId) ?? SEED_PERSONAL[studentId] ?? null;
export const savePersonalInfo = (value: PersonalInfoDetails, studentId: string = CURRENT_STUDENT_ID) => save("personal", value, studentId);

export const loadEnglishTests = (studentId: string = CURRENT_STUDENT_ID) => load<EnglishTestDetails[]>("english", studentId) ?? SEED_ENGLISH[studentId] ?? [];
export const saveEnglishTests = (value: EnglishTestDetails[], studentId: string = CURRENT_STUDENT_ID) => save("english", value, studentId);

// Seeded students with a real test on file (SEED_ENGLISH) are assumed to have already answered
// "Yes" — a fresh browser for them shouldn't re-ask a question their seeded data already answers.
export const loadEnglishStatus = (studentId: string = CURRENT_STUDENT_ID) =>
  load<EnglishProficiencyStatus>("english-status", studentId) ?? (SEED_ENGLISH[studentId] ? { status: "yes" as const } : null);
export const saveEnglishStatus = (value: EnglishProficiencyStatus, studentId: string = CURRENT_STUDENT_ID) => save("english-status", value, studentId);

export const loadWorkExperience = (studentId: string = CURRENT_STUDENT_ID) => load<WorkExperienceDetails[]>("work", studentId) ?? SEED_WORK[studentId] ?? [];
export const saveWorkExperience = (value: WorkExperienceDetails[], studentId: string = CURRENT_STUDENT_ID) => save("work", value, studentId);

export const loadWorkStatus = (studentId: string = CURRENT_STUDENT_ID) =>
  load<WorkExperienceStatus>("work-status", studentId) ?? (SEED_WORK[studentId] ? { hasExperience: true } : null);
export const saveWorkStatus = (value: WorkExperienceStatus, studentId: string = CURRENT_STUDENT_ID) => save("work-status", value, studentId);

export const loadPreferences = (studentId: string = CURRENT_STUDENT_ID) => load<PreferencesDetails>("preferences", studentId) ?? SEED_PREFERENCES[studentId] ?? null;
export const savePreferences = (value: PreferencesDetails, studentId: string = CURRENT_STUDENT_ID) => save("preferences", value, studentId);
