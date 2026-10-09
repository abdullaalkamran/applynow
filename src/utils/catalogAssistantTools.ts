// The partner-network catalog (universities, courses, subjects, country guides) as assistant tools, shared by
// every role's assistant. Students get it behind a "profile complete" gate (their own flow requires it — see
// studentAssistantTools.ts); staff roles (agent, counsellor, admin, admission, compliance, data, finance) get
// it ungated, since they need to answer questions about what's in the network without a student profile.
import { getAllUniversities, getUniversityById } from "../data/universityCatalogStore";
import { getCountryByName } from "../data/countryRegistry";
import { SUBJECT_CURRICULUM } from "../data/subjectCurriculum";
import type { ToolDefinition } from "./assistantEngine";

// Our catalog stores abbreviated/short country names ("UK", "United States") but a person speaking naturally
// (and the model relaying it) says the full name — a plain one-directional substring check meant "united
// kingdom" could never match stored "UK", making a real partner university look nonexistent. Checking both
// directions, plus a couple of common aliases our short forms don't cover on their own, fixes that without
// needing a full country database.
const COUNTRY_ALIASES: Record<string, string[]> = {
  uk: ["united kingdom", "britain", "great britain", "england"],
  usa: ["united states", "america", "us"],
  uae: ["united arab emirates"],
};

export function countryMatches(storedCountry: string, query: string): boolean {
  const stored = storedCountry.toLowerCase();
  const q = query.toLowerCase();
  if (stored.includes(q) || q.includes(stored)) return true;
  return (COUNTRY_ALIASES[stored] ?? []).some((alias) => alias.includes(q) || q.includes(alias));
}

/** Shown to every role's model so it uses the tools instead of claiming it has no access to the catalog. */
export const CATALOG_GUIDANCE =
  `**You DO have access to the platform's real university and course catalog** — through search_universities, ` +
  `search_courses, get_university_detail, list_subjects, get_subject_detail and get_country_detail. Never say you ` +
  `lack access to universities, courses, fees or requirements: call the tool. When someone names a specific ` +
  `university, call search_universities with that exact name in the \`name\` field before ruling anything out; for ` +
  `courses (by name, level, subject, country, fee, or university) use search_courses; for the full picture of one ` +
  `university (every course, fee, requirement) use get_university_detail with the id from a search. Only say ` +
  `something isn't in the network after a search by name actually came back empty. Report only what tools ` +
  `returned — never invent a university, course, fee or deadline. If totalMatches exceeds what's listed, say so ` +
  `and offer to narrow it down.`;

type Gate = () => unknown | null;

/**
 * @param gate  Optional pre-check run before every catalog tool. Return a non-null object to refuse the call
 *              (it's handed back to the model as the tool result); return null to allow it.
 */
export function catalogTools(gate?: Gate): ToolDefinition[] {
  const blocked = () => gate?.() ?? null;

  return [
    {
      spec: {
        name: "get_country_detail",
        description: "Get the real Country Guide for a destination country — why study there, the visa cost/proof-of-funds breakdown, required documents, application and visa procedure, and key facts (popular intakes, cost of living, post-study work visa, part-time work rules, processing time). Use this whenever a country is asked about generally, before or alongside naming a specific university there.",
        parameters: { type: "object", properties: { country: { type: "string" } }, required: ["country"] },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;
        const record = getCountryByName(String(args.country));
        if (!record) return { error: `"${args.country}" doesn't match a country we have a guide for yet — call search_universities with a country filter to see what's actually in the network.` };
        return record;
      },
    },
    {
      spec: {
        name: "search_universities",
        description: "Search the university catalog by name and/or destination country, subject, study level, maximum budget in USD, or scholarship availability. Always pass `name` (a partial match is fine) whenever a specific university is named directly — never conclude a university isn't in the network from a country/subject-only search that just didn't happen to include it. Returns up to 15 matches with a few matching courses each, plus totalMatches so you know if more exist than are shown.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" },
            country: { type: "string" },
            subject: { type: "string" },
            studyLevel: { type: "string" },
            maxBudget: { type: "number" },
            scholarshipOnly: { type: "boolean" },
          },
        },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;

        const name = args.name as string | undefined;
        const country = args.country as string | undefined;
        const subject = args.subject as string | undefined;
        const studyLevel = args.studyLevel as string | undefined;
        const maxBudget = args.maxBudget as number | undefined;
        const scholarshipOnly = args.scholarshipOnly as boolean | undefined;

        const results = getAllUniversities()
          .filter((u) => {
            if (name && !u.name.toLowerCase().includes(name.toLowerCase())) return false;
            if (country && !countryMatches(u.country, country)) return false;
            if (scholarshipOnly && !u.scholarshipsAvailable) return false;
            if (subject && !u.subjects.some((s) => s.toLowerCase().includes(subject.toLowerCase()))) return false;
            return true;
          })
          .map((u) => ({
            u,
            // A single course must satisfy BOTH level and budget together — checking them as two
            // independent `some()` calls let a university pass with an expensive course covering level and
            // an unrelated cheap course covering budget, while no course actually matched both.
            matchingCourses: u.courses
              .filter((c) => !studyLevel || c.level.toLowerCase().includes(studyLevel.toLowerCase()))
              .filter((c) => !maxBudget || c.feeUSD <= maxBudget),
          }))
          // Only require a real matching course when level/budget were actually specified.
          .filter(({ matchingCourses }) => !(studyLevel || maxBudget) || matchingCourses.length > 0);

        return {
          totalMatches: results.length,
          universities: results.slice(0, 15).map(({ u, matchingCourses }) => ({
            id: u.id,
            name: u.name,
            country: u.country,
            worldRank: u.worldRank,
            employability: u.employability,
            scholarshipsAvailable: u.scholarshipsAvailable,
            courseCount: u.courses.length,
            matchingCourses: matchingCourses.slice(0, 3).map((c) => ({ id: c.id, name: c.name, level: c.level, feeUSD: c.feeUSD })),
          })),
        };
      },
    },
    {
      spec: {
        name: "search_courses",
        description: "Search every course across all partner universities. Filter by any of: course name keyword, university name, country, subject, study level (e.g. Bachelor/Master), maximum yearly fee in USD, or intake month. Use this for questions about specific courses ('MSc Data Science in the UK', 'cheapest MBA', 'what does X university offer in engineering') — it returns the course itself with its university, fee, level, duration, intakes and deadline. Returns up to 20 courses plus totalMatches.",
        parameters: {
          type: "object",
          properties: {
            course: { type: "string" },
            university: { type: "string" },
            country: { type: "string" },
            subject: { type: "string" },
            studyLevel: { type: "string" },
            maxFeeUSD: { type: "number" },
            intake: { type: "string" },
          },
        },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;

        const course = (args.course as string | undefined)?.toLowerCase();
        const university = (args.university as string | undefined)?.toLowerCase();
        const country = args.country as string | undefined;
        const subject = (args.subject as string | undefined)?.toLowerCase();
        const studyLevel = (args.studyLevel as string | undefined)?.toLowerCase();
        const maxFeeUSD = args.maxFeeUSD as number | undefined;
        const intake = (args.intake as string | undefined)?.toLowerCase();

        const matches = getAllUniversities()
          .filter((u) => (!university || u.name.toLowerCase().includes(university)) && (!country || countryMatches(u.country, country)))
          .flatMap((u) => u.courses.map((c) => ({ u, c })))
          .filter(({ c }) => {
            if (course && !c.name.toLowerCase().includes(course)) return false;
            if (subject && !c.subject.toLowerCase().includes(subject)) return false;
            if (studyLevel && !c.level.toLowerCase().includes(studyLevel)) return false;
            if (maxFeeUSD && c.feeUSD > maxFeeUSD) return false;
            if (intake && !(c.intakes ?? []).some((i) => i.toLowerCase().includes(intake))) return false;
            return true;
          })
          .sort((a, b) => a.c.feeUSD - b.c.feeUSD);

        return {
          totalMatches: matches.length,
          courses: matches.slice(0, 20).map(({ u, c }) => ({
            courseId: c.id,
            course: c.name,
            level: c.level,
            subject: c.subject,
            duration: c.duration,
            feeUSD: c.feeUSD,
            intakes: c.intakes,
            applicationDeadline: c.applicationDeadline,
            universityId: u.id,
            university: u.name,
            country: u.country,
          })),
        };
      },
    },
    {
      spec: {
        name: "get_university_detail",
        description: "Get full detail for one university by id (requirements, fees, English test requirements, scholarships, and every course).",
        parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;
        const uni = getUniversityById(String(args.id));
        if (!uni) return { error: "No university found with that id." };
        return uni;
      },
    },
    {
      spec: {
        name: "list_subjects",
        description: "List every field of study/subject a partner university actually offers right now — use this when it isn't clear what to search for, before guessing a subject.",
        parameters: { type: "object", properties: {} },
      },
      // Derived from the live catalog (what real courses actually exist), not the full picklist of possible
      // subject names Data Management can choose from — the latter includes subjects with zero courses behind
      // them, which would have the assistant confidently offering a subject nobody can apply to anywhere.
      execute: () => blocked() ?? Array.from(new Set(getAllUniversities().flatMap((u) => u.subjects))).sort(),
    },
    {
      spec: {
        name: "get_subject_detail",
        description: "Get typical modules and career outcomes for a subject, plus how many partner universities currently offer it. Use an exact subject name from list_subjects.",
        parameters: { type: "object", properties: { subject: { type: "string" } }, required: ["subject"] },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;
        const subject = String(args.subject);
        const curriculum = SUBJECT_CURRICULUM[subject];
        const universityCount = getAllUniversities().filter((u) => u.subjects.includes(subject)).length;
        if (!curriculum && universityCount === 0) {
          return { error: `"${subject}" doesn't match a subject in our network. Call list_subjects for the real options.` };
        }
        return { subject, universityCount, modules: curriculum?.modules ?? [], careers: curriculum?.careers ?? [] };
      },
    },
  ];
}
