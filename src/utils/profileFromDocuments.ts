// Counsellor flow for "create a student profile from their documents": files attached in the AI chat are
// staged here, sent to POST /api/profile-extraction for classification + extraction, and the merged proposal is
// held until the counsellor approves creating the student (see the read_attached_documents and
// create_student_from_documents tools in counsellorAssistantTools.ts). Nothing is saved until that approval.
import { apiPostForm } from "./apiClient";
import { createStudent } from "../data/allStudentsStore";
import { refreshAssignedStudents } from "../data/counsellorStudentsStore";
import { addCoreDoc } from "../data/coreDocsStore";
import {
  savePersonalInfo, saveEnglishTests, saveEnglishStatus, saveWorkExperience, saveWorkStatus,
  type PersonalInfoDetails, type EnglishTestDetails, type WorkExperienceDetails,
} from "../data/studentProfileDetailsStore";
import { saveAcademicLevels, type AcademicLevelEntry } from "../data/academicProfileStore";
import { isProfileDataComplete, markStepComplete } from "../data/profileCompletion";

export interface ExtractedDocument {
  fileName: string;
  docType: "passport" | "transcript" | "certificate" | "english_test" | "cv" | "other";
  academic: AcademicLevelEntry[];
  warnings: string[];
}

export interface ProfileProposal {
  personal: Partial<PersonalInfoDetails>;
  academic: AcademicLevelEntry[];
  english: Omit<EnglishTestDetails, "testType" | "expiryDate" | "issuingInstitution">[];
  work: Omit<WorkExperienceDetails, "type">[];
}

interface ExtractionResponse {
  available: boolean;
  documents: ExtractedDocument[];
  profile: ProfileProposal;
  warnings: string[];
}

let staged: File[] = [];
let proposal: { documents: ExtractedDocument[]; profile: ProfileProposal; files: File[] } | null = null;

export function stageFiles(files: File[]) { staged = [...staged, ...files].slice(0, 8); proposal = null; }
export function getStagedFiles(): File[] { return staged; }
export function clearStagedFiles() { staged = []; proposal = null; }
export function getProposal() { return proposal; }

export async function readStagedDocuments(): Promise<ExtractionResponse & { fileCount: number }> {
  const files = staged;
  const form = new FormData();
  files.forEach((f) => form.append("files", f));
  const res = await apiPostForm<ExtractionResponse>("/api/profile-extraction", form);
  proposal = res.available ? { documents: res.documents, profile: res.profile, files } : null;
  return { ...res, fileCount: files.length };
}

/** Plain-language review text for the approval card. */
export function describeProposal(args: { name?: string; email?: string; country?: string }): string {
  if (!proposal) return "Create a student from the attached documents.";
  const p = proposal.profile;
  const name = args.name || [p.personal.firstName, p.personal.lastName].filter(Boolean).join(" ") || "(name needed)";
  const lines = [
    `Create student "${name}" (${args.email || "email needed"}, ${args.country || p.personal.nationality || "country needed"}) and assign them to you.`,
    `Profile from the documents: ${Object.keys(p.personal).length} personal fields, ${p.academic.length} education entr${p.academic.length === 1 ? "y" : "ies"}, ${p.english.length} English test${p.english.length === 1 ? "" : "s"}, ${p.work.length} work entr${p.work.length === 1 ? "y" : "ies"}.`,
    `${proposal.files.length} file${proposal.files.length === 1 ? "" : "s"} will be added to their document vault.`,
  ];
  const warnings = proposal.documents.flatMap((d) => d.warnings.map((w) => `${d.fileName}: ${w}`));
  if (warnings.length) lines.push(`Check: ${warnings.slice(0, 3).join(" · ")}`);
  return lines.join("\n");
}

function vaultNameFor(doc: ExtractedDocument | undefined, fallback: string): string {
  switch (doc?.docType) {
    case "passport": return "Passport";
    case "english_test": return "English Proficiency";
    case "cv": return "CV / Resume";
    case "transcript":
    case "certificate": {
      const level = doc.academic[0]?.level;
      return level && level !== "Other" ? `${level} — ${doc.docType === "transcript" ? "Transcript" : "Certificate"}` : fallback;
    }
    default: return fallback;
  }
}

/** Creates the student (auto-assigned to the calling counsellor server-side), saves every extracted profile
 * section, files the attached documents in their vault, and marks a profile step complete only when its data
 * genuinely is. Only ever called after the counsellor approved the card built from describeProposal(). */
export async function createStudentFromProposal(input: { name?: string; email: string; country?: string; phone?: string }) {
  if (!proposal) throw new Error("No documents have been read yet — attach files and read them first.");
  const { profile, files, documents } = proposal;
  const p = profile.personal;
  const name = input.name || [p.firstName, p.lastName].filter(Boolean).join(" ");
  const country = input.country || p.nationality || "";
  if (!name || !input.email || !country) throw new Error("A name, email and country are required to create the student.");

  const student = await createStudent({ name, email: input.email, phone: input.phone || p.phone, country });
  const id = student.id;

  const blank = (k: keyof PersonalInfoDetails) => (p[k] as string | undefined) ?? "";
  const keys: (keyof PersonalInfoDetails)[] = [
    "firstName", "lastName", "email", "phone", "dob", "gender", "nationality", "fatherName", "motherName", "maritalStatus", "passportNumber",
    "personalNumber", "previousPassportNumber", "placeOfBirth", "issuingAuthority", "issueDate", "passportExpiry", "permanentAddress",
    "presentAddress", "city", "country", "emergencyContactName", "emergencyContactRelationship", "emergencyContactAddress",
    "emergencyContactPhone", "emergencyContactEmail",
  ];
  const personal = Object.fromEntries(keys.map((k) => [k, blank(k)])) as unknown as PersonalInfoDetails;
  personal.email = input.email;
  personal.phone = input.phone || blank("phone");
  personal.country = country;
  if (Object.keys(p).length > 0) savePersonalInfo(personal, id);
  if (profile.academic.length > 0) saveAcademicLevels(profile.academic, id);
  if (profile.english.length > 0) {
    saveEnglishTests(profile.english.map((e) => ({ ...e, testType: "", expiryDate: "", issuingInstitution: "" })), id);
    saveEnglishStatus({ status: "yes" }, id);
  }
  if (profile.work.length > 0) {
    saveWorkExperience(profile.work.map((w) => ({ ...w, type: "Full-time" })), id);
    saveWorkStatus({ hasExperience: true }, id);
  }
  const stepsDone: string[] = [];
  for (const step of ["personal-information", "academic-details", "english-proficiency", "work-experience"]) {
    if (isProfileDataComplete(step, id).complete) { markStepComplete(step, id); stepsDone.push(step); }
  }

  files.forEach((file, i) => addCoreDoc(id, vaultNameFor(documents[i], file.name), file));
  await refreshAssignedStudents().catch(() => undefined);
  clearStagedFiles();
  return { studentId: id, name, filesAdded: files.length, completedSteps: stepsDone };
}
