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
  return Array.from(new Set(getAllUniversities().map((u) => u.country)));
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
  return Array.from(new Set(getAllUniversities().flatMap((u) => u.courses.map((c) => c.duration)))).sort(
    (a, b) => parseFloat(a) - parseFloat(b)
  );
}
export function levelOptions(): string[] {
  return Array.from(new Set(getAllUniversities().flatMap((u) => u.courses.map((c) => c.level))));
}
export function subjectOptions(): string[] {
  return getAllSubjects();
}
const MONTH_ORDER = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export function intakeOptions(): string[] {
  return Array.from(new Set(getAllUniversities().flatMap((u) => u.intakes))).sort(
    (a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)
  );
}
export function accreditationOptions(): string[] {
  return Array.from(new Set(getAllUniversities().flatMap((u) => u.accreditations))).sort();
}
export function provinceOptions(): string[] {
  return Array.from(new Set(getAllUniversities().map((u) => u.state).filter((s): s is string => !!s))).sort();
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

// Real, distinct field-of-study groupings above Subject — see Subject.disciplineArea.
function universityDisciplineAreas(u: University): Set<string> {
  const areas = new Set<string>();
  u.subjects.forEach((s) => {
    const area = getSubjectRecord(s)?.disciplineArea;
    if (area) areas.add(area);
  });
  return areas;
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

export function citiesForDestination(destination: string): string[] {
  const universities = getAllUniversities();
  if (!destination) return Array.from(new Set(universities.map((u) => u.city))).sort();
  return Array.from(new Set(universities.filter((u) => u.country === destination).map((u) => u.city))).sort();
}

// Some university.country values are short forms ("UK") that don't match the full country
// names used by the residence-country picker ("United Kingdom") — normalize for comparison only.
function fullCountryName(country: string): string {
  return country === "UK" ? "United Kingdom" : country;
}

export interface UniversityFilterState {
  residenceCountry: string; // countries.ts iso2, "" = not set — doubles as "Student's Nationality" in Advanced Search
  destination: string; // "" = any — "Country" in Advanced Search
  city: string; // "" = any
  province: string; // "" = any — the university's own state/province (its location)
  studentState: string; // "" = not set — the student's own home state, matched against restrictedRegions
  universityQuery: string;
  courseQuery: string;
  duration: string; // "" = any
  level: string; // "" = any
  year: string; // "" = any
  subjectQuery: string;
  disciplineArea: string; // "" = any
  intakes: Set<string>;
  programLevel: string; // "" = any
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
    city: "",
    province: "",
    studentState: "",
    universityQuery: "",
    courseQuery: "",
    duration: "",
    level: "",
    year: "",
    subjectQuery: "",
    disciplineArea: "",
    intakes: new Set(),
    programLevel: "",
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
  if (f.city) n++;
  if (f.province) n++;
  if (f.studentState) n++;
  if (f.universityQuery.trim()) n++;
  if (f.courseQuery.trim()) n++;
  if (f.duration) n++;
  if (f.level) n++;
  if (f.year) n++;
  if (f.subjectQuery.trim()) n++;
  if (f.disciplineArea) n++;
  if (f.intakes.size > 0) n++;
  if (f.programLevel) n++;
  if (f.standardizedTests.size > 0) n++;
  if (f.acceptedEnglishTests.size > 0) n++;
  if (Number(f.minFeeUSD) > FEE_MIN_USD || Number(f.maxFeeUSD) < FEE_MAX_USD) n++;
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

export function applyFilters(universities: University[], f: UniversityFilterState, searchQuery = ""): University[] {
  const q = searchQuery.trim().toLowerCase();
  const residenceName = f.residenceCountry ? countryByIso2(f.residenceCountry)?.name : undefined;
  const minFee = Number(f.minFeeUSD) || FEE_MIN_USD;
  const maxFee = Number(f.maxFeeUSD) || FEE_MAX_USD;
  const englishScore = f.englishScore ? Number(f.englishScore) : null;
  const ieltsEquivalent = englishScore !== null ? toIELTSEquivalent(f.englishTestName, englishScore) : null;
  const gpa = f.minGPA ? Number(f.minGPA) : null;
  const courseQuery = f.courseQuery.trim().toLowerCase();
  const universityQuery = f.universityQuery.trim().toLowerCase();
  const subjectQuery = f.subjectQuery.trim().toLowerCase();

  return universities.filter((u) => {
    if (q) {
      const matches =
        u.name.toLowerCase().includes(q) ||
        u.city.toLowerCase().includes(q) ||
        u.country.toLowerCase().includes(q) ||
        u.courses.some((c) => c.name.toLowerCase().includes(q));
      if (!matches) return false;
    }
    if (residenceName && fullCountryName(u.country) === residenceName) return false;
    if (f.destination && u.country !== f.destination) return false;
    if (f.city && u.city !== f.city) return false;
    if (f.province && u.state !== f.province) return false;
    if (f.studentState && (u.restrictedRegions ?? []).some((r) => r.toLowerCase() === f.studentState.toLowerCase())) return false;
    if (universityQuery && !u.name.toLowerCase().includes(universityQuery)) return false;
    if (courseQuery && !u.courses.some((c) => c.name.toLowerCase().includes(courseQuery))) return false;
    if (f.duration && !u.courses.some((c) => c.duration === f.duration)) return false;
    if (f.level && !u.courses.some((c) => c.level === f.level)) return false;
    if (f.year && !universityYears(u).has(f.year)) return false;
    if (subjectQuery && !u.subjects.some((s) => s.toLowerCase().includes(subjectQuery))) return false;
    if (f.disciplineArea && !universityDisciplineAreas(u).has(f.disciplineArea)) return false;
    if (f.intakes.size > 0 && !u.intakes.some((i) => f.intakes.has(i))) return false;
    if (f.programLevel && !u.courses.some((c) => (c.programLevel ?? []).includes(f.programLevel))) return false;
    if (f.standardizedTests.size > 0 && !u.courses.some((c) => (c.standardizedTests ?? []).some((t) => f.standardizedTests.has(t)))) return false;
    if (f.acceptedEnglishTests.size > 0) {
      const accepted = universityAcceptedEnglishTests(u);
      if (![...f.acceptedEnglishTests].some((t) => accepted.has(t))) return false;
    }
    if (tuitionInUSD(u) < minFee || tuitionInUSD(u) > maxFee) return false;
    if (ieltsEquivalent !== null && u.minIELTS > ieltsEquivalent) return false;
    if (f.accreditedOnly && u.accreditations.length === 0) return false;
    if (f.scholarshipOnly && !u.scholarshipsAvailable) return false;
    if (gpa !== null && u.minGPA > gpa) return false;
    if (f.withoutEnglishProficiency && !u.moiAccepted) return false;
    if (f.withoutGRE && !u.courses.some((c) => !(c.standardizedTests ?? []).includes("GRE"))) return false;
    if (f.withoutGMAT && !u.courses.some((c) => !(c.standardizedTests ?? []).includes("GMAT"))) return false;
    if (f.withoutMaths && !u.courses.some((c) => c.mathsRequired === false)) return false;
    if (f.stemOnly && !u.courses.some((c) => c.isStemProgram)) return false;
    if (f.accepts15YearsOnly && !u.courses.some((c) => c.accepts15YearsEducation)) return false;
    if (f.feeWaiverOnly && !u.applicationFeeWaiverAvailable) return false;
    if (f.eslElpOnly && !u.eslElpAvailable) return false;
    if (f.openProgramsOnly && !u.courses.some((c) => courseHasOpenIntake(u, c))) return false;
    return true;
  });
}
