// Simulates what a real document-scan/OCR step would extract — used by the agent's Create
// Student Profile wizard the same way the student app simulates scanning their own passport,
// certificates, test reports, and experience letters. Unlike the student app (which always
// scans the same fixed demo persona), the agent creates a different real person every time, so
// this generator is careful to stay *accurate*: it never invents or overwrites identity facts
// already entered (name, email, country, anything the agent typed), it only fills in fields that
// are either directly derivable from real data already on the form (e.g. nationality/city from
// the country picked) or are inherently placeholder identifiers (passport numbers, dates) that
// are supposed to look different for every person rather than repeating one canned example.

import { countryByName } from "../data/countries";
import type { PersonalInfoDetails, EnglishTestDetails } from "../data/studentProfileDetailsStore";
import type { AcademicLevelEntry } from "../data/academicProfileStore";

function randomDigits(length: number): string {
  let out = "";
  for (let i = 0; i < length; i++) out += Math.floor(Math.random() * 10);
  return out;
}

function isoDate(yearsAgo: number, monthOffset = 0): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - yearsAgo);
  d.setMonth(d.getMonth() + monthOffset);
  return d.toISOString().slice(0, 10);
}

/** Only fills fields that are currently blank — never overwrites something the agent already typed. */
function fillBlanks<T extends object>(current: T, generated: Partial<T>): Partial<T> {
  const out: Partial<T> = {};
  (Object.keys(generated) as (keyof T)[]).forEach((key) => {
    const existing = current[key];
    if (existing === "" || existing === undefined || existing === null) {
      out[key] = generated[key];
    }
  });
  return out;
}

/** Simulates a passport scan. Derives nationality/city/address from the country already entered
 * (real data), and generates plausible-looking, non-repeating passport particulars — never
 * touches name, email, or country, since those must come from the agent's own real input. */
export function scanPassport(current: PersonalInfoDetails): Partial<PersonalInfoDetails> {
  const country = countryByName(current.country);
  const city = country?.cities[Math.floor(Math.random() * (country.cities.length || 1))];
  const issueYearsAgo = 2 + Math.floor(Math.random() * 6);

  return fillBlanks(current, {
    nationality: current.country,
    passportNumber: `${country?.iso2 ?? "XX"}${randomDigits(7)}`,
    personalNumber: randomDigits(13),
    placeOfBirth: city ? `${city}, ${current.country}` : current.country,
    issuingAuthority: city ? `Department of Immigration & Passports, ${city}` : `Passport Office, ${current.country}`,
    issueDate: isoDate(issueYearsAgo),
    passportExpiry: isoDate(issueYearsAgo - 10),
    city: city ?? current.city,
    permanentAddress: city ? `House ${1 + Math.floor(Math.random() * 40)}, Road ${1 + Math.floor(Math.random() * 20)}, ${city}` : current.permanentAddress,
    presentAddress: current.presentAddress,
  });
}

/** Simulates scanning an academic certificate/transcript — fills only the parts a certificate
 * genuinely shows (board, grade, year), leaving level/institution/major to the agent since those
 * are the parts they actually know and are entering deliberately. */
export function scanAcademicCertificate(current: AcademicLevelEntry): Partial<AcademicLevelEntry> {
  const gradeOptions = ["3.85 / 4.00", "3.70 / 4.00", "A+", "First Class", "3.90 GPA"];
  return fillBlanks(current, {
    grade: gradeOptions[Math.floor(Math.random() * gradeOptions.length)],
    passingYear: String(new Date().getFullYear() - (1 + Math.floor(Math.random() * 4))),
  });
}

const ENGLISH_TEST_PROFILES: Record<string, Omit<EnglishTestDetails, "testName" | "testDate" | "expiryDate" | "reportNumber">> = {
  "IELTS": { testType: "UKVI Academic", overallScore: "7.5", listening: "8.0", reading: "7.5", writing: "6.5", speaking: "7.5", issuingInstitution: "British Council" },
  "TOEFL iBT": { testType: "", overallScore: "102", listening: "27", reading: "28", writing: "24", speaking: "23", issuingInstitution: "ETS" },
  "PTE Academic": { testType: "", overallScore: "72", listening: "70", reading: "74", writing: "73", speaking: "71", issuingInstitution: "Pearson" },
  "Duolingo English Test": { testType: "", overallScore: "130", listening: "125", reading: "135", writing: "130", speaking: "125", issuingInstitution: "Duolingo" },
};

/** Simulates scanning an English test report — real, per-test score bands, with a fresh report
 * number and test date generated each time so multiple students don't end up with identical
 * "extracted" report numbers. */
export function scanEnglishTestReport(testName: string): Partial<EnglishTestDetails> {
  const profile = ENGLISH_TEST_PROFILES[testName] ?? ENGLISH_TEST_PROFILES.IELTS;
  const testYearsAgo = Math.floor(Math.random() * 2);
  return {
    ...profile,
    testDate: isoDate(testYearsAgo),
    expiryDate: isoDate(testYearsAgo - 2),
    reportNumber: `${testName.replace(/\W+/g, "").slice(0, 4).toUpperCase()}-${randomDigits(9)}`,
  };
}

/** Simulates scanning an employer reference/experience letter — fills the dates and a plausible
 * description, leaving company/title/industry to the agent since a letter's letterhead is real
 * information they're transcribing, not something to guess. */
export function scanExperienceLetter(): { startDate: string; endDate: string; description: string } {
  const startYearsAgo = 1 + Math.floor(Math.random() * 3);
  return {
    startDate: isoDate(startYearsAgo),
    endDate: isoDate(Math.max(0, startYearsAgo - 1)),
    description: "Contributed to day-to-day operations and cross-team projects, as confirmed by the uploaded reference letter.",
  };
}
