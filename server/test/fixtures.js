// Deterministic pseudo-random catalog fixtures shared by the search tests: universities with the full client shape, so the
// browser filter can run on them directly, and the same objects pass through the server's slimming for the server filter.
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const COUNTRIES = ["United Kingdom", "UK", "United States", "Canada", "Australia", "Germany", "Ireland"];
const CITIES = ["London", "Manchester", "Leeds", "Toronto", "Sydney", "Berlin", "Dublin", "Boston"];
const STATES = ["Ontario", "Texas", "", "", "Bavaria"];
const SUBJECTS = ["Computer Science", "Data Science", "Business", "Engineering", "Law", "Medicine", "Design"];
const LEVELS = ["Undergraduate", "Postgraduate"];
const PROGRAM_LEVELS = ["UG", "PG", "PhD", "Pathway Programs (UG)", "Hybrid"];
const MONTHS = ["January", "May", "September", "October"];
const SYMBOLS = ["£", "$", "€", "A$", "£ "];
const TESTS = ["IELTS", "PTE Academic", "TOEFL iBT", "Duolingo English Test"];
const DURATIONS = ["1 year", "2 years", "3 years", "4 years"];
const WORDS = ["Advanced", "Applied", "Global", "Digital", "Strategic", "Clinical", "Creative", "Quantitative"];
const pick = (r, list) => list[Math.floor(r() * list.length)];
const some = (r, list, max) => list.filter(() => r() < max);

function makeCatalog(seed = 7, universityCount = 24) {
  const r = rng(seed);
  const universities = [];
  for (let i = 0; i < universityCount; i++) {
    const country = pick(r, COUNTRIES);
    const city = pick(r, CITIES);
    const intakes = some(r, MONTHS, 0.6);
    const hasCourses = r() > 0.12;
    const campuses = r() < 0.4 ? [{ id: `cp${i}a`, name: "Main", city }, { id: `cp${i}b`, name: "North", city: pick(r, CITIES) }] : undefined;
    const u = {
      id: `u${i}`,
      name: `${pick(r, ["University of", "Institute of", "College of"])} ${pick(r, ["Éxeter", "Leeds", "Toronto", "Berlin", "Boston", "Sydney"])} ${i}`,
      city, state: pick(r, STATES) || undefined, country,
      tags: some(r, ["Research", "Public", "Russell Group", "Modern"], 0.5),
      subjects: some(r, SUBJECTS, 0.5),
      intakes,
      worldRank: r() < 0.2 ? "" : `#${Math.floor(r() * 900) + 1}`,
      employability: r() < 0.2 ? "" : `${Math.floor(r() * 40) + 60}%`,
      openIntake: pick(r, ["September 2027", "January", "May 2026", ""]) ,
      intakeStatus: r() < 0.7 ? Object.fromEntries(intakes.map((m) => [m, r() < 0.6])) : undefined,
      intakeDates: r() < 0.4 ? { September: { enrollmentDate: `${2026 + Math.floor(r() * 3)}-09-01` } } : undefined,
      restrictedRegions: r() < 0.25 ? some(r, ["Punjab", "Sindh", "Kerala"], 0.7) : undefined,
      englishRequirements: r() < 0.5 ? { undergraduate: some(r, TESTS, 0.5).map((testName) => ({ testName })), postgraduate: some(r, TESTS, 0.5).map((testName) => ({ testName })) } : undefined,
      campuses,
      currencySymbol: pick(r, SYMBOLS),
      minIELTS: Math.round((5 + r() * 2.5) * 2) / 2,
      minGPA: Math.round(r() * 30) / 10,
      accreditations: r() < 0.4 ? ["AACSB"] : [],
      scholarshipsAvailable: r() < 0.5,
      scholarships: r() < 0.4 ? [{ amount: "Up to £5,000", name: "x" }] : undefined,
      moiAccepted: r() < 0.5 ? true : r() < 0.5 ? false : undefined,
      moiAcceptedUniversities: r() < 0.4 ? some(r, ["University of Dhaka", "BUET", "North South University", "Dhaka City College"], 0.5) : undefined,
      applicationFeeWaiverAvailable: r() < 0.3 ? true : undefined,
      eslElpAvailable: r() < 0.3 ? true : undefined,
      minimumDepositAmount: r() < 0.4 ? 1000 * Math.ceil(r() * 5) : undefined,
      depositMode: r() < 0.3 ? pick(r, ["half", "full"]) : undefined,
      logoUrl: r() < 0.5 ? `/uploads/l${i}.png` : undefined,
      courses: [],
    };
    if (hasCourses) {
      const n = 1 + Math.floor(r() * 9);
      for (let j = 0; j < n; j++) {
        const status = pick(r, ["amount", "amount", "amount", "free", "unknown"]);
        u.courses.push({
          id: `u${i}c${j}`,
          name: `${pick(r, WORDS)} ${pick(r, SUBJECTS)} ${pick(r, ["MSc", "BSc", "MBA", "LLM"])} ${j}`,
          level: pick(r, LEVELS),
          duration: pick(r, DURATIONS),
          subject: pick(r, SUBJECTS),
          feeUSD: status === "amount" ? Math.round(5000 + r() * 40000) : 0,
          feeStatus: status,
          intakes: r() < 0.5 ? some(r, MONTHS, 0.5) : undefined,
          englishRequirements: r() < 0.4 ? some(r, TESTS, 0.5).map((testName) => ({ testName })) : undefined,
          currencySymbol: r() < 0.3 ? pick(r, SYMBOLS) : undefined,
          campusIds: campuses && r() < 0.5 ? [campuses[0].id] : undefined,
          studyMode: r() < 0.5 ? pick(r, ["Full-time", "Part-time"]) : undefined,
          standardizedTests: r() < 0.3 ? some(r, ["SAT", "ACT", "GRE", "GMAT"], 0.5) : undefined,
          programLevel: r() < 0.5 ? some(r, PROGRAM_LEVELS, 0.4) : undefined,
          mathsRequired: r() < 0.3 ? false : true,
          isStemProgram: r() < 0.4,
          accepts15YearsEducation: r() < 0.3,
        });
      }
    }
    universities.push(u);
  }
  return universities;
}

module.exports = { makeCatalog, rng };
