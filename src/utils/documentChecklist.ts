import { loadBankAccounts, HOLDING_ACCOUNT_STATUSES } from "../data/bankAccountsCache";
import { DOCUMENTS, CURRENT_STUDENT_ID } from "../data/mockData";
import { getAllApplications } from "../data/applicationsStore";
import { loadUploadedDocs, loadCustomDocRequests } from "../data/applicationDocsStore";
import { loadCoreDocs } from "../data/coreDocsStore";
import { loadEnglishTests, loadWorkExperience } from "../data/studentProfileDetailsStore";
import { loadAcademicLevels } from "../data/academicProfileStore";
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

/** Two proof documents per bank the student holds funds in: as soon as an account is set to Maintaining (by the student or
 * the counsellor) its Bank Statement and Solvency Certificate become required — they show on the Documents page's Required
 * list and as Next Steps, like every other required document. Set back to Preparing/Not Opened and they go away. */
export function bankDocTypesFor(studentId: string = CURRENT_STUDENT_ID): string[] {
  const banks = Array.from(new Set(
    loadBankAccounts(studentId).filter((a) => HOLDING_ACCOUNT_STATUSES.has(a.status)).map((a) => a.bankName.trim()).filter(Boolean)
  ));
  return banks.flatMap((bank) => [`Bank Statement — ${bank}`, `Solvency Certificate — ${bank}`]);
}

// The mandatory "upload once" set every application needs, independent of country or university — kept entirely separate from
// the per-application checklist below so the student is never asked to re-upload the same passport or transcript for every
// school they apply to. ONLY these gate submitting an application. English test certificates, employment certificates /
// recommendation letters, bank documents and Statements of Purpose are supporting documents (see supportingDocTypes) — wanted
// eventually, but not needed to submit.
export function coreDocTypes(studentId: string = CURRENT_STUDENT_ID): string[] {
  return ["Passport", ...academicDocTypesFor(studentId), "CV / Resume"];
}

/** Types that are supporting documents rather than mandatory core ones — whether they came from the profile, the university's
 * own text, a counsellor's request or the manual "Add a document type" picker. */
const SUPPORTING_TYPE = /statement of purpose|english|\bmoi\b|medium of instruction|employment|recommendation|reference letter|bank statement|solvency|financial statement/i;
export const isSupportingType = (type: string) => SUPPORTING_TYPE.test(type);

export const EMPLOYMENT_CERTIFICATE = "Employment Certificate";

const EDUCATION_ORDER = ["SSC / O-Level", "HSC / A-Level", "Diploma", "Bachelor's", "Master's", "PhD"];

/** The most recent institution on the student's academic profile — the highest education level that has an institution
 * entered — which is where recommendation letters should come from. Null until the profile has one. */
export function lastInstitutionFor(studentId: string): string | null {
  const entries = loadAcademicLevels(studentId).filter((e) => (e.institution ?? "").trim());
  if (entries.length === 0) return null;
  const rank = (level: string) => { const i = EDUCATION_ORDER.indexOf(level); return i < 0 ? -1 : i; };
  return [...entries].sort((a, b) => rank(b.level) - rank(a.level))[0].institution.trim();
}

/** Two recommendation letters from teachers of the last institution on the profile, e.g.
 * "Recommendation Letter 1 — University of Dhaka". Separate from an employment certificate. */
export function recommendationLetterTypesFor(studentId: string): string[] {
  const where = lastInstitutionFor(studentId);
  return [1, 2].map((n) => (where ? `Recommendation Letter ${n} — ${where}` : `Recommendation Letter ${n} (last institution)`));
}

/** "English test certificate — IELTS": one per test the student has chosen in their English proficiency profile (an MOI letter
 * for MOI), or a single generic one when no test is recorded yet. */
export function englishCertificateTypesFor(studentId: string): string[] {
  const names = Array.from(new Set(loadEnglishTests(studentId).map((t) => (t.testName || "").trim()).filter(Boolean)));
  if (names.length === 0) return ["English test certificate"];
  return names.map((n) => (/moi|medium of instruction/i.test(n) ? "MOI letter" : `English test certificate — ${n}`));
}

/** Documents that support an application but aren't needed to submit it: the English test certificate for the selected test,
 * two recommendation letters from the last institution's teachers, an employment certificate (when the profile has work experience), bank documents for the
 * banks the student holds funds in, and a Statement of Purpose slot per application. */
export function supportingDocTypes(studentId: string = CURRENT_STUDENT_ID): string[] {
  const requestedSupporting = loadCoreDocs(studentId).filter((d) => d.custom && isSupportingType(d.type)).map((d) => d.type);
  return Array.from(new Set([
    ...englishCertificateTypesFor(studentId),
    ...recommendationLetterTypesFor(studentId),
    // Only for students whose profile shows work experience.
    ...(loadWorkExperience(studentId).length > 0 ? [EMPLOYMENT_CERTIFICATE] : []),
    ...bankDocTypesFor(studentId),
    ...requestedSupporting,
  ]));
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
  return Array.from(new Set([...fromCountry, ...fromRequirements])).filter((t) => !core.has(t) && !isSupportingType(t));
}

/** True if a document's name/type plausibly satisfies the given checklist doc type. */
export function docMatchesType(docName: string, docType: string): boolean {
  // Supporting types whose wording depends on the student's own choices.
  if (/^english test certificate|^moi letter/i.test(docType)) {
    const test = / — (.+)$/.exec(docType)?.[1]?.toLowerCase();
    return /ielts|toefl|pte|duolingo|cambridge|english|proficiency|\bmoi\b|medium of instruction/i.test(docName) || (!!test && docName.toLowerCase().includes(test));
  }
  if (docType === EMPLOYMENT_CERTIFICATE) return /employment|experience/i.test(docName);
  const pattern = DOC_TYPE_PATTERNS.find((rule) => rule.docType === docType)?.match;
  if (pattern) return pattern.test(docName);

  // Per-bank proof documents: "Bank Statement — <bank>" / "Solvency Certificate — <bank>" — a file counts when its name says
  // which document it is and names the bank (uploads from the checklist are named exactly after the row's type).
  const bankMatch = /^(Bank Statement|Solvency Certificate) — (.+)$/.exec(docType);
  if (bankMatch) {
    const [, kind, bank] = bankMatch;
    const lower = docName.toLowerCase();
    return lower.includes(kind.toLowerCase().split(" ")[kind.startsWith("Bank") ? 1 : 0]) && lower.includes(bank.toLowerCase());
  }

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
  // True when this is still missing (no own/reused/rejected) and a counsellor added it as an
  // ad-hoc request (applicationDocsStore.ts's loadCustomDocRequests) rather than it coming from the automatic
  // university/core checklist — flagged so the UI can call it out (red) instead of blending in
  // with the rest of the "not uploaded yet" items.
  requested?: boolean;
  // A supporting document (English test certificate, employment certificate / recommendation letters, bank documents, a
  // Statement of Purpose) — useful for an application but NOT needed to submit it, so never counted as "required".
  supporting?: boolean;
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
 * staff-created request shows up as a real checklist item on both sides, not just a note.
 * `university` is optional — an application whose `university` string doesn't resolve to a catalog
 * entry (a stale/mistyped name, or one added after the application was created) still needs its
 * counsellor-requested items to show up; only the university-derived part of the list is skipped. */
export function buildChecklist(
  university: University | undefined,
  studentId: string,
  applicationId: string,
  ownDocs: { name: string; status: string; previewUrl?: string }[]
): ChecklistRow[] {
  const vault = studentDocumentVault(studentId, applicationId);
  const customTypes = loadCustomDocRequests(applicationId).map((r) => r.type);
  const customTypeSet = new Set(customTypes);
  const universityTypes = university ? universityDocTypesFor(university, studentId) : [];
  const allTypes = Array.from(new Set([...universityTypes, ...customTypes]));
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
    // Whenever a server Document row exists for this type at all, it's authoritative — the
    // `ownDocs`/vault fallback below is for legacy/seed entries with no real row behind them, and
    // must never be consulted once a real row (of any status) exists, or a counsellor's "requested"
    // placeholder (which is also included in `ownDocs` by every caller, unfiltered by status) gets
    // picked back up there and wrongly rendered as already-on-file with status "requested".
    if (latestServer) {
      if (latestServer.status === "requested") {
        return { type, requested: true };
      }
      if (latestServer.status === "rejected") {
        return { type, rejected: { id: latestServer.id, reason: latestServer.rejectionReason, uploadedAt: latestServer.uploadedAt } };
      }
      return { type, own: { id: latestServer.id, name: latestServer.name, status: latestServer.status, previewUrl: latestServer.previewUrl } };
    }
    const own = ownDocs.find((d) => docMatchesType(d.name, type));
    const reused = !own ? vault.find((d) => docMatchesType(d.name, type)) : undefined;
    return { type, own, reused, requested: !own && !reused && customTypeSet.has(type) };
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
    "English test certificate", "CV / Resume", EMPLOYMENT_CERTIFICATE, "Recommendation Letter 1", "Recommendation Letter 2", "Passport", "Financial Statement",
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
function coreRowsFor(studentId: string, types: string[], supporting: boolean): ChecklistRow[] {
  const legacyDocs = DOCUMENTS.filter((d) => d.studentId === studentId);
  const perApplicationUploads = getAllApplications()
    .filter((a) => a.studentId === studentId)
    .flatMap((a) => loadUploadedDocs(a.id));
  const legacyOwn: { name: string; status: string; previewUrl?: string }[] = [...legacyDocs, ...perApplicationUploads];

  const core = loadCoreDocs(studentId);
  const rows = types.map((type): ChecklistRow => {
    const coreMatches = core.filter((d) => docMatchesType(d.name, type)).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
    const latestCore = coreMatches[0];
    const flag = supporting ? { supporting: true } : {};

    if (latestCore && latestCore.status !== "requested") {
      if (latestCore.status === "rejected") {
        return { type, ...flag, rejected: { id: latestCore.id, reason: latestCore.rejectionReason, uploadedAt: latestCore.uploadedAt } };
      }
      return { type, ...flag, own: { id: latestCore.id, name: latestCore.name, status: latestCore.status, previewUrl: latestCore.previewUrl } };
    }

    return { type, ...flag, own: legacyOwn.find((d) => docMatchesType(d.name, type)) };
  });
  return sortChecklistRows(rows);
}

/** The student's MANDATORY core checklist — the documents needed to submit any application. Satisfied automatically if a
 * matching document already exists anywhere. The server-backed vault is checked first (it has the verify/reject lifecycle): a
 * rejected upload leaves the item "missing" with the counsellor's reason until a fresh one replaces it, and a "requested"
 * placeholder does the same until something is filed against it. Supporting documents live in buildSupportingChecklist. */
export function buildCoreChecklist(studentId: string): ChecklistRow[] {
  const adHocTypes = loadCoreDocs(studentId).filter((d) => d.custom && !isSupportingType(d.type)).map((d) => d.type);
  return coreRowsFor(studentId, Array.from(new Set([...coreDocTypes(studentId), ...adHocTypes])), false);
}

/** English test certificate, employment certificate / recommendation letters, bank documents and Statement of Purpose slots —
 * shown as "Additional documents", never counted as required and never blocking an application. */
export function buildSupportingChecklist(studentId: string): ChecklistRow[] {
  return coreRowsFor(studentId, supportingDocTypes(studentId), true);
}
