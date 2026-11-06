// Server-side catalog search: the Explore page used to download the whole catalog (every university with every one of its
// ~28,000 courses, tens of MB) and filter it in the browser. This answers the same questions on the server and returns just
// one page of card-sized rows.
//
// Exactness is the point: `filterCourses` / `universityGate` below are a line-for-line port of src/utils/universityFilter.ts
// (applyFilters, courseMatchesFilters, makeUniversityGate, courselessUniversityPasses) so the same filters give the same
// results as before. server/test/courseSearch.parity.test.js runs both on the same data and requires identical output.
// Anything that depended on browser-only stores is resolved by the client and sent in the request instead:
//   residenceName      the nationality's country name           (client: countryByIso2)
//   feeCurrency        the currency the fee range is in          (client: activeFeeCurrency)
//   disciplineSubjects the subjects of the chosen discipline areas, or null when no area is chosen (client: subject catalog)
//   ieltsEquivalent    the entered English score as IELTS, or null  (client: toIELTSEquivalent)
//   gpa                the entered GPA, or null
//
// The index holds only the columns the filters and the cards read (no descriptions, modules, careers, requirements…), is
// built lazily from the database and rebuilt after any catalog write (see catalogCache.js's version counter).
const prisma = require("./prismaClient");
const { catalogVersion } = require("./catalogCache");

const FEE_MIN = 0;
const FEE_MAX = 100000;

// ---------------------------------------------------------------------------------------------------------------------
// Index
// ---------------------------------------------------------------------------------------------------------------------
const arr = (v) => (Array.isArray(v) ? v : []);

function slimUniversity(u) {
  return {
    id: u.id,
    name: u.name,
    city: u.city,
    state: u.state || undefined,
    country: u.country,
    tags: arr(u.tags),
    subjects: arr(u.subjects),
    intakes: arr(u.intakes),
    worldRank: u.worldRank,
    employability: u.employability,
    openIntake: u.openIntake,
    intakeStatus: u.intakeStatus || undefined,
    intakeDates: u.intakeDates || undefined,
    restrictedRegions: u.restrictedRegions && u.restrictedRegions.length ? u.restrictedRegions : undefined,
    englishRequirements: u.englishRequirements || undefined,
    campuses: u.campuses ? u.campuses.map((c) => ({ id: c.id, name: c.name, city: c.city })) : undefined,
    currencySymbol: u.currencySymbol,
    minIELTS: u.minIELTS,
    minGPA: u.minGPA,
    accreditations: arr(u.accreditations),
    scholarshipsAvailable: u.scholarshipsAvailable,
    scholarships: u.scholarships ? arr(u.scholarships).slice(0, 1).map((s) => ({ amount: s.amount })) : undefined,
    moiAccepted: u.moiAccepted ?? undefined,
    moiAcceptedUniversities: u.moiAcceptedUniversities && u.moiAcceptedUniversities.length ? u.moiAcceptedUniversities : undefined,
    applicationFeeWaiverAvailable: u.applicationFeeWaiverAvailable ?? undefined,
    eslElpAvailable: u.eslElpAvailable ?? undefined,
    minimumDepositAmount: u.minimumDepositAmount ?? undefined,
    depositMode: u.depositMode || undefined,
    logoUrl: u.logoUrl && !u.logoUrl.startsWith("data:") ? u.logoUrl : undefined,
  };
}

function slimCourse(c) {
  return {
    id: c.id,
    name: c.name,
    level: c.level,
    duration: c.duration,
    subject: c.subject,
    feeUSD: c.feeUSD,
    feeStatus: c.feeStatus,
    intakes: arr(c.intakes).length ? c.intakes : undefined,
    englishRequirements: c.englishRequirements ? arr(c.englishRequirements).map((e) => ({ testName: e.testName })) : undefined,
    currencySymbol: c.currencySymbol || undefined,
    campusIds: arr(c.campusIds).length ? c.campusIds : undefined,
    studyMode: c.studyMode || undefined,
    standardizedTests: arr(c.standardizedTests).length ? c.standardizedTests : undefined,
    programLevel: arr(c.programLevel).length ? c.programLevel : undefined,
    mathsRequired: c.mathsRequired,
    isStemProgram: c.isStemProgram,
    accepts15YearsEducation: c.accepts15YearsEducation,
  };
}

const UNIVERSITY_SELECT = {
  id: true, name: true, city: true, state: true, country: true, tags: true, subjects: true, intakes: true, worldRank: true,
  employability: true, openIntake: true, intakeStatus: true, intakeDates: true, restrictedRegions: true, englishRequirements: true,
  campuses: true, currencySymbol: true, minIELTS: true, minGPA: true, accreditations: true, scholarshipsAvailable: true,
  scholarships: true, moiAccepted: true, moiAcceptedUniversities: true, applicationFeeWaiverAvailable: true, eslElpAvailable: true,
  minimumDepositAmount: true, depositMode: true, logoUrl: true,
};
const COURSE_SELECT = {
  id: true, universityId: true, name: true, level: true, duration: true, subject: true, feeUSD: true, feeStatus: true, intakes: true,
  englishRequirements: true, currencySymbol: true, campusIds: true, studyMode: true, standardizedTests: true, programLevel: true,
  mathsRequired: true, isStemProgram: true, accepts15YearsEducation: true,
};

const COURSE_PAGE = 2000;

/** Builds the index from the database: universities in catalog order, each with its courses (by id, the order the full
 * catalog has always listed them in). Courses are read in pages so memory stays flat. */
async function loadIndex(startedAt) {
  const universities = await prisma.university.findMany({ select: UNIVERSITY_SELECT, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const byId = new Map();
  const list = universities.map((row) => {
    const u = slimUniversity(row);
    u.courses = [];
    byId.set(u.id, u);
    return u;
  });
  let cursor;
  for (;;) {
    const rows = await prisma.course.findMany({ select: COURSE_SELECT, orderBy: { id: "asc" }, take: COURSE_PAGE, ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}) });
    for (const row of rows) byId.get(row.universityId)?.courses.push(slimCourse(row));
    if (rows.length < COURSE_PAGE) break;
    cursor = rows[rows.length - 1].id;
  }
  return { version: startedAt, at: Date.now(), universities: list, byId };
}

let built = null;
let inflight = null;
const MAX_AGE_MS = 10 * 60 * 1000;
const MAX_STALE_MS = 3 * 60 * 1000;

function startBuild() {
  if (!inflight) {
    const v = catalogVersion();
    inflight = loadIndex(v).then((idx) => { built = idx; return idx; }).finally(() => { inflight = null; });
  }
  return inflight;
}

/** The current index. After a catalog write the previous one keeps serving for a short while while a new one builds. */
async function getIndex() {
  if (built) {
    const current = built.version === catalogVersion();
    const age = Date.now() - built.at;
    if (current && age < MAX_AGE_MS) return built;
    if (current || age < MAX_STALE_MS) {
      startBuild().catch((err) => console.warn("Search index refresh failed:", err));
      return built;
    }
  }
  return startBuild();
}

// ---------------------------------------------------------------------------------------------------------------------
// Fee rules (port of src/utils/courseFee.ts)
// ---------------------------------------------------------------------------------------------------------------------
function courseFeeKind(c) {
  if (c.feeStatus === "free") return "free";
  if (c.feeStatus !== "unknown" && Number.isFinite(c.feeUSD) && c.feeUSD > 0) return "amount";
  return "unknown";
}
const courseCurrencySymbol = (u, c) => ((c.currencySymbol && c.currencySymbol.trim() ? c.currencySymbol : u.currencySymbol) ?? "");
const sameCurrency = (a, b) => a.trim() === b.trim();
function courseFeeIn(u, c, currency) {
  const kind = courseFeeKind(c);
  if (kind === "unknown") return null;
  if (!sameCurrency(courseCurrencySymbol(u, c), currency)) return null;
  return kind === "free" ? 0 : c.feeUSD;
}
/** Every currency among the given (university, course) pairs, most common first. */
function currenciesOf(pairs) {
  const counts = new Map();
  for (const { u, c } of pairs) {
    const symbol = courseCurrencySymbol(u, c);
    const key = symbol.trim();
    if (!key) continue;
    const hit = counts.get(key);
    if (hit) hit.n++; else counts.set(key, { symbol, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((x) => x.symbol);
}

// ---------------------------------------------------------------------------------------------------------------------
// Filters (port of src/utils/universityFilter.ts)
// ---------------------------------------------------------------------------------------------------------------------
function normalizeText(text) {
  return text.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}
const searchTokens = (query) => normalizeText(query).split(/[\s,]+/).filter(Boolean);
const tokensMatch = (text, tokens) => tokens.every((t) => text.includes(t));
const fullCountryName = (country) => (country === "UK" ? "United Kingdom" : country);

function courseLocations(u, c) {
  const campuses = u.campuses ?? [];
  const ids = c.campusIds ?? [];
  const own = ids.length ? campuses.filter((k) => ids.includes(k.id)) : [];
  const used = own.length ? own : campuses;
  const cities = used.map((k) => k.city).filter(Boolean);
  return [...(cities.length ? cities : [u.city]), ...(u.state ? [u.state] : [])].filter(Boolean);
}
function universityLocations(u) {
  const set = new Set([u.city, ...(u.state ? [u.state] : [])]);
  u.courses.forEach((c) => courseLocations(u, c).forEach((l) => set.add(l)));
  return [...set].filter(Boolean);
}
function universityYears(u) {
  const years = new Set();
  Object.values(u.intakeDates ?? {}).forEach((d) => {
    const y = d.enrollmentDate?.slice(0, 4);
    if (y && /^\d{4}$/.test(y)) years.add(y);
  });
  (u.openIntake.match(/\d{4}/g) ?? []).forEach((y) => years.add(y));
  return years;
}
function universityAcceptedEnglishTests(u) {
  const names = new Set();
  const collect = (list) => list?.forEach((e) => names.add(e.testName));
  collect(u.englishRequirements?.undergraduate);
  collect(u.englishRequirements?.postgraduate);
  u.courses.forEach((c) => collect(c.englishRequirements));
  return names;
}
const universitySearchText = (u) => normalizeText([u.name, u.city, u.state ?? "", u.country, fullCountryName(u.country), ...(u.tags ?? [])].join(" | "));
const courseSearchText = (u, c) => normalizeText([c.name, c.subject, c.level, c.studyMode ?? "", c.duration, ...(c.programLevel ?? []), ...courseLocations(u, c)].join(" | "));

/** Turns the request's filter object into the lookup structures the predicates need (sets, parsed numbers). */
function prepareFilters(raw) {
  const r = raw || {};
  const set = (v) => new Set(arr(v));
  const minRaw = r.minFee === undefined || r.minFee === null ? String(FEE_MIN) : String(r.minFee);
  const maxRaw = r.maxFee === undefined || r.maxFee === null ? String(FEE_MAX) : String(r.maxFee);
  const min = Number(minRaw), max = Number(maxRaw);
  const feeMin = minRaw !== "" && Number.isFinite(min) ? min : FEE_MIN;
  const feeMax = maxRaw !== "" && Number.isFinite(max) ? max : FEE_MAX;
  return {
    residenceName: r.residenceName || undefined,
    destination: set(r.destination),
    location: set(r.location),
    studentState: r.studentState || "",
    universities: set(r.universities),
    courseQuery: typeof r.courseQuery === "string" ? r.courseQuery : "",
    duration: set(r.duration),
    level: set(r.level),
    year: r.year || "",
    disciplineSubjects: Array.isArray(r.disciplineSubjects) ? new Set(r.disciplineSubjects) : null,
    intakes: set(r.intakes),
    standardizedTests: set(r.standardizedTests),
    acceptedEnglishTests: set(r.acceptedEnglishTests),
    feeMin, feeMax,
    feeActive: feeMin > FEE_MIN || feeMax < FEE_MAX,
    feeCurrency: r.feeCurrency || "",
    includeUnknownFee: !!r.includeUnknownFee,
    ieltsEquivalent: typeof r.ieltsEquivalent === "number" ? r.ieltsEquivalent : null,
    gpa: typeof r.gpa === "number" ? r.gpa : null,
    accreditedOnly: !!r.accreditedOnly,
    scholarshipOnly: !!r.scholarshipOnly,
    withoutEnglishProficiency: !!r.withoutEnglishProficiency,
    moiQuery: normalizeText(String(r.moiUniversity || "").trim()),
    withoutGRE: !!r.withoutGRE,
    withoutGMAT: !!r.withoutGMAT,
    withoutMaths: !!r.withoutMaths,
    stemOnly: !!r.stemOnly,
    accepts15YearsOnly: !!r.accepts15YearsOnly,
    feeWaiverOnly: !!r.feeWaiverOnly,
    eslElpOnly: !!r.eslElpOnly,
    openProgramsOnly: !!r.openProgramsOnly,
  };
}

function universityGate(f, u) {
  if (f.residenceName && fullCountryName(u.country) === f.residenceName) return false;
  if (f.destination.size > 0 && !f.destination.has(u.country)) return false;
  if (f.studentState && (u.restrictedRegions ?? []).some((r) => r.toLowerCase() === f.studentState.toLowerCase())) return false;
  if (f.universities.size > 0 && !f.universities.has(u.name)) return false;
  if (f.year && !universityYears(u).has(f.year)) return false;
  if (f.acceptedEnglishTests.size > 0) {
    const accepted = universityAcceptedEnglishTests(u);
    if (![...f.acceptedEnglishTests].some((t) => accepted.has(t))) return false;
  }
  if (f.ieltsEquivalent !== null && u.minIELTS > f.ieltsEquivalent) return false;
  if (f.accreditedOnly && u.accreditations.length === 0) return false;
  if (f.scholarshipOnly && !u.scholarshipsAvailable) return false;
  if (f.gpa !== null && u.minGPA > f.gpa) return false;
  if (f.withoutEnglishProficiency && !u.moiAccepted) return false;
  if (f.moiQuery && !(u.moiAccepted && (u.moiAcceptedUniversities ?? []).some((n) => normalizeText(n).includes(f.moiQuery)))) return false;
  if (f.feeWaiverOnly && !u.applicationFeeWaiverAvailable) return false;
  if (f.eslElpOnly && !u.eslElpAvailable) return false;
  return true;
}

const wantsLocation = (f, place) => {
  const key = normalizeText(place.trim());
  return [...f.location].some((w) => normalizeText(w.trim()) === key);
};

function courseConditionsActive(f) {
  return (
    !!f.courseQuery.trim() || (f.disciplineSubjects !== null && f.disciplineSubjects.size > 0) || f.duration.size > 0 || f.level.size > 0 ||
    f.standardizedTests.size > 0 || f.withoutGRE || f.withoutGMAT || f.withoutMaths || f.stemOnly ||
    f.accepts15YearsOnly || f.openProgramsOnly || f.intakes.size > 0 || f.feeActive
  );
}

function courselessUniversityPasses(f, u, tokens) {
  if (f.location.size > 0 && !universityLocations(u).some((l) => wantsLocation(f, l))) return false;
  if (courseConditionsActive(f)) return false;
  return tokens.length === 0 || tokensMatch(`${universitySearchText(u)} | ${normalizeText((u.subjects ?? []).join(" | "))}`, tokens);
}

function courseHasOpenIntake(u, c) {
  const months = c.intakes && c.intakes.length > 0 ? c.intakes : u.intakes;
  return months.some((m) => !!u.intakeStatus?.[m]);
}

function courseMatchesFilters(f, u, c, tokens) {
  if (tokens.length > 0 && !tokensMatch(`${universitySearchText(u)} | ${courseSearchText(u, c)}`, tokens)) return false;
  const courseQuery = normalizeText(f.courseQuery.trim());
  if (courseQuery && !normalizeText(c.name).includes(courseQuery)) return false;
  if (f.feeActive) {
    const fee = courseFeeIn(u, c, f.feeCurrency);
    if (fee === null) {
      if (!(f.includeUnknownFee && courseFeeKind(c) === "unknown")) return false;
    } else if (fee < f.feeMin || fee > f.feeMax) return false;
  }
  if (f.location.size > 0 && !courseLocations(u, c).some((l) => wantsLocation(f, l))) return false;
  // The client resolves "discipline area" to the subjects in those areas (a course whose subject has no area never matches).
  if (f.disciplineSubjects !== null && f.disciplineSubjects.size > 0 && !f.disciplineSubjects.has(c.subject)) return false;
  if (f.duration.size > 0 && !f.duration.has(c.duration)) return false;
  if (f.level.size > 0 && !f.level.has(c.level) && !(c.programLevel ?? []).some((l) => f.level.has(l))) return false;
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

/** Universities that pass (port of applyFilters), in catalog order. */
function filterUniversities(universities, f, query) {
  const tokens = searchTokens(query || "");
  return universities.filter((u) => {
    if (!universityGate(f, u)) return false;
    if (u.courses.length > 0) return u.courses.some((c) => courseMatchesFilters(f, u, c, tokens));
    return courselessUniversityPasses(f, u, tokens);
  });
}

// ---------------------------------------------------------------------------------------------------------------------
// Sorting (port of the sort blocks in src/features/student/UniversitySearch.tsx)
// ---------------------------------------------------------------------------------------------------------------------
const rankNumber = (rank) => parseInt(rank.replace(/\D/g, ""), 10) || Infinity;
const employabilityNumber = (emp) => parseInt(emp.replace(/\D/g, ""), 10) || 0;

function sortUniversities(list, sortBy, sortCurrency, f) {
  const sorted = [...list];
  if (sortBy === "rank") sorted.sort((a, b) => rankNumber(a.worldRank) - rankNumber(b.worldRank));
  else if (sortBy === "employability") sorted.sort((a, b) => employabilityNumber(b.employability) - employabilityNumber(a.employability));
  else if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
  else if (sortBy === "feeLow" || sortBy === "feeHigh") {
    const cur = sortCurrency || f.feeCurrency || currenciesOf(sorted.flatMap((u) => u.courses.map((c) => ({ u, c }))))[0] || "";
    const cheapest = (u) => {
      const fees = u.courses.map((c) => courseFeeIn(u, c, cur)).filter((x) => x !== null && x > 0);
      return fees.length ? Math.min(...fees) : null;
    };
    const keyed = new Map(sorted.map((u) => [u.id, cheapest(u)]));
    sorted.sort((a, b) => {
      const fa = keyed.get(a.id), fb = keyed.get(b.id);
      if (fa === null && fb === null) return 0;
      if (fa === null) return 1;
      if (fb === null) return -1;
      return sortBy === "feeLow" ? (fa ?? 0) - (fb ?? 0) : (fb ?? 0) - (fa ?? 0);
    });
  }
  return sorted;
}

function sortPrograms(list, sortBy, sortCurrency, f, currencies) {
  if (sortBy === "best") return list;
  const out = [...list];
  if (sortBy === "rank") out.sort((a, b) => rankNumber(a.u.worldRank) - rankNumber(b.u.worldRank));
  else if (sortBy === "employability") out.sort((a, b) => employabilityNumber(b.u.employability) - employabilityNumber(a.u.employability));
  else if (sortBy === "name") out.sort((a, b) => a.c.name.localeCompare(b.c.name));
  else {
    const cur = sortCurrency || f.feeCurrency || (currencies[0] ?? "");
    const fee = (p) => {
      const v = courseFeeIn(p.u, p.c, cur);
      return v !== null && v > 0 ? v : null;
    };
    out.sort((a, b) => {
      const fa = fee(a), fb = fee(b);
      if (fa === null && fb === null) return 0;
      if (fa === null) return 1;
      if (fb === null) return -1;
      return sortBy === "feeLow" ? fa - fb : fb - fa;
    });
  }
  return out;
}

// ---------------------------------------------------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------------------------------------------------
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 100;
const SORTS = new Set(["best", "rank", "feeLow", "feeHigh", "employability", "name"]);

/** The fields a university card needs — not its courses. */
function universityCard(u) {
  return {
    id: u.id, name: u.name, city: u.city, country: u.country, tags: u.tags, openIntake: u.openIntake, logoUrl: u.logoUrl,
    scholarshipsAvailable: u.scholarshipsAvailable, scholarships: u.scholarships, currencySymbol: u.currencySymbol,
    depositMode: u.depositMode, minimumDepositAmount: u.minimumDepositAmount, worldRank: u.worldRank, employability: u.employability,
    intakes: u.intakes, intakeStatus: u.intakeStatus,
  };
}
function courseCard(c) {
  return {
    id: c.id, name: c.name, level: c.level, duration: c.duration, subject: c.subject, feeUSD: c.feeUSD, feeStatus: c.feeStatus,
    currencySymbol: c.currencySymbol, intakes: c.intakes, studyMode: c.studyMode,
  };
}

function clampInt(value, fallback, min, max) {
  const n = Math.floor(Number(value));
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

/** params: { view: "courses" | "universities", q, filters, sort, sortCurrency, page, limit, shortlistKeys }.
 * `shortlistKeys` (courses view only) restricts to `${universityId}::${courseName}` keys — the browser-held shortlist. */
function runSearch(index, params) {
  const p = params || {};
  const view = p.view === "universities" ? "universities" : "courses";
  const sortBy = SORTS.has(p.sort) ? p.sort : "best";
  const limit = clampInt(p.limit, DEFAULT_LIMIT, 1, MAX_LIMIT);
  const f = prepareFilters(p.filters);
  const q = typeof p.q === "string" ? p.q : "";
  const sortCurrency = typeof p.sortCurrency === "string" ? p.sortCurrency : "";

  const matched = filterUniversities(index.universities, f, q);
  let items, total, currencies;
  if (view === "universities") {
    const sorted = sortUniversities(matched, sortBy, sortCurrency, f);
    total = sorted.length;
    const page = clampInt(p.page, 1, 1, Math.max(1, Math.ceil(total / limit)));
    items = sorted.slice((page - 1) * limit, page * limit).map(universityCard);
    return { items, total, page, limit };
  }

  const tokens = searchTokens(q);
  const keys = Array.isArray(p.shortlistKeys) ? new Set(p.shortlistKeys) : null;
  let programs = [];
  for (const u of matched) {
    for (const c of u.courses) {
      if (!courseMatchesFilters(f, u, c, tokens)) continue;
      if (keys && !keys.has(`${u.id}::${c.name}`)) continue;
      programs.push({ u, c });
    }
  }
  currencies = currenciesOf(programs).map((s) => s.trim());
  programs = sortPrograms(programs, sortBy, sortCurrency, f, currencies);
  total = programs.length;
  const page = clampInt(p.page, 1, 1, Math.max(1, Math.ceil(total / limit)));
  items = programs.slice((page - 1) * limit, page * limit).map(({ u, c }) => ({ university: universityCard(u), course: courseCard(c) }));
  return { items, total, page, limit, currencies };
}

async function search(params) {
  return runSearch(await getIndex(), params);
}

/** Warm the index ahead of the first request. */
function warmIndex() {
  startBuild().catch((err) => console.warn("Search index warm-up failed:", err));
}

module.exports = { search, runSearch, getIndex, warmIndex, prepareFilters, filterUniversities, courseMatchesFilters, searchTokens, slimUniversity, slimCourse, MAX_LIMIT, DEFAULT_LIMIT };
