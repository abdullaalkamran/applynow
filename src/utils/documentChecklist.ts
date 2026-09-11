import { DOCUMENTS, CURRENT_STUDENT_ID } from "../data/mockData";
import { getAllApplications } from "../data/applicationsStore";
import { loadUploadedDocs } from "../data/applicationDocsStore";
import { loadCoreDocs } from "../data/coreDocsStore";
import { loadAcademicLevels } from "../data/academicProfileStore";
import { isStepComplete } from "../data/profileCompletion";
import { loadCustomDocRequests } from "../data/customDocRequestsStore";
import type { University } from "../types";

export interface ChecklistDoc { name: string; uploadedAt: string; sourceApplicationId?: string; sourceUniversity?: string }

// Matches an uploaded file (e.g. "Transcript_BSc.pdf") to the checklist item it satisfies —
// matching on shared keywords rather than exact phrasing. Per-education-level academic doc types
// (e.g. "Bachelor's — Transcript") aren't listed here since they're generated dynamically from the
// student's actual academic profile — see `academicDocTypesFor` and the fallback in `docMatchesType`.
const DOC_TYPE_PATTERNS: { docType: string; match: RegExp }[] = [
  { docType: "English Proficiency", match: /ielts|toefl|english|proficiency/i },
  { docType: "CV / Resume", match: /\bcv\b|resume|curriculum vitae/i },
  { docType: "Statement of Purpose", match: /statement.?of.?purpose|\bsop\b/i },
  { docType: "Academic Reference Letter", match: /academic reference|reference/i },
  { docType: "Employment Reference Letter", match: /employment reference|experience letter|work reference|employer/i },
  { docType: "Portfolio", match: /portfolio/i },
  { docType: "Passport", match: /passport/i },
  { docType: "Financial Statement", match: /financial|bank.?statement|sponsor/i },
];

// Keywords used to recognise an uploaded file as belonging to a specific education level, since
// filenames rarely spell the level out in full (e.g. "Transcript_BSc.pdf" for "Bachelor's").
const LEVEL_KEYWORDS: Record<string, string[]> = {
  "SSC / O-Level": ["ssc", "o-level", "o level", "secondary", "10th"],
  "HSC / A-Level": ["hsc", "a-level", "a level", "higher secondary", "12th"],
  Diploma: ["diploma"],
  "Bachelor's": ["bachelor", "bsc", "b.sc", "undergrad"],
  "Master's": ["master", "msc", "m.sc", "postgrad"],
  PhD: ["phd", "doctor"],
};

/** One Certificate + Transcript pair per education level on the student's actual academic profile
 * (10th through Master's/PhD, whatever they've recorded) — falls back to a single generic pair if
 * the profile has no entries at all. */
export function academicDocTypesFor(studentId: string = CURRENT_STUDENT_ID): string[] {
  const levels = loadAcademicLevels(studentId);
  if (levels.length === 0) return ["Academic Transcript", "Academic Certificate"];
  return Array.from(new Set(levels.map((l) => l.level))).flatMap((level) => [`${level} — Transcript`, `${level} — Certificate`]);
}

// The mandatory "upload once" set every application needs, independent of country or university —
// kept entirely separate from the per-application checklist below so the student is never asked to
// re-upload the same passport or transcript for every school they apply to.
export function coreDocTypes(studentId: string = CURRENT_STUDENT_ID): string[] {
  const types = ["Passport", ...academicDocTypesFor(studentId), "English Proficiency", "CV / Resume"];
  // An employment reference is only relevant if the student's profile actually shows work
  // experience — no point asking every applicant, including recent graduates, for one.
  if (isStepComplete("work-experience", studentId)) types.push("Employment Reference Letter");
  return types;
}

// Visa financial-proof requirements: a university's own admissions page rarely mentions these (none
// of the seeded universities' `requirements` text does), because they come from the destination
// country's student-visa system, not the university's own admissions criteria — so they're modelled
// per country instead of parsed out of requirements text like the rest of the checklist.
const COUNTRY_REQUIREMENTS: Record<string, string[]> = {
  UK: ["Financial Statement"],
  "United States": ["Financial Statement"],
  Canada: ["Financial Statement"],
  Australia: ["Financial Statement"],
  Ireland: ["Financial Statement"],
  Germany: ["Financial Statement"],
  "United Arab Emirates": ["Financial Statement"],
  "New Zealand": ["Financial Statement"],
};

/** Everything a specific application additionally needs beyond the student's core document vault —
 * derived from this university's own stated requirements plus its destination country's visa norms. */
export function universityDocTypesFor(university: University, studentId: string = CURRENT_STUDENT_ID): string[] {
  const fromRequirements = university.requirements
    .map((r) => DOC_TYPE_PATTERNS.find((rule) => rule.match.test(r))?.docType)
    .filter((t): t is string => !!t);
  const fromCountry = COUNTRY_REQUIREMENTS[university.country] ?? [];
  const core = new Set(coreDocTypes(studentId));
  // Never duplicate a core type here even if a university's own text happens to mention it (e.g.
  // "Bachelor's degree" implying a transcript) — that's already covered by the core vault.
  return Array.from(new Set([...fromCountry, ...fromRequirements])).filter((t) => !core.has(t));
}

/** True if a document's name/type plausibly satisfies the given checklist doc type. */
export function docMatchesType(docName: string, docType: string): boolean {
  const pattern = DOC_TYPE_PATTERNS.find((rule) => rule.docType === docType)?.match;
  if (pattern) return pattern.test(docName);

  // Dynamic per-level academic types, e.g. "Bachelor's — Transcript": match on the document kind
  // (certificate/transcript) plus a keyword for that specific education level, since a filename
  // like "Transcript_BSc.pdf" rarely spells the level out the same way the checklist does.
  const academicMatch = /^(.+) — (Certificate|Transcript)$/.exec(docType);
  if (academicMatch) {
    const [, level, kind] = academicMatch;
    const name = docName.toLowerCase();
    const hasKind = name.includes(kind.toLowerCase());
    const keywords = LEVEL_KEYWORDS[level] ?? [];
    const hasLevel = name.includes(level.toLowerCase()) || keywords.some((k) => name.includes(k));
    return hasKind && hasLevel;
  }

  return docName.toLowerCase().includes(docType.toLowerCase());
}

// Every document the student has on file anywhere — the seeded mock documents plus anything
// uploaded (in this browser) against any of their other applications — so a document already
// provided for one application can be recognised as already satisfied on a later one.
export function studentDocumentVault(studentId: string, excludeApplicationId?: string): ChecklistDoc[] {
  const allApplications = getAllApplications();
  const seeded: ChecklistDoc[] = DOCUMENTS.filter((d) => d.studentId === studentId && d.applicationId !== excludeApplicationId).map((d) => ({
    name: d.name,
    uploadedAt: d.uploadedAt,
    sourceApplicationId: d.applicationId,
    sourceUniversity: allApplications.find((a) => a.id === d.applicationId)?.university,
  }));

  const otherApplications = allApplications.filter((a) => a.studentId === studentId && a.id !== excludeApplicationId);
  const fromOtherApplications: ChecklistDoc[] = otherApplications.flatMap((a) =>
    loadUploadedDocs(a.id).map((d) => ({ name: d.name, uploadedAt: d.uploadedAt, sourceApplicationId: a.id, sourceUniversity: a.university }))
  );

  return [...seeded, ...fromOtherApplications];
}

export interface ChecklistRow {
  type: string;
  own?: { name: string; status: string };
  reused?: ChecklistDoc;
}

/** The university-specific checklist for one application — what's already on file for it, what can
 * be reused from another of the student's applications, and (implicitly) what's still missing. Core
 * documents (Passport, Transcript, etc.) are deliberately excluded — see `buildCoreChecklist`. Also
 * includes any ad-hoc documents a counsellor has requested for this specific application, so a
 * staff-created request shows up as a real checklist item on both sides, not just a note. */
export function buildChecklist(
  university: University,
  studentId: string,
  applicationId: string,
  ownDocs: { name: string; status: string }[]
): ChecklistRow[] {
  const vault = studentDocumentVault(studentId, applicationId);
  const customTypes = loadCustomDocRequests(applicationId).map((r) => r.type);
  const allTypes = Array.from(new Set([...universityDocTypesFor(university, studentId), ...customTypes]));
  return allTypes.map((type) => {
    const own = ownDocs.find((d) => docMatchesType(d.name, type));
    const reused = !own ? vault.find((d) => docMatchesType(d.name, type)) : undefined;
    return { type, own, reused };
  });
}

/** The student's core document checklist — uploaded once via the core vault, and satisfied
 * automatically if a matching document already exists anywhere (including older per-application
 * uploads from before the core vault existed). */
export function buildCoreChecklist(studentId: string): ChecklistRow[] {
  const legacyDocs = DOCUMENTS.filter((d) => d.studentId === studentId);
  const perApplicationUploads = getAllApplications()
    .filter((a) => a.studentId === studentId)
    .flatMap((a) => loadUploadedDocs(a.id));
  const core = loadCoreDocs();
  const allOwn: { name: string; status: string }[] = [...core, ...legacyDocs, ...perApplicationUploads];

  return coreDocTypes(studentId).map((type) => ({ type, own: allOwn.find((d) => docMatchesType(d.name, type)) }));
}
