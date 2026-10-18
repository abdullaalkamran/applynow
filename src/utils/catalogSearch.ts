// The AI assistant's own catalog search. Pure functions over a list of universities (no store access) so they can be tested
// with any dataset. It is deliberately separate from the Explore / Advanced Search filters, which are untouched.
//
// Why the assistant needs more than substring matching: a student says "Master's in Business Management, CGPA 3.2, IELTS 6.5"
// and the catalog says level "Postgraduate", subject "Business & Management", a course "MSc Business Management (Hons)".
// Exact-text filters returned nothing and the assistant concluded "no courses". Here matching is forgiving (word-based, ignores
// "&"/"and", accents and case), levels have synonyms, the student's GPA and English score are checked against each course's real
// requirements, and an empty result is relaxed step by step — with the relaxation reported — instead of reported as "none".
import { toIELTSEquivalent, courseHasOpenIntake } from "./universityFilter";
import { courseFeeText, courseFeeIn, courseCurrencySymbol, courseFeeKind, feeCurrenciesFor } from "./courseFee";
import type { University } from "../types";

type Course = University["courses"][number];

// ---- Text matching ----------------------------------------------------------------------------------------------
export function normalizeText(text: string): string {
  return text
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/&/g, " and ")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const STOP_WORDS = new Set(["in", "the", "of", "a", "an", "for", "and", "with", "course", "courses", "program", "programme", "programs", "programmes", "degree", "degrees", "university", "universities"]);
export function searchTokens(text: string | undefined): string[] {
  if (!text) return [];
  return normalizeText(text).split(" ").filter((t) => t && !STOP_WORDS.has(t));
}

// Stored short country names vs what people say.
const COUNTRY_ALIASES: Record<string, string[]> = {
  uk: ["united kingdom", "britain", "great britain", "england", "scotland", "wales"],
  usa: ["united states", "united states of america", "america", "us"],
  "united states": ["usa", "america", "us", "united states of america"],
  uae: ["united arab emirates", "dubai", "abu dhabi"],
  "new zealand": ["nz"],
};
export function countryMatches(storedCountry: string, query: string): boolean {
  const stored = normalizeText(storedCountry);
  const q = normalizeText(query);
  if (!q) return true;
  if (stored === q || stored.includes(q) || q.includes(stored)) return true;
  return (COUNTRY_ALIASES[stored] ?? []).some((a) => normalizeText(a) === q || normalizeText(a).includes(q));
}

// ---- Study level ------------------------------------------------------------------------------------------------
export type LevelKey = "undergraduate" | "postgraduate" | "doctorate" | "diploma";
const LEVEL_WORDS: [LevelKey, RegExp][] = [
  ["doctorate", /\b(phd|doctorate|doctoral|dphil)\b/],
  ["postgraduate", /\b(master|masters|master's|postgraduate|postgrad|post graduate|pg|msc|mba|ma|meng|mres|mphil|llm|mpa|mph|graduate)\b/],
  ["undergraduate", /\b(bachelor|bachelors|bachelor's|undergraduate|undergrad|under graduate|ug|bsc|ba|beng|llb|bba|bcom|degree)\b/],
  ["diploma", /\b(diploma|certificate|foundation|pathway|associate)\b/],
];
/** Which level(s) a free-text level (student's wording, a course level, a programme-level tag or a course name) means. */
export function levelKeys(text: string | undefined): LevelKey[] {
  if (!text) return [];
  const t = normalizeText(text);
  const out: LevelKey[] = [];
  for (const [key, re] of LEVEL_WORDS) if (re.test(t)) out.push(key);
  return out;
}
function courseLevels(c: Course): Set<LevelKey> {
  const set = new Set<LevelKey>();
  levelKeys(c.level).forEach((k) => set.add(k));
  (c.programLevel ?? []).forEach((p) => levelKeys(p).forEach((k) => set.add(k)));
  // The name prefix settles courses whose stored level is blank or generic ("MSc …", "BA (Hons) …").
  const prefix = (c.name.split(/[\s(,-]/)[0] ?? "").toLowerCase();
  if (/^(msc|ma|mba|meng|mres|mphil|llm|mpa|mph|mfin|macc)$/.test(prefix)) set.add("postgraduate");
  if (/^(bsc|ba|beng|llb|bba|bcom|bed)$/.test(prefix)) set.add("undergraduate");
  if (/^(phd|dphil)$/.test(prefix)) set.add("doctorate");
  return set;
}

// ---- Index ------------------------------------------------------------------------------------------------------
interface Entry { u: University; c: Course; hay: string; uniHay: string; levels: Set<LevelKey> }
const indexCache = new WeakMap<University[], Entry[]>();
/** One flat, pre-normalised list of every course (rebuilt only when the catalog array itself is replaced). */
function indexFor(unis: University[]): Entry[] {
  let idx = indexCache.get(unis);
  if (!idx) {
    idx = [];
    for (const u of unis) {
      const uniHay = normalizeText(`${u.name} ${u.city} ${u.state ?? ""} ${u.country}`);
      for (const c of u.courses) {
        idx.push({ u, c, hay: normalizeText(`${c.name} ${c.subject} ${c.level} ${c.studyMode ?? ""} ${(c.programLevel ?? []).join(" ")}`), uniHay, levels: courseLevels(c) });
      }
    }
    indexCache.set(unis, idx);
  }
  return idx;
}

// ---- Student scores ---------------------------------------------------------------------------------------------
/** Normalises a CGPA to a 4.0 scale (accepts a scale of 4, 5, 10 or 100). */
export function gpaOn4(gpa: number, scale = 4): number {
  if (!Number.isFinite(gpa) || gpa <= 0) return 0;
  const s = scale > 0 ? scale : gpa > 10 ? 100 : gpa > 5 ? 10 : gpa > 4 ? 5 : 4;
  return Math.min(4, (gpa / s) * 4);
}
/** A university's stated minimum GPA, on a 4.0 scale (values above 4.5 are taken to be percentages). */
function minGpaOn4(min: number): number {
  if (!Number.isFinite(min) || min <= 0) return 0;
  return min > 4.5 ? Math.min(4, (min / 100) * 4) : min;
}

type Check = "meets" | "below" | "unknown";
const sameTest = (a: string, b: string) => normalizeText(a).startsWith(normalizeText(b).split(" ")[0]) || normalizeText(b).startsWith(normalizeText(a).split(" ")[0]);

interface EnglishReq { testName: string; minScore?: string }
/** The English requirements that apply to this course: its own, else the university's for that level, else a bare IELTS minimum. */
export function englishRequirementsFor(u: University, c: Course): EnglishReq[] {
  if (c.englishRequirements && c.englishRequirements.length) return c.englishRequirements;
  const lv = courseLevels(c);
  const byLevel = lv.has("postgraduate") || lv.has("doctorate") ? u.englishRequirements?.postgraduate : u.englishRequirements?.undergraduate;
  if (byLevel && byLevel.length) return byLevel;
  const any = [...(u.englishRequirements?.postgraduate ?? []), ...(u.englishRequirements?.undergraduate ?? [])];
  if (any.length) return any;
  return u.minIELTS > 0 ? [{ testName: "IELTS", minScore: String(u.minIELTS) }] : [];
}
function englishCheck(u: University, c: Course, test?: string, score?: number): { status: Check; required: string } {
  const reqs = englishRequirementsFor(u, c);
  const required = reqs.map((r) => `${r.testName}${r.minScore ? ` ${r.minScore}` : ""}`).join(" or ") || "not stated";
  if (!test || score === undefined || !Number.isFinite(score) || reqs.length === 0) return { status: "unknown", required };
  const same = reqs.find((r) => sameTest(r.testName, test) && Number(r.minScore));
  if (same) return { status: score >= Number(same.minScore) ? "meets" : "below", required };
  // Another test: compare on the IELTS scale (approximate), against the lowest requirement the university states.
  const student = toIELTSEquivalent(test, score);
  const eqs = reqs.filter((r) => Number(r.minScore)).map((r) => toIELTSEquivalent(r.testName, Number(r.minScore)));
  if (!eqs.length) return { status: "unknown", required };
  return { status: student + 0.01 >= Math.min(...eqs) ? "meets" : "below", required };
}
function gpaCheck(u: University, cgpa?: number, scale?: number): { status: Check; required: string } {
  const min = minGpaOn4(u.minGPA);
  const required = min > 0 ? `${min.toFixed(1)} / 4.0` : "not stated";
  if (cgpa === undefined || !Number.isFinite(cgpa) || min === 0) return { status: "unknown", required };
  return { status: gpaOn4(cgpa, scale) + 0.001 >= min ? "meets" : "below", required };
}

// ---- Finding programmes -----------------------------------------------------------------------------------------
export interface ProgramQuery {
  country?: string;
  university?: string;
  subject?: string; // field of study or course words, e.g. "business management", "computer science"
  level?: string; // "master", "bachelor", "postgraduate", "phd", "diploma"…
  intake?: string; // month name
  cgpa?: number;
  gpaScale?: number;
  englishTest?: string;
  englishScore?: number;
  budget?: number; // yearly, in `currency`
  currency?: string;
  scholarshipOnly?: boolean;
  limit?: number;
}

const monthOf = (text: string) => normalizeText(text).slice(0, 3);
const rankNumber = (r: string) => Number(String(r).replace(/\D/g, "")) || 9999;

function currencyFor(unis: University[], q: ProgramQuery): string {
  if (q.currency) return q.currency.trim();
  const names = q.country ? unis.filter((u) => countryMatches(u.country, q.country!)).map((u) => u.country) : [];
  return feeCurrenciesFor(names[0] ?? "")[0] ?? "$";
}

interface Relax { subjectAny?: boolean; noIntake?: boolean; noBudget?: boolean; noLevel?: boolean; noScholarship?: boolean }
function candidates(unis: University[], q: ProgramQuery, relax: Relax): Entry[] {
  const subjTokens = searchTokens(q.subject);
  const uniTokens = searchTokens(q.university);
  const lvl = q.level ? levelKeys(q.level) : [];
  const month = q.intake ? monthOf(q.intake) : "";
  return indexFor(unis).filter(({ u, c, hay, uniHay, levels }) => {
    if (q.country && !countryMatches(u.country, q.country)) return false;
    if (uniTokens.length && !uniTokens.every((t) => uniHay.includes(t))) return false;
    if (subjTokens.length) {
      const test = (t: string) => hay.includes(t);
      if (relax.subjectAny ? !subjTokens.some(test) : !subjTokens.every(test)) return false;
    }
    if (lvl.length && !relax.noLevel && !lvl.some((k) => levels.has(k))) return false;
    if (month && !relax.noIntake && !(c.intakes && c.intakes.length ? c.intakes : u.intakes).some((m) => monthOf(m) === month)) return false;
    if (q.scholarshipOnly && !relax.noScholarship && !u.scholarshipsAvailable) return false;
    return true;
  });
}

export interface ProgramRow {
  courseId: string; course: string; level: string; subject: string; duration: string;
  universityId: string; university: string; city: string; country: string; worldRank: string;
  fee: string; feeAmount?: number; currency?: string; budget?: "within" | "over" | "not comparable";
  intakes: string[]; intakeOpen: boolean; nearestDeadline?: string;
  scholarship?: string;
  gpa: { status: Check; required: string };
  english: { status: Check; required: string };
  fit: string;
}

function toRow(e: Entry, q: ProgramQuery, currency: string): ProgramRow {
  const { u, c } = e;
  const t = courseFeeText(u, c);
  const gpa = gpaCheck(u, q.cgpa, q.gpaScale);
  const english = englishCheck(u, c, q.englishTest, q.englishScore);
  let budget: ProgramRow["budget"];
  if (q.budget) {
    const fee = courseFeeIn(u, c, currency);
    budget = fee === null ? "not comparable" : fee <= q.budget ? "within" : "over";
  }
  const intakes = c.intakes && c.intakes.length ? c.intakes : u.intakes;
  const deadlines = intakes.map((m) => u.intakeDates?.[m]?.applicationDeadline).filter((d): d is string => !!d);
  const gaps: string[] = [];
  if (gpa.status === "below") gaps.push(`GPA below the ${gpa.required} minimum`);
  if (english.status === "below") gaps.push(`English below the minimum (${english.required})`);
  if (budget === "over") gaps.push("over budget");
  const good: string[] = [];
  if (gpa.status === "meets") good.push("GPA meets the minimum");
  if (english.status === "meets") good.push("English meets the minimum");
  if (budget === "within") good.push("within budget");
  return {
    courseId: c.id, course: c.name, level: c.level, subject: c.subject, duration: c.duration,
    universityId: u.id, university: u.name, city: u.city, country: u.country, worldRank: u.worldRank,
    fee: t.perYear, feeAmount: t.isAmount ? c.feeUSD : undefined, currency: t.isAmount ? courseCurrencySymbol(u, c).trim() : undefined, budget,
    intakes, intakeOpen: courseHasOpenIntake(u, c), nearestDeadline: deadlines[0],
    scholarship: u.scholarships?.[0] ? `${u.scholarships[0].name} (${u.scholarships[0].amount})` : u.scholarshipsAvailable ? "Scholarships available" : undefined,
    gpa, english,
    fit: gaps.length ? `Gap: ${gaps.join("; ")}` : good.length ? good.join(", ") : "Requirements not fully stated — check with the university",
  };
}

/** A programme included to reach the minimum of five options: it needed a loosened filter, which `loosened` names. */
export type FilledRow = ProgramRow & { loosened: string };

/** Every student is offered at least this many options when that many exist. */
export const MIN_OPTIONS = 5;

export interface ProgramSearchResult {
  totalMatches: number;
  /** Programmes the student can apply to (meets, or can't be judged from the data), best first. */
  programs: ProgramRow[];
  /** Close but below a stated minimum — worth mentioning, with the gap. */
  nearMisses: ProgramRow[];
  /** Extra programmes added so the student always has at least five options (when five exist) — each says which filter was loosened. */
  alsoConsider: FilledRow[];
  /** Filters that were loosened because nothing matched exactly, in order. Say this to the student. */
  relaxed: string[];
  /** What was actually applied. */
  filtersApplied: Record<string, string | number | boolean>;
  currencyForBudget?: string;
  notes: string[];
}

export function findPrograms(unis: University[], q: ProgramQuery): ProgramSearchResult {
  const limit = Math.min(Math.max(q.limit ?? 8, MIN_OPTIONS), 25);
  const currency = currencyFor(unis, q);
  // Only filters the student actually gave can be loosened (and reported), in this order. Country and the subject words are the
  // heart of the question: the subject is only loosened to "any of the words", never dropped, and the country never.
  const relaxSteps: [string, Relax][] = [["", {}]];
  let acc: Relax = {};
  if (q.intake) { acc = { ...acc, noIntake: true }; relaxSteps.push(["intake month", acc]); }
  if (q.budget) { acc = { ...acc, noBudget: true }; relaxSteps.push(["budget", acc]); }
  if (q.scholarshipOnly) { acc = { ...acc, noScholarship: true }; relaxSteps.push(["scholarship requirement", acc]); }
  if (q.level) { acc = { ...acc, noLevel: true }; relaxSteps.push(["study level", acc]); }
  if (searchTokens(q.subject).length > 1) { acc = { ...acc, subjectAny: true }; relaxSteps.push(["all subject words (matching any of them)", acc]); }
  let entries: Entry[] = [];
  let relax: Relax = {};
  let usedStep = 0;
  for (let i = 0; i < relaxSteps.length; i++) {
    relax = relaxSteps[i][1];
    usedStep = i;
    entries = candidates(unis, q, relax);
    if (entries.length) break;
  }
  // Steps 1..usedStep were loosened (cumulatively) to get these results; empty when the exact search already matched.
  const relaxedFinal = entries.length ? relaxSteps.slice(1, usedStep + 1).map(([label]) => label) : relaxSteps.slice(1).map(([label]) => label);

  let rows = entries.map((e) => toRow(e, q, currency));
  // Budget: a course over budget is dropped; one whose fee can't be compared (not listed / another currency) is kept and flagged.
  if (q.budget && !relax.noBudget) rows = rows.filter((r) => r.budget !== "over");

  const isBelow = (r: ProgramRow) => r.gpa.status === "below" || r.english.status === "below";
  const score = (r: ProgramRow) =>
    (r.gpa.status === "meets" ? 0 : r.gpa.status === "unknown" ? 1 : 3) + (r.english.status === "meets" ? 0 : r.english.status === "unknown" ? 1 : 3) +
    (r.budget === "within" ? 0 : r.budget === "not comparable" ? 1 : 0) + (r.intakeOpen ? 0 : 2);
  const order = (a: ProgramRow, b: ProgramRow) => score(a) - score(b) || rankNumber(a.worldRank) - rankNumber(b.worldRank) || (a.feeAmount ?? 1e12) - (b.feeAmount ?? 1e12);
  const eligible = rows.filter((r) => !isBelow(r)).sort(order);
  const near = rows.filter(isBelow).sort(order);

  // Spread results across universities so one university's 40 near-identical courses don't fill the whole list.
  const perUni = new Map<string, number>();
  const programs: ProgramRow[] = [];
  for (const r of eligible) {
    const n = perUni.get(r.universityId) ?? 0;
    if (n >= 2) continue;
    perUni.set(r.universityId, n + 1);
    programs.push(r);
    if (programs.length >= limit) break;
  }

  // Always offer at least five options when five exist: if the exact search (plus near misses) is short, bring in programmes from
  // progressively looser searches — never dropping the country, and never duplicating a course already shown.
  const alsoConsider: FilledRow[] = [];
  const shown = new Set([...programs, ...near.slice(0, 5)].map((r) => r.courseId));
  const target = () => programs.length + Math.min(near.length, 5) + alsoConsider.length;
  if (target() < MIN_OPTIONS) {
    for (let i = usedStep + 1; i < relaxSteps.length && target() < MIN_OPTIONS; i++) {
      const [label, r] = relaxSteps[i];
      const more = candidates(unis, q, r).map((e) => toRow(e, q, currency)).filter((row) => !shown.has(row.courseId)).sort(order);
      const perUniMore = new Map<string, number>();
      for (const row of more) {
        if (target() >= MIN_OPTIONS + 3) break;
        const n = perUniMore.get(row.universityId) ?? 0;
        if (n >= 2) continue;
        perUniMore.set(row.universityId, n + 1);
        shown.add(row.courseId);
        alsoConsider.push({ ...row, loosened: label });
      }
    }
  }

  const notes: string[] = [];
  if (target() < MIN_OPTIONS) notes.push(`Only ${target()} course${target() === 1 ? "" : "s"} in the catalog match even after loosening every filter that can be loosened (the country and subject words are never dropped). Say so, and offer another country, level or subject.`);
  if (q.budget) notes.push(`Budget was compared only with fees listed in ${currency.trim()}; courses with no fee listed or priced in another currency are marked "not comparable" and kept.`);
  if (q.cgpa !== undefined) notes.push("GPA is compared on a 4.0 scale. A requirement the university hasn't stated is shown as unknown, not as a pass.");
  if (q.englishScore !== undefined) notes.push("English scores from a different test than the stated requirement are compared approximately on the IELTS scale.");
  if (!eligible.length && near.length) notes.push("Every match is below a stated minimum — see nearMisses.");

  const applied: Record<string, string | number | boolean> = {};
  for (const [k, v] of Object.entries(q)) if (v !== undefined && v !== "" && k !== "limit") applied[k] = v as string | number | boolean;
  return {
    totalMatches: rows.length,
    programs,
    nearMisses: near.slice(0, 5),
    alsoConsider,
    relaxed: relaxedFinal,
    filtersApplied: applied,
    currencyForBudget: q.budget ? currency : undefined,
    notes,
  };
}

// ---- Detail ---------------------------------------------------------------------------------------------------
function entryRequirementsFor(u: University, c: Course): { academic: string[]; english: EnglishReq[] } {
  const lv = courseLevels(c);
  const academic = c.requirements && c.requirements.length ? c.requirements : lv.has("postgraduate") || lv.has("doctorate") ? u.requirements.postgraduate : u.requirements.undergraduate;
  return { academic, english: englishRequirementsFor(u, c) };
}

/** Everything the data team entered about ONE course and its university: fee, intakes and deadlines, entry and English
 * requirements, admission procedure, deposit and payment, scholarships, campuses. */
export function courseDetail(unis: University[], courseId: string) {
  for (const u of unis) {
    const c = u.courses.find((x) => x.id === courseId);
    if (!c) continue;
    const intakes = c.intakes && c.intakes.length ? c.intakes : u.intakes;
    const campuses = (u.campuses ?? []).filter((k) => !c.campusIds?.length || c.campusIds.includes(k.id)).map((k) => ({ name: k.name, city: k.city }));
    const t = courseFeeText(u, c);
    const entry = entryRequirementsFor(u, c);
    return {
      course: {
        id: c.id, name: c.name, level: c.level, subject: c.subject, duration: c.duration, studyMode: c.studyMode ?? "Full-time",
        description: c.description, courseUrl: c.courseUrl,
        fee: t.perYear, feeStatus: courseFeeKind(c), currency: courseCurrencySymbol(u, c).trim(),
        intakes: intakes.map((m) => ({ month: m, open: !!u.intakeStatus?.[m], ...u.intakeDates?.[m] })),
        applicationDeadline: c.applicationDeadline,
        entryRequirements: entry.academic, englishRequirements: entry.english,
        standardizedTests: c.standardizedTests, mathsRequired: c.mathsRequired, stem: c.isStemProgram, programLevel: c.programLevel,
        modules: c.modules?.slice(0, 12), careers: c.careers?.slice(0, 8), accreditations: c.accreditations?.map((a) => a.name),
        campuses,
      },
      university: universitySummary(u),
      admissionProcedure: u.admissionSteps ?? [],
      deposit: depositInfo(u),
    };
  }
  return null;
}

function depositInfo(u: University) {
  return {
    minimumDeposit: u.minimumDepositAmount !== undefined ? `${u.currencySymbol.trim()}${u.minimumDepositAmount.toLocaleString()}` : undefined,
    rule: u.depositMode === "half" ? "50% of the first year's tuition" : u.depositMode === "full" ? "Full first-year tuition" : undefined,
    paymentDeadline: u.paymentDeadline,
    conditions: u.depositRules ?? [],
  };
}

/** The university as a whole — a summary plus its first courses (ids, so details can be fetched), never every course. */
export function universitySummary(u: University, courseLimit = 0) {
  return {
    id: u.id, name: u.name, city: u.city, state: u.state, country: u.country, website: u.website,
    worldRank: u.worldRank, qsRanking: u.qsRanking, timesHigherRanking: u.timesHigherRanking, employability: u.employability, studentCount: u.studentCount,
    description: u.description, highlights: u.highlights, tags: u.tags, accreditations: u.accreditations,
    currency: u.currencySymbol.trim(),
    intakes: u.intakes.map((m) => ({ month: m, open: !!u.intakeStatus?.[m], ...u.intakeDates?.[m] })),
    entryRequirements: u.requirements, englishRequirements: u.englishRequirements,
    minimumIELTS: u.minIELTS, minimumGPA: u.minGPA, moiAccepted: u.moiAccepted, eslElpAvailable: u.eslElpAvailable,
    admissionProcedure: u.admissionSteps ?? [], deposit: depositInfo(u),
    scholarships: u.scholarships ?? [], scholarshipsAvailable: u.scholarshipsAvailable,
    applicationFeeWaiver: u.applicationFeeWaiverAvailable ? `${u.applicationFeeWaiverPercent ?? ""}%`.trim() : undefined,
    restrictedRegions: u.restrictedRegions ?? [],
    campuses: (u.campuses ?? []).map((k) => ({ id: k.id, name: k.name, city: k.city })),
    subjects: u.subjects, courseCount: u.courses.length,
    ...(courseLimit > 0 ? { courses: u.courses.slice(0, courseLimit).map((c) => ({ id: c.id, name: c.name, level: c.level, subject: c.subject })), coursesTruncated: u.courses.length > courseLimit } : {}),
  };
}

/** Plain course search for "what does X offer / MSc Data Science in the UK" — same forgiving matching, no student scores. */
export function searchCourseRows(unis: University[], q: ProgramQuery & { limit?: number }): ProgramSearchResult {
  return findPrograms(unis, { ...q, limit: q.limit ?? 20 });
}
