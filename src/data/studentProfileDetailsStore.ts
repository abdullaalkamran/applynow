import { CURRENT_STUDENT_ID } from "./mockData";

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

// Sarah's is the only student who has a fully modeled profile elsewhere in the codebase (the
// passport-scan / test / work / preferences demo defaults in each student-side page) — seeded here
// field-for-field so a counsellor sees her real submitted details even before she's re-saved a page
// in this particular browser session.
const SEED_PERSONAL: Record<string, PersonalInfoDetails> = {
  s1: {
    firstName: "Sarah",
    lastName: "Khan",
    email: "sarah.khan@email.com",
    phone: "+880 1711-000000",
    dob: "2003-04-12",
    gender: "Female",
    nationality: "Bangladesh",
    fatherName: "Abdul Karim",
    motherName: "Rowshan Ara Begum",
    maritalStatus: "Single",
    passportNumber: "BN1234567",
    personalNumber: "1234567890123",
    previousPassportNumber: "",
    placeOfBirth: "Dhaka, Bangladesh",
    issuingAuthority: "Department of Immigration & Passports, Dhaka",
    issueDate: "2017-01-20",
    passportExpiry: "2027-01-20",
    permanentAddress: "House 12, Road 5, Banani",
    presentAddress: "House 12, Road 5, Banani",
    city: "Dhaka",
    country: "Bangladesh",
    emergencyContactName: "Rehana Khan",
    emergencyContactRelationship: "Parent",
    emergencyContactAddress: "House 12, Road 5, Banani, Dhaka",
    emergencyContactPhone: "+880 1911-222333",
    emergencyContactEmail: "rehana.khan@email.com",
  },
};

const SEED_ENGLISH: Record<string, EnglishTestDetails[]> = {
  s1: [{
    testName: "IELTS", testType: "UKVI Academic", overallScore: "7.5",
    listening: "8.0", reading: "7.5", writing: "6.5", speaking: "7.5",
    testDate: "2026-03-14", expiryDate: "2028-03-14", reportNumber: "24GB123456ABCD", issuingInstitution: "",
  }],
};

const SEED_WORK: Record<string, WorkExperienceDetails[]> = {
  s1: [{
    type: "Full-time", company: "bKash Limited", title: "Business Analyst", industry: "Fintech",
    startDate: "2025-09-01", endDate: "", currentlyWorking: true,
    description: "Supporting product teams with requirements analysis and process documentation for digital payment features.",
  }],
};

const SEED_PREFERENCES: Record<string, PreferencesDetails> = {
  s1: {
    destinations: ["United Kingdom", "Australia", "Canada"],
    studyLevel: "Master's",
    fields: ["Data Science & AI", "Computer Science & IT"],
    intake: "January",
    budget: "£30k – £40k",
    accommodation: "University Halls",
    scholarshipInterest: true,
    emailUpdates: true,
    smsUpdates: true,
    whatsappUpdates: false,
    pushUpdates: true,
    contactLanguage: "English",
  },
  s6: {
    destinations: ["United Kingdom"],
    studyLevel: "Master's",
    fields: ["Data Science & AI"],
    intake: "September",
    budget: "£20k – £30k",
    accommodation: "Not decided",
    scholarshipInterest: true,
    emailUpdates: true,
    smsUpdates: false,
    whatsappUpdates: false,
    pushUpdates: false,
    contactLanguage: "English",
  },
};

function keyFor(section: string, studentId: string) {
  return `sd-profile-details:${section}:${studentId}`;
}

function load<T>(section: string, studentId: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(section, studentId));
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function save<T>(section: string, value: T, studentId: string) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(keyFor(section, studentId), JSON.stringify(value));
}

export const loadPersonalInfo = (studentId: string = CURRENT_STUDENT_ID) => load<PersonalInfoDetails>("personal", studentId) ?? SEED_PERSONAL[studentId] ?? null;
export const savePersonalInfo = (value: PersonalInfoDetails, studentId: string = CURRENT_STUDENT_ID) => save("personal", value, studentId);

export const loadEnglishTests = (studentId: string = CURRENT_STUDENT_ID) => load<EnglishTestDetails[]>("english", studentId) ?? SEED_ENGLISH[studentId] ?? [];
export const saveEnglishTests = (value: EnglishTestDetails[], studentId: string = CURRENT_STUDENT_ID) => save("english", value, studentId);

export const loadWorkExperience = (studentId: string = CURRENT_STUDENT_ID) => load<WorkExperienceDetails[]>("work", studentId) ?? SEED_WORK[studentId] ?? [];
export const saveWorkExperience = (value: WorkExperienceDetails[], studentId: string = CURRENT_STUDENT_ID) => save("work", value, studentId);

export const loadPreferences = (studentId: string = CURRENT_STUDENT_ID) => load<PreferencesDetails>("preferences", studentId) ?? SEED_PREFERENCES[studentId] ?? null;
export const savePreferences = (value: PreferencesDetails, studentId: string = CURRENT_STUDENT_ID) => save("preferences", value, studentId);
