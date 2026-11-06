// Client for the server-side catalog search (POST /api/courses/search, /api/courses/facets — server/src/courseSearch.js).
// The Explore page used to download the whole catalog and filter it in the browser; now it sends the same filters to the
// server and gets back one page of card-sized rows. The server runs a line-for-line port of utils/universityFilter.ts, so the
// same filters give the same results — everything that needs a browser-only lookup is resolved HERE and sent along.
import { apiPost } from "../utils/apiClient";
import { countryByIso2 } from "./countries";
import { getCountryByName } from "./countryRegistry";
import { getSubjectCatalog } from "./subjectCatalogStore";
import { toIELTSEquivalent, type UniversityFilterState } from "../utils/universityFilter";
import type { University } from "../types";

type Course = University["courses"][number];

/** The university fields a list card shows — never its courses. */
export type CardUniversity = Pick<
  University,
  "id" | "name" | "city" | "country" | "tags" | "openIntake" | "logoUrl" | "scholarshipsAvailable" | "scholarships" | "currencySymbol" |
  "depositMode" | "minimumDepositAmount" | "worldRank" | "employability" | "intakes" | "intakeStatus"
>;
export type CardCourse = Pick<Course, "id" | "name" | "level" | "duration" | "subject" | "feeUSD" | "feeStatus" | "currencySymbol" | "intakes" | "studyMode">;
export interface ProgramRow { university: CardUniversity; course: CardCourse }

export interface SearchPage<T> { items: T[]; total: number; page: number; limit: number; currencies?: string[] }

export type SortBy = "best" | "rank" | "feeLow" | "feeHigh" | "employability" | "name";

/** The UI filter state as the server wants it (Sets → arrays, browser-only lookups resolved). */
export function toSearchFilters(f: UniversityFilterState) {
  const score = f.englishScore ? Number(f.englishScore) : null;
  const ielts = score !== null ? toIELTSEquivalent(f.englishTestName, score) : null;
  const areas = f.disciplineArea;
  return {
    residenceName: f.residenceCountry ? countryByIso2(f.residenceCountry)?.name : undefined,
    destination: [...f.destination],
    location: [...f.location],
    studentState: f.studentState,
    universities: [...f.universities],
    courseQuery: f.courseQuery,
    duration: [...f.duration],
    level: [...f.level],
    year: f.year,
    // "Discipline area" is a property of a subject, which the browser's subject list knows: send the subjects in the chosen areas.
    disciplineSubjects: areas.size > 0 ? getSubjectCatalog().filter((s) => areas.has(s.disciplineArea ?? "")).map((s) => s.name) : null,
    intakes: [...f.intakes],
    standardizedTests: [...f.standardizedTests],
    acceptedEnglishTests: [...f.acceptedEnglishTests],
    minFee: f.minFee,
    maxFee: f.maxFee,
    feeCurrency: f.feeCurrency,
    // Country Management's configured currencies for the chosen destinations — they come first when picking a default currency.
    feeCurrencyConfigured: [...f.destination].flatMap((d) => getCountryByName(d)?.currencySymbols ?? []),
    includeUnknownFee: f.includeUnknownFee,
    ieltsEquivalent: ielts !== null && Number.isFinite(ielts) ? ielts : null,
    gpa: f.minGPA && Number.isFinite(Number(f.minGPA)) ? Number(f.minGPA) : null,
    accreditedOnly: f.accreditedOnly,
    scholarshipOnly: f.scholarshipOnly,
    withoutEnglishProficiency: f.withoutEnglishProficiency,
    moiUniversity: f.moiUniversity,
    withoutGRE: f.withoutGRE,
    withoutGMAT: f.withoutGMAT,
    withoutMaths: f.withoutMaths,
    stemOnly: f.stemOnly,
    accepts15YearsOnly: f.accepts15YearsOnly,
    feeWaiverOnly: f.feeWaiverOnly,
    eslElpOnly: f.eslElpOnly,
    openProgramsOnly: f.openProgramsOnly,
  };
}
export type SearchFilters = ReturnType<typeof toSearchFilters>;

export interface SearchParams {
  view: "courses" | "universities";
  q: string;
  filters: SearchFilters;
  sort: SortBy;
  sortCurrency: string;
  page: number;
  limit: number;
  shortlistKeys?: string[];
}

export const searchPrograms = (p: SearchParams) => apiPost<SearchPage<ProgramRow>>("/api/courses/search", p);
export const searchUniversities = (p: SearchParams) => apiPost<SearchPage<CardUniversity>>("/api/courses/search", p);

export interface Facets {
  facets: Partial<Record<"destination" | "location" | "university" | "course" | "subject" | "duration" | "level" | "intake", string[]>>;
  years: string[];
  intakesAll: string[];
  currenciesUsed: string[];
  locationsForDestination: string[];
  feeStats: { unknown: number; otherCurrency: number };
  feeCurrency: string;
}
export const fetchFacets = (filters: SearchFilters, facets?: string[]) => apiPost<Facets>("/api/courses/facets", { filters, facets });

/** Card rows are not full University/Course records (no campuses, descriptions…), but carry everything the cards read. */
export const asUniversity = (u: CardUniversity) => u as unknown as University;
export const asCourse = (c: CardCourse) => c as unknown as Course;
