import { getAllUniversities } from "../data/universityCatalogStore";
import { getAllSubjects } from "../data/subjectsStore";
import { getAllCountries } from "../data/countryRegistry";
import { countryByIso2 } from "../data/countries";
import { getSubjectCatalog, getSubjectRecord } from "../data/subjectCatalogStore";
import type { University } from "../types";

// These were once module-load-time constants derived from a static array. They're now functions
// so a university or course added through Data Management shows up immediately — a plain const
// computed once at import time would never see it without a full page reload.
export function destinationOptions(): string[] {
  return Array.from(new Set(getAllUniversities().map((u) => u.country).filter(Boolean))).sort();
}
export function cityOptions(): string[] {
  return Array.from(new Set(getAllUniversities().map((u) => u.city))).sort();
}
export function universityOptions(): string[] {
  return getAllUniversities().map((u) => u.name);
}
export function courseOptions(): string[] {
  return Array.from(new Set(getAllUniversities().flatMap((u) => u.courses.map((c) => c.name)))).sort();
}
export function durationOptions(): string[] {
  return Array.from(new Set(getAllUniversities().flatMap((u) => u.courses.map((c) => c.duration)).filter(Boolean))).sort(
    (a, b) => (parseFloat(a) || 0) - (parseFloat(b) || 0) || a.localeCompare(b)
  );
}
// The one "Level" list in Advanced Search, built only from what Data Management entered on courses:
// each course's Level (Undergraduate / Postgraduate) and its Program Level tags (UG Diploma, PhD,
// Pathway Programs, …). A level nobody has used on any course never shows up as a dead option.
export function levelOptions(): string[] {
  const used = new Set<string>();
  getAllUniversities().forEach((u) => u.courses.forEach((c) => {
    if (c.level) used.add(c.level);
    (c.programLevel ?? []).forEach((p) => used.add(p));
  }));
  const taxonomy = (PROGRAM_LEVEL_OPTIONS as readonly string[]).filter((p) => used.has(p));
  const broad = [...used].filter((l) => !(PROGRAM_LEVEL_OPTIONS as readonly string[]).includes(l)).sort();
  return [...broad, ...taxonomy];
}
export function subjectOptions(): string[] {
  return getAllSubjects();
}
const MONTH_ORDER = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function intakeOptions(): string[] {
  return Array.from(new Set(getAllUniversities().flatMap((u) => [...u.intakes, ...u.courses.flatMap((c) => c.intakes ?? [])]))).sort(
    (a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)
  );
}
export function accreditationOptions(): string[] {
  return Array.from(new Set(getAllUniversities().flatMap((u) => u.accreditations))).sort();
}
export function disciplineAreaOptions(): string[] {
  return Array.from(new Set(getSubjectCatalog().map((s) => s.disciplineArea).filter((d): d is string => !!d))).sort();
}

// Every real year a university's shown to actually run an intake in — the enrollment date's own
// year where Data Management entered one, else whatever 4-digit year is embedded in `openIntake`
// (e.g. "September 2027"). Backs Advanced Search's "Year" filter with no new stored field.
function universityYears(u: University): Set<string> {
  const years = new Set<string>();
  Object.values(u.intakeDates ?? {}).forEach((d) => {
    const y = d.enrollmentDate?.slice(0, 4);
    if (y && /^\d{4}$/.test(y)) years.add(y);
  });
  (u.openIntake.match(/\d{4}/g) ?? []).forEach((y) => years.add(y));
  return years;
}
export function yearOptions(): string[] {
  return Array.from(new Set(getAllUniversities().flatMap((u) => [...universityYears(u)]))).sort();
}

// Every English test named anywhere in the university's own or any of its courses' requirements —
// backs the Advanced Search PTE/TOEFL/IELTS/Duolingo "accepted test" checkboxes as a real presence
// check, distinct from the single englishTestName+score threshold filter above.
function universityAcceptedEnglishTests(u: University): Set<string> {
  const names = new Set<string>();
  const collect = (list?: { testName: string }[]) => list?.forEach((e) => names.add(e.testName));
  collect(u.englishRequirements?.undergraduate);
  collect(u.englishRequirements?.postgraduate);
  u.courses.forEach((c) => collect(c.englishRequirements));
  return names;
}

// Advanced Search's finer-grained "Program Level" taxonomy — a course's own tags (Course.programLevel),
// deliberately separate from the existing `level` field (kept as plain Undergraduate/Postgraduate
// for other features that compare against it exactly).
export const PROGRAM_LEVEL_OPTIONS = [
  "High School (11th - 12th)", "UG Diploma/Certificate/Associate Degree", "UG",
  "PG Diploma/Certificate", "PG", "UG+PG (Accelerated) Degree", "PhD",
  "Short-term/Summer Programs", "Pathway Programs (UG)", "Pathway Programs (PG)",
  "Semester Study Abroad", "Twinning Programmes (UG)", "Twinning Programmes (PG)",
  "English Language Program", "Online Programmes / Distance Learning", "Hybrid",
  "Grades Below 10th",
] as const;

// Standardized admission tests — distinct from English-proficiency tests (TEST_NAME_OPTIONS below).
export const STANDARDIZED_TEST_OPTIONS = ["SAT", "ACT", "GRE", "GMAT"] as const;

// The subset of TEST_NAME_OPTIONS shown as quick "accepted test" checkboxes in Advanced Search's
// Requirements column — the full dropdown+score-threshold filter below still covers every test.
export const ACCEPTED_ENGLISH_TEST_CHECKBOXES = ["PTE Academic", "TOEFL iBT", "IELTS", "Duolingo English Test"] as const;

export const FEE_MIN_USD = 0;
export const FEE_MAX_USD = 100000;
export const FEE_STEP_USD = 1000;

// Coarse fee bands used by the compact pill filters (Subject listing, Explore's flat program list).
export const FEE_BANDS = ["Under $25,000", "Under $50,000", "Under $75,000"];
export function feeBandMax(band: string): number {
  return Number(band.replace(/[^0-9]/g, "")) || Infinity;
}

export interface ProgramOffering {
  university: University;
  course: University["courses"][number];
}

// Every course at every university, flattened into one list — the raw data behind the "all
// programs" list on Explore's Subjects view and the per-subject listing page.
export function allPrograms(): ProgramOffering[] {
  return getAllUniversities().flatMap((u) => u.courses.map((course) => ({ university: u, course })));
}

// English test name options and their raw score scales, used to convert whatever test/score
// the student enters into an IELTS-equivalent for comparison against each university's minIELTS.
export const TEST_NAME_OPTIONS = [
  "IELTS",
  "TOEFL iBT",
  "TOEFL Essentials",
  "PTE Academic",
  "Duolingo English Test",
  "Cambridge C1 Advanced (CAE)",
  "Cambridge C2 Proficiency (CPE)",
  "Oxford ELLT",
  "LanguageCert Academic",
  "MOI (Medium of Instruction)",
  "Other",
] as const;
const TEST_SCALES: Record<string, { min: number; max: number }> = {
  "IELTS": { min: 0, max: 9 },
  "TOEFL iBT": { min: 0, max: 120 },
  "TOEFL Essentials": { min: 1, max: 12 },
  "PTE Academic": { min: 10, max: 90 },
  "Duolingo English Test": { min: 10, max: 160 },
  "Cambridge C1 Advanced (CAE)": { min: 142, max: 210 },
  "Cambridge C2 Proficiency (CPE)": { min: 162, max: 230 },
  "Oxford ELLT": { min: 1, max: 9 },
  "LanguageCert Academic": { min: 0, max: 9 },
  "Other": { min: 0, max: 9 },
};

// Rough proportional conversion, not an official equivalency table — good enough to compare
// against a university's IELTS-stated minimum when the student took a different test.
export function toIELTSEquivalent(testName: string, score: number): number {
  const scale = TEST_SCALES[testName] ?? TEST_SCALES.Other;
  const pct = (score - scale.min) / (scale.max - scale.min);
  return Math.max(0, Math.min(9, pct * 9));
}

// Approximate FX rates to USD, used only to make the fee filter comparable across currencies.
const FX_TO_USD: Record<string, number> = { "£": 1.27, "$": 1.0, "C$": 0.74, "A$": 0.66, "€": 1.09, "AED ": 0.27 };

export interface FilterCurrency {
  symbol: string; // as shown to the student, e.g. "£"
  usdPerUnit: number; // one unit of this currency in USD
}

/** The currency the fee filter should speak in for a chosen destination: whatever the universities in
 * that country are priced in (the most common currencySymbol Data Management entered), USD when no
 * country is chosen or nothing there has a known rate. Filter values themselves stay in USD. */
export function currencyForDestination(destination: string): FilterCurrency {
  const usd: FilterCurrency = { symbol: "$", usdPerUnit: 1 };
  if (!destination) return usd;
  const counts = new Map<string, number>();
  getAllUniversities().filter((u) => u.country === destination && u.currencySymbol).forEach((u) => {
    counts.set(u.currencySymbol, (counts.get(u.currencySymbol) ?? 0) + 1);
  });
  const top = [...counts.entries()].sort((x, y) => y[1] - x[1])[0]?.[0];
  if (!top || FX_TO_USD[top] === undefined) return usd;
  return { symbol: top.trim(), usdPerUnit: FX_TO_USD[top] };
}

export function tuitionInUSD(u: University): number {
  const tuition = u.fees.find((f) => f.label === "Tuition Fee")?.amount ?? 0;
  return tuition * (FX_TO_USD[u.currencySymbol] ?? 1);
}

// Finds the course that best matches the given subject/course search text. A course whose
// *subject* matches wins over one that merely has a matching substring in its name (e.g.
// searching "Engineering" should prefer a course tagged Engineering over one just named
// "Data Engineering & Analytics").
export function matchingCourse(u: University, subjectOrCourseText: string): University["courses"][number] | undefined {
  const q = subjectOrCourseText.trim().toLowerCase();
  if (!q) return undefined;
  return (
    u.courses.find((c) => c.subject.toLowerCase().includes(q)) ??
    u.courses.find((c) => c.name.toLowerCase().includes(q))
  );
}

// Annual fee for whichever of the university's own courses best matches the given subject/course
// text — falls back to the university's general tuition figure when nothing matches (e.g. no
// subject filter is active, or the university simply doesn't offer that subject).
export function courseFeeForSubject(u: University, subjectOrCourseText: string): number {
  return matchingCourse(u, subjectOrCourseText)?.feeUSD ?? tuitionInUSD(u);
}

// A real scholarship figure to show alongside a course/fee — the university's own first named
// scholarship's amount (as Data Management typed it, e.g. "Up to £10,000", already in the right
// currency) when one's been entered, falling back to a bare "Scholarships available" when the flag
// is set but nothing's been named yet, and null (hide the stat entirely) when the university has no
// scholarships at all. Previously this derived a fabricated ~30%-of-tuition estimate instead of the
// university's actual scholarship data, which both invented a number nobody entered and showed it
// with the wrong currency symbol.
export function scholarshipLabel(u: University): string | null {
  const named = u.scholarships ?? [];
  if (named.length > 0) return named[0].amount;
  return u.scholarshipsAvailable ? "Scholarships available" : null;
}

/** Short, single-line form of the minimum deposit — for compact program-row chips, not the full
 * "50% of first year tuition fees" wording PaymentRequirementsBlock uses on the university page. */
export function depositLabel(u: University): string | null {
  if (u.depositMode === "half") return "50% deposit";
  if (u.depositMode === "full") return "Full deposit";
  if (u.minimumDepositAmount != null) return `${u.currencySymbol}${u.minimumDepositAmount.toLocaleString()} deposit`;
  return null;
}

/** Whether a course currently has at least one intake month marked open — students, agents, and
 * counsellors can only apply to a course while this is true. Uses the course's own `intakes`
 * subset when it has one, falling back to the university's full intake list otherwise (same
 * fallback CourseView/FactTile displays already use for "intake"). Missing `intakeStatus` (a
 * university that's never had any intake marked open) counts as closed, not open — the point of
 * this gate is to require an explicit "Open" from Data Management, not assume one. */
export function courseHasOpenIntake(u: University, course: University["courses"][number]): boolean {
  const months = course.intakes && course.intakes.length > 0 ? course.intakes : u.intakes;
  return months.some((m) => !!u.intakeStatus?.[m]);
}

export interface Campus {
  name: string;
  city: string;
  feeUSD: number;
}

// Prefers the university's own real campus records when Data Management has entered any — falls
// back to generic, deterministic variants on the main course fee so a university that predates
// real campus data (or that genuinely only has one city) still offers a real choice, without
// inventing specific real-world satellite-campus names for it.
/** The campuses a course can be applied to: the university's real campuses, narrowed to the ones
 * Data Management ticked on the course (`campusIds`) when it set any — a course that runs at only
 * some campuses shouldn't offer the others. Falls back to a synthetic pair for universities that
 * haven't entered campuses yet. */
export function campusesFor(u: University, course: { feeUSD: number; campusIds?: string[] }): Campus[] {
  const feeUSD = course.feeUSD;
  if (u.campuses && u.campuses.length > 0) {
    const ids = course.campusIds ?? [];
    const own = ids.length ? u.campuses.filter((c) => ids.includes(c.id)) : [];
    const list = own.length ? own : u.campuses;
    return list.map((c) => ({ name: c.name, city: c.city, feeUSD: c.feeUSD ?? feeUSD }));
  }
  return [
    { name: "Main Campus", city: u.city, feeUSD },
    { name: `${u.city} City Campus`, city: u.city, feeUSD: Math.round((feeUSD * 0.98) / 100) * 100 },
  ];
}

/** Short label for a course's campus(es) — for the "Campus" fact tile on course pages. */
export function campusLabelFor(u: University, course: { feeUSD: number; campusIds?: string[] }): string {
  const list = campusesFor(u, course);
  if (list.length === 0) return "Main Campus";
  if (list.length === 1) return list[0].name;
  if (!(course.campusIds ?? []).length) return `All ${list.length} campuses`;
  return `${list[0].name} +${list.length - 1}`;
}

export interface SubjectStat {
  name: string;
  universityCount: number;
  minFeeUSD: number;
  maxFeeUSD: number;
}

// One row per field of study, used to render the "Subjects" tab on Explore — counts how many
// universities offer it and the USD fee range across their matching courses.
export function subjectStats(): SubjectStat[] {
  const universities = getAllUniversities();
  return getAllSubjects().map((subject) => {
    const offeringUniversities = universities.filter((u) => u.subjects.includes(subject));
    const fees = universities.flatMap((u) => u.courses.filter((c) => c.subject === subject).map((c) => c.feeUSD));
    return {
      name: subject,
      universityCount: offeringUniversities.length,
      minFeeUSD: fees.length ? Math.min(...fees) : 0,
      maxFeeUSD: fees.length ? Math.max(...fees) : 0,
    };
  }).filter((s) => s.universityCount > 0);
}

export interface CountryStat {
  name: string;
  universityCount: number;
  courseCount: number;
}

// One row per destination country, used to render the "Countries" tab on Explore — the card-grid
// entry point into browsing by destination, same shape as subjectStats() above but for country.
// Includes every country Data Management has registered, even ones with zero universities yet —
// a country can carry real Overview/Country Guide content (see CountryOverview.tsx) worth browsing
// into before any partner university has been added under it, and hiding it here just made it
// silently disappear from Explore while staff's and counsellor's own country lists still showed it.
export function countryStats(): CountryStat[] {
  const universities = getAllUniversities();
  const byCountry = new Map<string, University[]>();
  universities.forEach((u) => {
    const list = byCountry.get(u.country) ?? [];
    list.push(u);
    byCountry.set(u.country, list);
  });
  getAllCountries().forEach((c) => {
    if (!byCountry.has(c.name)) byCountry.set(c.name, []);
  });
  return Array.from(byCountry.entries())
    .map(([name, list]) => ({ name, universityCount: list.length, courseCount: list.reduce((sum, u) => sum + u.courses.length, 0) }))
    .sort((a, b) => b.universityCount - a.universityCount);
}

// Where a course is actually taught: the cities of the campuses Data Management ticked on it (all of
// the university's campuses when it ticked none), plus the university's state/province. A university
// that hasn't entered campuses falls back to its own city. This is the single source for the
// "City / State" filter, so one pick covers both a city ("Manchester") and a region ("Ontario").
function courseLocations(u: University, c: University["courses"][number]): string[] {
  const campuses = u.campuses ?? [];
  const ids = c.campusIds ?? [];
  const own = ids.length ? campuses.filter((k) => ids.includes(k.id)) : [];
  const used = own.length ? own : campuses;
  const cities = used.map((k) => k.city).filter(Boolean);
  return [...(cities.length ? cities : [u.city]), ...(u.state ? [u.state] : [])].filter(Boolean);
}

function universityLocations(u: University): string[] {
  const set = new Set<string>([u.city, ...(u.state ? [u.state] : [])]);
  u.courses.forEach((c) => courseLocations(u, c).forEach((l) => set.add(l)));
  return [...set].filter(Boolean);
}

/** Every city/state a course is taught in, narrowed to the chosen country. */
export function locationOptions(destination = ""): string[] {
  const seen = new Map<string, string>();
  getAllUniversities().filter((u) => !destination || u.country === destination).forEach((u) => {
    universityLocations(u).forEach((l) => { const k = normalizeText(l.trim()); if (k && !seen.has(k)) seen.set(k, l.trim()); });
  });
  return [...seen.values()].sort((x, y) => x.localeCompare(y));
}

// Some university.country values are short forms ("UK") that don't match the full country
// names used by the residence-country picker ("United Kingdom") — normalize for comparison only.
function fullCountryName(country: string): string {
  return country === "UK" ? "United Kingdom" : country;
}

export interface UniversityFilterState {
  residenceCountry: string; // countries.ts iso2, "" = not set — doubles as "Student's Nationality" in Advanced Search
  destination: string; // "" = any — "Country" in Advanced Search
  location: string; // "" = any — a city (from the course's campuses) or the university's state/province
  studentState: string; // "" = not set — the student's own home state, matched against restrictedRegions
  universityQuery: string;
  courseQuery: string;
  duration: string; // "" = any
  level: string; // "" = any
  year: string; // "" = any
  disciplineArea: string; // "" = any
  intakes: Set<string>;
  standardizedTests: Set<string>;
  acceptedEnglishTests: Set<string>;
  minFeeUSD: string;
  maxFeeUSD: string;
  englishTestName: string;
  englishScore: string; // "" = not provided
  accreditedOnly: boolean;
  scholarshipOnly: boolean;
  minGPA: string; // "" = any
  withoutEnglishProficiency: boolean; // moiAccepted
  withoutGRE: boolean;
  withoutGMAT: boolean;
  withoutMaths: boolean;
  stemOnly: boolean;
  accepts15YearsOnly: boolean;
  feeWaiverOnly: boolean;
  eslElpOnly: boolean;
  openProgramsOnly: boolean;
}

export function emptyFilters(residenceCountry = ""): UniversityFilterState {
  return {
    residenceCountry,
    destination: "",
    location: "",
    studentState: "",
    universityQuery: "",
    courseQuery: "",
    duration: "",
    level: "",
    year: "",
    disciplineArea: "",
    intakes: new Set(),
    standardizedTests: new Set(),
    acceptedEnglishTests: new Set(),
    minFeeUSD: String(FEE_MIN_USD),
    maxFeeUSD: String(FEE_MAX_USD),
    englishTestName: "IELTS",
    englishScore: "",
    accreditedOnly: false,
    scholarshipOnly: false,
    minGPA: "",
    withoutEnglishProficiency: false,
    withoutGRE: false,
    withoutGMAT: false,
    withoutMaths: false,
    stemOnly: false,
    accepts15YearsOnly: false,
    feeWaiverOnly: false,
    eslElpOnly: false,
    openProgramsOnly: false,
  };
}

export function countActiveFilters(f: UniversityFilterState): number {
  let n = 0;
  if (f.destination) n++;
  if (f.location) n++;
  if (f.studentState) n++;
  if (f.universityQuery.trim()) n++;
  if (f.courseQuery.trim()) n++;
  if (f.duration) n++;
  if (f.level) n++;
  if (f.year) n++;
  if (f.disciplineArea) n++;
  if (f.intakes.size > 0) n++;
  if (f.standardizedTests.size > 0) n++;
  if (f.acceptedEnglishTests.size > 0) n++;
  { const r = feeRange(f); if (r.min > FEE_MIN_USD || r.max < FEE_MAX_USD) n++; }
  if (f.englishScore) n++;
  if (f.accreditedOnly) n++;
  if (f.scholarshipOnly) n++;
  if (f.minGPA) n++;
  if (f.withoutEnglishProficiency) n++;
  if (f.withoutGRE) n++;
  if (f.withoutGMAT) n++;
  if (f.withoutMaths) n++;
  if (f.stemOnly) n++;
  if (f.accepts15YearsOnly) n++;
  if (f.feeWaiverOnly) n++;
  if (f.eslElpOnly) n++;
  if (f.openProgramsOnly) n++;
  return n;
}

// ---- Free-text search -------------------------------------------------------------------------
// Every word the student types must appear somewhere in the searchable text (any order, any field),
// ignoring case and accents — so "msc data leeds", "data science uk" and "leeds computer" all find
// what Data Management entered, instead of requiring one field to contain the whole phrase.
function normalizeText(text: string): string {
  return text.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

function searchTokens(query: string): string[] {
  return normalizeText(query).split(/[\s,]+/).filter(Boolean);
}

// The university's own details only. Its `subjects` list is deliberately NOT here: Data Management's
// server merges every course's subject into it, so including it would make a search for one subject
// match every course of any university that offers that subject somewhere.
function universitySearchText(u: University): string {
  return normalizeText([u.name, u.city, u.state ?? "", u.country, fullCountryName(u.country), ...(u.tags ?? [])].join(" | "));
}

function courseSearchText(u: University, c: University["courses"][number]): string {
  return normalizeText([c.name, c.subject, c.level, c.studyMode ?? "", c.duration, ...(c.programLevel ?? []), ...courseLocations(u, c)].join(" | "));
}

function tokensMatch(text: string, tokens: string[]): boolean {
  return tokens.every((t) => text.includes(t));
}

// 0 is a legitimate slider position (max fee "$0"), so test for a real number rather than truthiness.
function feeRange(f: UniversityFilterState): { min: number; max: number } {
  const min = Number(f.minFeeUSD), max = Number(f.maxFeeUSD);
  return { min: f.minFeeUSD !== "" && Number.isFinite(min) ? min : FEE_MIN_USD, max: f.maxFeeUSD !== "" && Number.isFinite(max) ? max : FEE_MAX_USD };
}

// Fee actually charged for a course (USD): the course's own fee, else the university's tuition row.
function courseFeeUSD(u: University, c: University["courses"][number]): number {
  return c.feeUSD > 0 ? c.feeUSD : tuitionInUSD(u);
}

/** The university-wide (non-course) part of the filters, as a predicate built once per filter state. */
function makeUniversityGate(f: UniversityFilterState): (u: University) => boolean {
  const residenceName = f.residenceCountry ? countryByIso2(f.residenceCountry)?.name : undefined;
  const englishScore = f.englishScore ? Number(f.englishScore) : null;
  const ieltsEquivalent = englishScore !== null ? toIELTSEquivalent(f.englishTestName, englishScore) : null;
  const gpa = f.minGPA ? Number(f.minGPA) : null;
  const universityQuery = normalizeText(f.universityQuery.trim());
  return (u) => {
    if (residenceName && fullCountryName(u.country) === residenceName) return false;
    if (f.destination && u.country !== f.destination) return false;
    if (f.studentState && (u.restrictedRegions ?? []).some((r) => r.toLowerCase() === f.studentState.toLowerCase())) return false;
    if (universityQuery && !normalizeText(u.name).includes(universityQuery)) return false;
    if (f.year && !universityYears(u).has(f.year)) return false;
    if (f.acceptedEnglishTests.size > 0) {
      const accepted = universityAcceptedEnglishTests(u);
      if (![...f.acceptedEnglishTests].some((t) => accepted.has(t))) return false;
    }
    if (ieltsEquivalent !== null && u.minIELTS > ieltsEquivalent) return false;
    if (f.accreditedOnly && u.accreditations.length === 0) return false;
    if (f.scholarshipOnly && !u.scholarshipsAvailable) return false;
    if (gpa !== null && u.minGPA > gpa) return false;
    if (f.withoutEnglishProficiency && !u.moiAccepted) return false;
    if (f.feeWaiverOnly && !u.applicationFeeWaiverAvailable) return false;
    if (f.eslElpOnly && !u.eslElpAvailable) return false;
    return true;
  };
}

// Whether any filter can only be satisfied by a course (so a university with no courses entered yet can't pass).
function courseConditionsActive(f: UniversityFilterState): boolean {
  const { min, max } = feeRange(f);
  return (
    !!(f.courseQuery.trim() || f.disciplineArea || f.duration || f.level) ||
    f.standardizedTests.size > 0 || f.withoutGRE || f.withoutGMAT || f.withoutMaths || f.stemOnly ||
    f.accepts15YearsOnly || f.openProgramsOnly || f.intakes.size > 0 || min > FEE_MIN_USD || max < FEE_MAX_USD
  );
}

// A university with no courses entered can still be found by its own details (name, place, tags, subjects).
function courselessUniversityPasses(u: University, f: UniversityFilterState, tokens: string[]): boolean {
  if (f.location && !universityLocations(u).some((l) => normalizeText(l.trim()) === normalizeText(f.location.trim()))) return false;
  if (courseConditionsActive(f)) return false;
  return tokens.length === 0 || tokensMatch(`${universitySearchText(u)} | ${normalizeText((u.subjects ?? []).join(" | "))}`, tokens);
}

export function applyFilters(universities: University[], f: UniversityFilterState, searchQuery = ""): University[] {
  const universityGate = makeUniversityGate(f);
  const tokens = searchTokens(searchQuery);

  return universities.filter((u) => {
    if (!universityGate(u)) return false;

    // Search text and every course-level filter are judged against the SAME course, so e.g. "Level:
    // Postgraduate" + "Duration: 1 year" only keeps a university that has one course that is both.
    if (u.courses.length > 0) return u.courses.some((c) => courseMatchesFilters(u, c, f, searchQuery));
    return courselessUniversityPasses(u, f, tokens);
  });
}

// ---- Linked dropdown options ----------------------------------------------------------------------
// Each dropdown in Advanced Search lists only values that still exist among the courses passing every
// OTHER filter — pick a country and the cities, universities, courses, intakes and levels shrink to
// that country; pick an intake and the universities/courses narrow to ones running it; and so on. A
// field's own selection is left out of its own list, so you can always switch it to a sibling value.
export type FacetKey = "destination" | "location" | "university" | "course" | "discipline" | "level" | "duration" | "intake";

export function facetOptions(f: UniversityFilterState, facet: FacetKey): string[] {
  const g: UniversityFilterState = { ...f };
  switch (facet) {
    case "destination": g.destination = ""; break;
    case "location": g.location = ""; break;
    case "university": g.universityQuery = ""; break;
    case "course": g.courseQuery = ""; break;
    case "discipline": g.disciplineArea = ""; break;
    case "level": g.level = ""; break;
    case "duration": g.duration = ""; break;
    case "intake": g.intakes = new Set(); break;
  }
  const gate = makeUniversityGate(g);
  const seen = new Map<string, string>();
  const add = (v: string | undefined) => { const t = v?.trim(); if (t) { const k = normalizeText(t); if (!seen.has(k)) seen.set(k, t); } };
  getAllUniversities().forEach((u) => {
    if (!gate(u)) return;
    if (u.courses.length === 0) {
      if (!courselessUniversityPasses(u, g, [])) return;
      if (facet === "destination") add(u.country);
      else if (facet === "university") add(u.name);
      else if (facet === "location") universityLocations(u).forEach(add);
      else if (facet === "intake") u.intakes.forEach(add);
      return;
    }
    u.courses.forEach((c) => {
      if (!courseMatchesFilters(u, c, g)) return;
      switch (facet) {
        case "destination": add(u.country); break;
        case "location": courseLocations(u, c).forEach(add); break;
        case "university": add(u.name); break;
        case "course": add(c.name); break;
        case "discipline": add(getSubjectRecord(c.subject)?.disciplineArea); break;
        case "level": add(c.level); (c.programLevel ?? []).forEach(add); break;
        case "duration": add(c.duration); break;
        case "intake": (c.intakes && c.intakes.length > 0 ? c.intakes : u.intakes).forEach(add); break;
      }
    });
  });
  const out = [...seen.values()];
  if (facet === "intake") return out.sort((x, y) => MONTH_ORDER.indexOf(x) - MONTH_ORDER.indexOf(y));
  if (facet === "duration") return out.sort((x, y) => (parseFloat(x) || 0) - (parseFloat(y) || 0) || x.localeCompare(y));
  if (facet === "level") {
    const tax = PROGRAM_LEVEL_OPTIONS as readonly string[];
    return [...out.filter((l) => !tax.includes(l)).sort(), ...tax.filter((l) => out.includes(l))];
  }
  return out.sort((x, y) => x.localeCompare(y));
}

// Course-level counterpart to applyFilters(): applyFilters() keeps a university when *any* of its
// courses matches, which is right for the Universities tab but leaves the flat program list showing
// every course of a surviving university. This narrows that list to the courses that actually match
// the search text and the course-specific Advanced Search fields.
export function courseMatchesFilters(u: University, c: University["courses"][number], f: UniversityFilterState, searchQuery = ""): boolean {
  const tokens = searchTokens(searchQuery);
  if (tokens.length > 0 && !tokensMatch(`${universitySearchText(u)} | ${courseSearchText(u, c)}`, tokens)) return false;
  const courseQuery = normalizeText(f.courseQuery.trim());
  if (courseQuery && !normalizeText(c.name).includes(courseQuery)) return false;
  const { min: minFee, max: maxFee } = feeRange(f);
  if (minFee > FEE_MIN_USD || maxFee < FEE_MAX_USD) {
    const fee = courseFeeUSD(u, c);
    if (fee < minFee || fee > maxFee) return false;
  }
  if (f.location) {
    const want = normalizeText(f.location.trim());
    if (!courseLocations(u, c).some((l) => normalizeText(l.trim()) === want)) return false;
  }
  if (f.disciplineArea && getSubjectRecord(c.subject)?.disciplineArea !== f.disciplineArea) return false;
  if (f.duration && c.duration !== f.duration) return false;
  if (f.level && c.level !== f.level && !(c.programLevel ?? []).includes(f.level)) return false;
  if (f.standardizedTests.size > 0 && !(c.standardizedTests ?? []).some((t) => f.standardizedTests.has(t))) return false;
  if (f.withoutGRE && (c.standardizedTests ?? []).includes("GRE")) return false;
  if (f.withoutGMAT && (c.standardizedTests ?? []).includes("GMAT")) return false;
  if (f.withoutMaths && c.mathsRequired !== false) return false;
  if (f.stemOnly && !c.isStemProgram) return false;
  if (f.accepts15YearsOnly && !c.accepts15YearsEducation) return false;
  if (f.intakes.size > 0) {
    const months = c.intakes && c.intakes.length > 0 ? c.intakes : u.intakes;
    if (!months.some((m) => f.intakes.has(m))) return false;
  }
  if (f.openProgramsOnly && !courseHasOpenIntake(u, c)) return false;
  return true;
}
