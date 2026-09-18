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
  // Scans both levels' requirement text — this heuristic doesn't know which degree level the
  // application is for, so it's deliberately the superset of both rather than guessing.
  const fromRequirements = [...university.requirements.undergraduate, ...university.requirements.postgraduate]
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
  own?: { id?: string; name: string; status: string; previewUrl?: string };
  reused?: ChecklistDoc;
  // Core-doc only: the most recent upload for this type was rejected, and nothing newer has been
  // uploaded since — still counts as "missing" (own is unset) but carries the counsellor's reason
  // so the checklist can prompt a re-upload instead of a plain "not uploaded yet".
  rejected?: { id: string; reason?: string; uploadedAt: string };
}

/** Rejected items float to the top of a checklist — they're the ones actually blocking the
 * student right now and need a re-upload, so they shouldn't be buried wherever their type
 * happens to fall in the list. Everything else (missing, pending review, reused, verified) keeps
 * its original relative order — Array.prototype.sort is stable, so this only ever moves rejected
 * rows forward. */
function sortChecklistRows(rows: ChecklistRow[]): ChecklistRow[] {
  return [...rows].sort((a, b) => Number(!a.rejected) - Number(!b.rejected));
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
  ownDocs: { name: string; status: string; previewUrl?: string }[]
): ChecklistRow[] {
  const vault = studentDocumentVault(studentId, applicationId);
  const customTypes = loadCustomDocRequests(applicationId).map((r) => r.type);
  const allTypes = Array.from(new Set([...universityDocTypesFor(university, studentId), ...customTypes]));
  // The real, server-backed uploads for this application (loadUploadedDocs is now Postgres-backed —
  // see applicationDocsStore.ts) — checked ahead of `ownDocs` since these are the ones with a
  // working verify/reject lifecycle, unlike the legacy/seed entries mixed into `ownDocs`, which
  // have no real Document row behind them to verify or reject. A rejected upload leaves the item
  // still "missing" (with the counsellor's reason attached) until a fresh one replaces it — same
  // rule as buildCoreChecklist.
  const serverDocs = loadUploadedDocs(applicationId);
  const rows = allTypes.map((type) => {
    const serverMatches = serverDocs.filter((d) => docMatchesType(d.name, type)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latestServer = serverMatches[0];
    if (latestServer) {
      if (latestServer.status === "rejected") {
        return { type, rejected: { id: latestServer.id, reason: latestServer.rejectionReason, uploadedAt: latestServer.uploadedAt } };
      }
      return { type, own: { id: latestServer.id, name: latestServer.name, status: latestServer.status, previewUrl: latestServer.previewUrl } };
    }
    const own = ownDocs.find((d) => docMatchesType(d.name, type));
    const reused = !own ? vault.find((d) => docMatchesType(d.name, type)) : undefined;
    return { type, own, reused };
  });
  return sortChecklistRows(rows);
}

/** True when the student's academic profile is too thin for coreDocTypes()/academicDocTypesFor()
 * to have derived the exact document types they actually need (e.g. no education level recorded
 * yet, so it's fallen back to a single generic "Academic Transcript/Certificate" pair) — the
 * trigger for showing the manual "Add a document type" picker (see coreDocTypeOptions()). */
export function academicProfileIncomplete(studentId: string): boolean {
  return loadAcademicLevels(studentId).length === 0;
}

const MANUAL_ACADEMIC_LEVELS = ["SSC / O-Level", "HSC / A-Level", "Diploma", "Bachelor's", "Master's", "PhD"];

/** Every type the manual "Add a document type" picker offers — every academic level's
 * Transcript/Certificate pair (so a student can say "Bachelor's Transcript" precisely instead of
 * waiting on their profile to derive it) plus the other core types that aren't level-dependent. */
export function coreDocTypeOptions(): string[] {
  return [
    ...MANUAL_ACADEMIC_LEVELS.flatMap((level) => [`${level} — Transcript`, `${level} — Certificate`]),
    "English Proficiency", "CV / Resume", "Employment Reference Letter", "Passport", "Financial Statement",
  ];
}

/** The student's core document checklist — uploaded once via the core vault, and satisfied
 * automatically if a matching document already exists anywhere (including older per-application
 * uploads from before the core vault existed). The server-backed vault (`core`) is checked first
 * since it's the one with a working verify/reject lifecycle: a rejected upload leaves the item
 * still "missing" (with the counsellor's reason attached) until a fresh one replaces it, and a
 * "requested" placeholder (added via the manual picker, no file yet) does the same until something
 * is actually filed against it. Anything already on file from before that migration (seed data,
 * older per-application uploads) is still recognised as a plain fallback. */
export function buildCoreChecklist(studentId: string): ChecklistRow[] {
  const legacyDocs = DOCUMENTS.filter((d) => d.studentId === studentId);
  const perApplicationUploads = getAllApplications()
    .filter((a) => a.studentId === studentId)
    .flatMap((a) => loadUploadedDocs(a.id));
  const legacyOwn: { name: string; status: string; previewUrl?: string }[] = [...legacyDocs, ...perApplicationUploads];

  const core = loadCoreDocs(studentId);
  const adHocTypes = core.filter((d) => d.custom).map((d) => d.type);
  const types = Array.from(new Set([...coreDocTypes(studentId), ...adHocTypes]));

  const rows = types.map((type) => {
    const coreMatches = core.filter((d) => docMatchesType(d.name, type)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latestCore = coreMatches[0];

    if (latestCore && latestCore.status !== "requested") {
      if (latestCore.status === "rejected") {
        return { type, rejected: { id: latestCore.id, reason: latestCore.rejectionReason, uploadedAt: latestCore.uploadedAt } };
      }
      return { type, own: { id: latestCore.id, name: latestCore.name, status: latestCore.status, previewUrl: latestCore.previewUrl } };
    }

    return { type, own: legacyOwn.find((d) => docMatchesType(d.name, type)) };
  });
  return sortChecklistRows(rows);
}
