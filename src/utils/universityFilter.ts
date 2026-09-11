import { UNIVERSITIES } from "../data/mockData";
import { FIELDS_OF_STUDY } from "../data/fields";
import { countryByIso2 } from "../data/countries";
import type { University } from "../types";

export const DESTINATION_OPTIONS = Array.from(new Set(UNIVERSITIES.map((u) => u.country)));
export const CITY_OPTIONS = Array.from(new Set(UNIVERSITIES.map((u) => u.city))).sort();
export const UNIVERSITY_OPTIONS = UNIVERSITIES.map((u) => u.name);
export const COURSE_OPTIONS = Array.from(new Set(UNIVERSITIES.flatMap((u) => u.courses.map((c) => c.name)))).sort();
export const DURATION_OPTIONS = Array.from(new Set(UNIVERSITIES.flatMap((u) => u.courses.map((c) => c.duration)))).sort(
  (a, b) => parseFloat(a) - parseFloat(b)
);
export const LEVEL_OPTIONS = Array.from(new Set(UNIVERSITIES.flatMap((u) => u.courses.map((c) => c.level))));
export const SUBJECT_OPTIONS = FIELDS_OF_STUDY;
const MONTH_ORDER = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
export const INTAKE_OPTIONS = Array.from(new Set(UNIVERSITIES.flatMap((u) => u.intakes))).sort(
  (a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)
);
export const ACCREDITATION_OPTIONS = Array.from(new Set(UNIVERSITIES.flatMap((u) => u.accreditations))).sort();

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
export const ALL_PROGRAMS: ProgramOffering[] = UNIVERSITIES.flatMap((u) => u.courses.map((course) => ({ university: u, course })));

// English test name options and their raw score scales, used to convert whatever test/score
// the student enters into an IELTS-equivalent for comparison against each university's minIELTS.
export const TEST_NAME_OPTIONS = ["IELTS", "TOEFL iBT", "PTE Academic", "Duolingo English Test", "Other"] as const;
const TEST_SCALES: Record<string, { min: number; max: number }> = {
  "IELTS": { min: 0, max: 9 },
  "TOEFL iBT": { min: 0, max: 120 },
  "PTE Academic": { min: 10, max: 90 },
  "Duolingo English Test": { min: 10, max: 160 },
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

// Approximate "up to" scholarship value for a course — real per-course scholarship amounts aren't
// in the data model, so this derives a plausible figure (~30% of tuition, rounded) whenever the
// university offers scholarships at all. Returns null when it doesn't, so callers can hide the stat.
export function scholarshipAmountUSD(u: University, feeUSD: number): number | null {
  if (!u.scholarshipsAvailable) return null;
  return Math.round((feeUSD * 0.3) / 500) * 500;
}

export interface Campus {
  name: string;
  city: string;
  feeUSD: number;
}

// Real per-campus fee data isn't in the model — these are clearly-generic, deterministic variants
// on the main course fee so a university with a single modelled city still offers a real choice,
// without inventing specific real-world satellite-campus names for a real institution.
export function campusesFor(u: University, feeUSD: number): Campus[] {
  return [
    { name: "Main Campus", city: u.city, feeUSD },
    { name: `${u.city} City Campus`, city: u.city, feeUSD: Math.round((feeUSD * 0.98) / 100) * 100 },
  ];
}

export interface SubjectStat {
  name: string;
  universityCount: number;
  minFeeUSD: number;
  maxFeeUSD: number;
}

// One row per field of study, used to render the "Subjects" tab on Explore — counts how many
// universities offer it and the USD fee range across their matching courses.
export const SUBJECT_STATS: SubjectStat[] = FIELDS_OF_STUDY.map((subject) => {
  const offeringUniversities = UNIVERSITIES.filter((u) => u.subjects.includes(subject));
  const fees = UNIVERSITIES.flatMap((u) => u.courses.filter((c) => c.subject === subject).map((c) => c.feeUSD));
  return {
    name: subject,
    universityCount: offeringUniversities.length,
    minFeeUSD: fees.length ? Math.min(...fees) : 0,
    maxFeeUSD: fees.length ? Math.max(...fees) : 0,
  };
}).filter((s) => s.universityCount > 0);

export function citiesForDestination(destination: string): string[] {
  if (!destination) return CITY_OPTIONS;
  return Array.from(new Set(UNIVERSITIES.filter((u) => u.country === destination).map((u) => u.city))).sort();
}

// Some university.country values are short forms ("UK") that don't match the full country
// names used by the residence-country picker ("United Kingdom") — normalize for comparison only.
function fullCountryName(country: string): string {
  return country === "UK" ? "United Kingdom" : country;
}

export interface UniversityFilterState {
  residenceCountry: string; // countries.ts iso2, "" = not set
  destination: string; // "" = any
  city: string; // "" = any
  universityQuery: string;
  courseQuery: string;
  duration: string; // "" = any
  level: string; // "" = any
  subjectQuery: string;
  intakes: Set<string>;
  minFeeUSD: string;
  maxFeeUSD: string;
  englishTestName: string;
  englishScore: string; // "" = not provided
  accreditedOnly: boolean;
  scholarshipOnly: boolean;
  minGPA: string; // "" = any
}

export function emptyFilters(residenceCountry = ""): UniversityFilterState {
  return {
    residenceCountry,
    destination: "",
    city: "",
    universityQuery: "",
    courseQuery: "",
    duration: "",
    level: "",
    subjectQuery: "",
    intakes: new Set(),
    minFeeUSD: String(FEE_MIN_USD),
    maxFeeUSD: String(FEE_MAX_USD),
    englishTestName: "IELTS",
    englishScore: "",
    accreditedOnly: false,
    scholarshipOnly: false,
    minGPA: "",
  };
}

export function countActiveFilters(f: UniversityFilterState): number {
  let n = 0;
  if (f.destination) n++;
  if (f.city) n++;
  if (f.universityQuery.trim()) n++;
  if (f.courseQuery.trim()) n++;
  if (f.duration) n++;
  if (f.level) n++;
  if (f.subjectQuery.trim()) n++;
  if (f.intakes.size > 0) n++;
  if (Number(f.minFeeUSD) > FEE_MIN_USD || Number(f.maxFeeUSD) < FEE_MAX_USD) n++;
  if (f.englishScore) n++;
  if (f.accreditedOnly) n++;
  if (f.scholarshipOnly) n++;
  if (f.minGPA) n++;
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
    if (universityQuery && !u.name.toLowerCase().includes(universityQuery)) return false;
    if (courseQuery && !u.courses.some((c) => c.name.toLowerCase().includes(courseQuery))) return false;
    if (f.duration && !u.courses.some((c) => c.duration === f.duration)) return false;
    if (f.level && !u.courses.some((c) => c.level === f.level)) return false;
    if (subjectQuery && !u.subjects.some((s) => s.toLowerCase().includes(subjectQuery))) return false;
    if (f.intakes.size > 0 && !u.intakes.some((i) => f.intakes.has(i))) return false;
    if (tuitionInUSD(u) < minFee || tuitionInUSD(u) > maxFee) return false;
    if (ieltsEquivalent !== null && u.minIELTS > ieltsEquivalent) return false;
    if (f.accreditedOnly && u.accreditations.length === 0) return false;
    if (f.scholarshipOnly && !u.scholarshipsAvailable) return false;
    if (gpa !== null && u.minGPA > gpa) return false;
    return true;
  });
}
