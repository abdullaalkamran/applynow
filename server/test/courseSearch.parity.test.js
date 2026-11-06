// The server search must answer exactly what the browser's own filter answers today. Both run on the same generated
// catalog across many filter combinations; any difference in which universities / courses pass fails the test.
import { describe, it, expect, vi, beforeAll } from "vitest";
import { createRequire } from "node:module";

process.env.DATABASE_URL ||= "mysql://test:test@localhost:3306/test";

// The client's discipline-area lookup reads a browser store; stub it with a fixed subject → area table.
const AREAS = { "Computer Science": "STEM", "Data Science": "STEM", Engineering: "STEM", Business: "Business", Law: "Humanities", Medicine: "Health", Design: "Arts" };
vi.mock("../../src/data/subjectCatalogStore", () => ({
  getSubjectCatalog: () => Object.entries(AREAS).map(([name, disciplineArea]) => ({ name, disciplineArea })),
  getSubjectRecord: (name) => (AREAS[name] ? { name, disciplineArea: AREAS[name] } : undefined),
}));

const require = createRequire(import.meta.url);
const { makeCatalog, rng } = require("./fixtures.js");
const server = require("../src/courseSearch.js");

let client, countries;
beforeAll(async () => {
  client = await import("../../src/utils/universityFilter");
  countries = await import("../../src/data/countries");
});

const CASES = [
  {},
  { q: "leeds" },
  { q: "msc data" },
  { q: "eXeter business" },
  { f: { destination: ["United Kingdom"] } },
  { f: { destination: ["UK", "Canada"] } },
  { f: { level: ["Postgraduate"] } },
  { f: { level: ["PhD", "UG"] } },
  { f: { intakes: ["September"] } },
  { f: { intakes: ["January", "May"] }, q: "science" },
  { f: { year: "2027" } },
  { f: { courseQuery: "data" } },
  { f: { duration: ["1 year", "2 years"] } },
  { f: { location: ["Leeds"] } },
  { f: { location: ["Ontario", "London"] } },
  { f: { studentState: "Punjab" } },
  { f: { residenceCountry: "GB" } },
  { f: { residenceCountry: "CA", destination: ["Canada", "Germany"] } },
  { f: { universities: [] } },
  { f: { minFee: "10000", maxFee: "30000", feeCurrency: "£" } },
  { f: { minFee: "0", maxFee: "20000", feeCurrency: "$", includeUnknownFee: true } },
  { f: { minFee: "0", maxFee: "0", feeCurrency: "£" } },
  { f: { accreditedOnly: true } },
  { f: { scholarshipOnly: true } },
  { f: { minGPA: "3.1" } },
  { f: { englishScore: "6.5", englishTestName: "IELTS" } },
  { f: { englishScore: "70", englishTestName: "PTE Academic" } },
  { f: { withoutEnglishProficiency: true } },
  { f: { moiUniversity: "dhaka" } },
  { f: { moiUniversity: "BUET", withoutEnglishProficiency: true } },
  { f: { withoutGRE: true, withoutGMAT: true } },
  { f: { standardizedTests: ["GRE"] } },
  { f: { withoutMaths: true } },
  { f: { stemOnly: true, accepts15YearsOnly: true } },
  { f: { feeWaiverOnly: true } },
  { f: { eslElpOnly: true } },
  { f: { openProgramsOnly: true } },
  { f: { acceptedEnglishTests: ["IELTS", "PTE Academic"] } },
  { f: { disciplineArea: ["STEM"] } },
  { f: { disciplineArea: ["Arts", "Health"], level: ["Postgraduate"] }, q: "advanced" },
  { f: { destination: ["United Kingdom"], intakes: ["September"], level: ["Undergraduate"], minFee: "5000", maxFee: "40000", feeCurrency: "£", openProgramsOnly: true, scholarshipOnly: true }, q: "university" },
];

/** What the client sends the server for a UI filter state: its own resolutions of the browser-only lookups. */
function toRequest(c) {
  const f = { ...client.emptyFilters(c.f?.residenceCountry ?? ""), ...(c.f || {}) };
  for (const k of ["destination", "location", "universities", "duration", "level", "disciplineArea", "intakes", "standardizedTests", "acceptedEnglishTests"]) f[k] = new Set(c.f?.[k] ?? []);
  const score = f.englishScore ? Number(f.englishScore) : null;
  return {
    state: f,
    request: {
      residenceName: f.residenceCountry ? countries.countryByIso2(f.residenceCountry)?.name : undefined,
      destination: [...f.destination], location: [...f.location], studentState: f.studentState, universities: [...f.universities],
      courseQuery: f.courseQuery, duration: [...f.duration], level: [...f.level], year: f.year,
      disciplineSubjects: f.disciplineArea.size ? Object.keys(AREAS).filter((s) => f.disciplineArea.has(AREAS[s])) : null,
      intakes: [...f.intakes], standardizedTests: [...f.standardizedTests], acceptedEnglishTests: [...f.acceptedEnglishTests],
      minFee: f.minFee, maxFee: f.maxFee, feeCurrency: f.feeCurrency, includeUnknownFee: f.includeUnknownFee,
      ieltsEquivalent: score !== null ? client.toIELTSEquivalent(f.englishTestName, score) : null,
      gpa: f.minGPA ? Number(f.minGPA) : null,
      accreditedOnly: f.accreditedOnly, scholarshipOnly: f.scholarshipOnly, withoutEnglishProficiency: f.withoutEnglishProficiency,
      moiUniversity: f.moiUniversity, withoutGRE: f.withoutGRE, withoutGMAT: f.withoutGMAT, withoutMaths: f.withoutMaths,
      stemOnly: f.stemOnly, accepts15YearsOnly: f.accepts15YearsOnly, feeWaiverOnly: f.feeWaiverOnly, eslElpOnly: f.eslElpOnly,
      openProgramsOnly: f.openProgramsOnly,
    },
  };
}

function serverIndex(universities) {
  return universities.map((u) => ({ ...server.slimUniversity(u), courses: u.courses.map((c) => server.slimCourse(c)) }));
}

describe("server search matches the browser filter", () => {
  for (const seed of [1, 7, 42]) {
    const catalog = makeCatalog(seed, 30);
    CASES.forEach((c, i) => {
      it(`seed ${seed}, case ${i} ${JSON.stringify(c)}`, () => {
        const { state, request } = toRequest(c);
        const q = c.q ?? "";
        const slim = serverIndex(catalog);

        const clientUnis = client.applyFilters(catalog, state, q);
        const serverUnis = server.filterUniversities(slim, server.prepareFilters(request), q);
        expect(serverUnis.map((u) => u.id)).toEqual(clientUnis.map((u) => u.id));

        // The flat course list: every course of a surviving university that matches the same filters.
        const clientCourses = clientUnis.flatMap((u) => u.courses.filter((x) => client.courseMatchesFilters(u, x, state, q)).map((x) => x.id));
        const tokens = server.searchTokens(q);
        const prepared = server.prepareFilters(request);
        const serverCourses = serverUnis.flatMap((u) => u.courses.filter((x) => server.courseMatchesFilters(prepared, u, x, tokens)).map((x) => x.id));
        expect(serverCourses).toEqual(clientCourses);
      });
    });
  }

  it("actually exercises the filters (the generated catalog is not trivially empty or full)", () => {
    const catalog = makeCatalog(7, 30);
    const total = catalog.flatMap((u) => u.courses).length;
    const some = server.filterUniversities(serverIndex(catalog), server.prepareFilters({ destination: ["UK"], level: ["Postgraduate"] }), "").length;
    expect(total).toBeGreaterThan(50);
    expect(some).toBeGreaterThan(0);
    expect(some).toBeLessThan(catalog.length);
    expect(rng(1)()).toBeLessThan(1);
  });
});
