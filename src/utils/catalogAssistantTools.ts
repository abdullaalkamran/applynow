// The partner-network catalog (universities, courses, subjects, country guides) as assistant tools, shared by
// every role's assistant. Students get it behind a "profile complete" gate (their own flow requires it — see
// studentAssistantTools.ts); staff roles (agent, counsellor, admin, admission, compliance, data, finance) get
// it ungated, since they need to answer questions about what's in the network without a student profile.
//
// The matching, eligibility checks (GPA / English score / budget) and detail assembly live in catalogSearch.ts; this file only
// describes the tools to the model and hands the live catalog to those functions.
import { getAllUniversities, getUniversityById } from "../data/universityCatalogStore";
import { getCountryByName } from "../data/countryRegistry";
import { SUBJECT_CURRICULUM } from "../data/subjectCurriculum";
import { findPrograms, courseDetail, universitySummary, countryMatches, normalizeText, searchTokens, type ProgramQuery, type ProgramRow } from "./catalogSearch";
import type { ToolDefinition } from "./assistantEngine";

export { countryMatches };

// Currency symbols the model may name for a budget (codes people actually say).
const CURRENCY_CODES: Record<string, string> = { USD: "$", GBP: "£", EUR: "€", CAD: "C$", AUD: "A$", AED: "AED", NZD: "NZ$", SGD: "S$", MYR: "RM" };
const currencyOf = (v: unknown): string | undefined => {
  const asked = typeof v === "string" ? v.trim() : "";
  return asked ? (CURRENCY_CODES[asked.toUpperCase()] ?? asked) : undefined;
};
const str = (v: unknown): string | undefined => (typeof v === "string" && v.trim() ? v.trim() : undefined);
const num = (v: unknown): number | undefined => {
  const n = typeof v === "number" ? v : typeof v === "string" ? Number(v.replace(/[^0-9.]/g, "")) : NaN;
  return Number.isFinite(n) && n > 0 ? n : undefined;
};

/** Shown to every role's model so it uses the tools instead of claiming it has no access to the catalog. */
export const CATALOG_GUIDANCE =
  `**You DO have access to the platform's real catalog of thousands of courses and all their details** — through find_programs, ` +
  `search_courses, search_universities, get_course_detail, get_university_detail, search_scholarships, list_subjects, ` +
  `get_subject_detail and get_country_detail. Never say you lack access to universities, courses, fees, intakes, requirements, ` +
  `admission steps or deposits: call a tool. Report only what tools returned — never invent a university, course, fee, deadline or rule.\n\n` +
  `**When a student asks where they can study / which universities or courses they can apply to** (any wording: "I want to study ` +
  `X in Y, my CGPA is …, IELTS …"): call find_programs ONCE with everything they said — country, subject or course words, ` +
  `level (master's / bachelor's / PhD), CGPA and its scale (4, 5, 10 or 100), English test and score, yearly budget and its ` +
  `currency, intake — as separate arguments. Do not ask for details before searching; search with what you have, then ask only ` +
  `for what would sharpen the result. Pass the student's own words (e.g. "business management", "master") — the tool understands ` +
  `synonyms, "&" vs "and", and level wording.\n\n` +
  `**Reading the result.** \`programs\` are courses the student can apply to (they meet the stated minimums, or the data doesn't state one — ` +
  `say which). \`nearMisses\` are slightly below a minimum: present them as "possible if you retake/improve …" with the exact gap. ` +
  `\`alsoConsider\` are extra options that needed one filter loosened (each names it, e.g. "study level", "budget", "intake month") — ` +
  `present them honestly as "also worth considering, but note …". **Always give the student at least FIVE options** by combining ` +
  `programs, then nearMisses, then alsoConsider (up to about eight); only give fewer when the tool's notes say fewer exist, and then ` +
  `say how many there are. ` +
  `If \`relaxed\` is not empty the search was loosened (e.g. intake, budget, level) — tell the student exactly what you loosened. ` +
  `Never say "nothing found in the database" unless find_programs returned no programs AND you tell them which filters you tried ` +
  `(and, if it helps, ask whether they'd accept another country or level). A course whose fee shows "Fee not provided" has no ` +
  `fee entered yet — say so; do not guess a price.\n\n` +
  `**Present at least 5 options**, each with: university, course, city/country, level, yearly fee, duration, intakes (and whether open) ` +
  `with the nearest application deadline, scholarship if any, why it fits, and any gap. Then offer to go deeper on any of them.\n\n` +
  `**Detail questions** (intakes, entry requirements, English requirements, admission procedure, deposit/payment, scholarships, ` +
  `campuses, modules, careers): call get_course_detail with the courseId from the results (or get_university_detail with the ` +
  `university id for the university as a whole). Answer from those fields exactly; if a field is empty, say the data team hasn't ` +
  `entered it yet. Visa, proof-of-funds and immigration process questions: get_country_detail. Scholarships: search_scholarships.`;

type Gate = () => unknown | null;

/** Rows kept short for the model: everything it needs to talk about a programme, nothing it would have to wade through. */
const slim = (r: ProgramRow) => ({
  courseId: r.courseId, course: r.course, level: r.level, subject: r.subject, duration: r.duration,
  universityId: r.universityId, university: r.university, city: r.city, country: r.country, worldRank: r.worldRank,
  fee: r.fee, budget: r.budget, intakes: r.intakes, intakeOpen: r.intakeOpen, nearestDeadline: r.nearestDeadline,
  scholarship: r.scholarship, gpaCheck: `${r.gpa.status} (needs ${r.gpa.required})`, englishCheck: `${r.english.status} (needs ${r.english.required})`, fit: r.fit,
});

function queryFromArgs(args: Record<string, unknown>): ProgramQuery {
  return {
    country: str(args.country),
    university: str(args.university),
    subject: [str(args.subject), str(args.course)].filter(Boolean).join(" ") || undefined,
    level: str(args.level) ?? str(args.studyLevel),
    intake: str(args.intake),
    cgpa: num(args.cgpa),
    gpaScale: num(args.gpaScale),
    englishTest: str(args.englishTest),
    englishScore: num(args.englishScore),
    budget: num(args.budget) ?? num(args.maxBudget) ?? num(args.maxFee),
    currency: currencyOf(args.currency) ?? currencyOf(args.budgetCurrency) ?? currencyOf(args.feeCurrency),
    scholarshipOnly: args.scholarshipOnly === true,
    limit: num(args.limit),
  };
}

/**
 * @param gate  Optional pre-check run before every catalog tool. Return a non-null object to refuse the call
 *              (it's handed back to the model as the tool result); return null to allow it.
 */
export function catalogTools(gate?: Gate): ToolDefinition[] {
  const blocked = () => gate?.() ?? null;

  return [
    {
      spec: {
        name: "find_programs",
        description: "THE main tool for 'where can I study / which universities and courses can I apply to'. Searches the whole catalog and checks each course against the student's own scores. Pass everything the student said: country, subject (their words, e.g. 'business management'), level ('master', 'bachelor', 'phd'), cgpa + gpaScale (4, 5, 10 or 100), englishTest ('IELTS', 'TOEFL iBT', 'PTE Academic', 'Duolingo English Test') + englishScore, budget (yearly) + currency, intake month, scholarshipOnly. Returns `programs` (can apply), `nearMisses` (just below a minimum, with the gap), `alsoConsider` (extra programmes that needed one filter loosened, each saying which — they bring the total to at least five), `relaxed` (filters that were loosened because nothing matched exactly — tell the student), and the filters applied. Every row has courseId and universityId for follow-up detail calls.",
        parameters: {
          type: "object",
          properties: {
            country: { type: "string", description: "Destination country, any common name (UK, United Kingdom, USA, Canada…)." },
            subject: { type: "string", description: "Field of study or course words, in the student's own words." },
            level: { type: "string", description: "master / bachelor / postgraduate / undergraduate / phd / diploma." },
            university: { type: "string", description: "Only if a specific university was named." },
            cgpa: { type: "number", description: "The student's CGPA/GPA number." },
            gpaScale: { type: "number", description: "What the CGPA is out of: 4, 5, 10 or 100. Default 4." },
            englishTest: { type: "string", description: "IELTS, TOEFL iBT, PTE Academic, Duolingo English Test…" },
            englishScore: { type: "number" },
            budget: { type: "number", description: "Maximum yearly tuition the student can pay." },
            currency: { type: "string", description: "Currency of the budget, symbol or code (£, GBP, $, C$ …). Defaults to the destination's own currency." },
            intake: { type: "string", description: "Month, e.g. September." },
            scholarshipOnly: { type: "boolean" },
            limit: { type: "number", description: "How many to return (default 10, max 25)." },
          },
        },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;
        const r = findPrograms(getAllUniversities(), queryFromArgs(args));
        return {
          totalMatches: r.totalMatches,
          programs: r.programs.map(slim),
          nearMisses: r.nearMisses.map(slim),
          alsoConsider: r.alsoConsider.map((x) => ({ ...slim(x), loosened: x.loosened })),
          relaxed: r.relaxed,
          filtersApplied: r.filtersApplied,
          ...(r.currencyForBudget ? { budgetCurrency: r.currencyForBudget } : {}),
          notes: r.notes,
          ...(r.programs.length === 0 && r.nearMisses.length === 0 && r.alsoConsider.length === 0 ? { nothingFound: "No course matched even after loosening the filters that can be loosened (country and subject words are never dropped). Tell the student exactly which filters you tried, and offer a different country, level or subject." } : {}),
        };
      },
    },
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
        if (!record) return { error: `"${args.country}" doesn't match a country we have a guide for yet — call find_programs with that country to see what's actually in the network.` };
        return record;
      },
    },
    {
      spec: {
        name: "search_universities",
        description: "List universities (not individual courses) matching a country, name, subject, level, budget or scholarship filter — each with its best matching courses. Pass `name` (partial is fine) whenever a specific university is named. For 'where can I apply' questions with the student's scores, use find_programs instead. Returns up to 15 universities plus totalMatches.",
        parameters: {
          type: "object",
          properties: {
            name: { type: "string" }, country: { type: "string" }, subject: { type: "string" }, studyLevel: { type: "string" },
            maxBudget: { type: "number" }, budgetCurrency: { type: "string", description: "Currency symbol or code the budget is in. Defaults to the country's own currency." },
            scholarshipOnly: { type: "boolean" },
          },
        },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;
        const unis = getAllUniversities();
        const q = queryFromArgs({ ...args, university: args.name, limit: 25 });
        // A bare name search should list the university even if it has no courses entered.
        if (q.university && !q.subject && !q.level && !q.budget && !q.country) {
          const toks = searchTokens(q.university);
          const hits = unis.filter((u) => toks.every((t) => normalizeText(u.name).includes(t)));
          return { totalMatches: hits.length, universities: hits.slice(0, 15).map((u) => ({ id: u.id, name: u.name, city: u.city, country: u.country, worldRank: u.worldRank, scholarshipsAvailable: u.scholarshipsAvailable, courseCount: u.courses.length })) };
        }
        const r = findPrograms(unis, { ...q, limit: 25 });
        const by = new Map<string, { id: string; name: string; city: string; country: string; worldRank: string; matchingCourses: ReturnType<typeof slim>[] }>();
        for (const row of [...r.programs, ...r.nearMisses]) {
          const g = by.get(row.universityId) ?? { id: row.universityId, name: row.university, city: row.city, country: row.country, worldRank: row.worldRank, matchingCourses: [] };
          if (g.matchingCourses.length < 3) g.matchingCourses.push(slim(row));
          by.set(row.universityId, g);
        }
        return { totalMatches: by.size, universities: [...by.values()].slice(0, 15), relaxed: r.relaxed, notes: r.notes };
      },
    },
    {
      spec: {
        name: "search_courses",
        description: "Search courses across all partner universities by course name or subject words, university, country, level (master/bachelor/phd), maximum yearly fee (in `feeCurrency`, default the country's own) and intake month. Use for specific lookups ('MSc Data Science in the UK', 'cheapest MBA'). For 'which can I apply to' with the student's GPA/English, use find_programs. Returns up to 20 courses plus totalMatches; each has courseId for get_course_detail.",
        parameters: {
          type: "object",
          properties: {
            course: { type: "string" }, subject: { type: "string" }, university: { type: "string" }, country: { type: "string" }, studyLevel: { type: "string" },
            maxFee: { type: "number" }, feeCurrency: { type: "string", description: "Currency symbol or code maxFee is in." }, intake: { type: "string" },
          },
        },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;
        const r = findPrograms(getAllUniversities(), { ...queryFromArgs(args), limit: 20 });
        return {
          totalMatches: r.totalMatches,
          courses: r.programs.map(slim),
          relaxed: r.relaxed,
          notes: r.notes,
        };
      },
    },
    {
      spec: {
        name: "get_course_detail",
        description: "EVERYTHING recorded about one course and its university: fee, duration, study mode, intakes with open/closed status and application deadlines, academic entry requirements, English requirements, admission procedure (step by step), deposit and payment deadline, scholarships, campuses, modules, careers, course page link. Use the courseId from find_programs / search_courses. Use this for any question about intakes, entry requirements, admission process, deposit or deadlines for a specific course.",
        parameters: { type: "object", properties: { courseId: { type: "string" } }, required: ["courseId"] },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;
        return courseDetail(getAllUniversities(), String(args.courseId)) ?? { error: "No course found with that id — get ids from find_programs or search_courses." };
      },
    },
    {
      spec: {
        name: "search_scholarships",
        description: "Find the scholarships partner universities have actually entered, each with its award amount and eligibility note. Filter by country, university name, and/or subject. Use this whenever a student's budget or funding comes up, or when asked what scholarships exist. Universities flagged scholarshipsAvailable with no named scholarship are listed separately.",
        parameters: { type: "object", properties: { country: { type: "string" }, university: { type: "string" }, subject: { type: "string" } } },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;
        const country = str(args.country);
        const uniToks = searchTokens(str(args.university));
        const subjToks = searchTokens(str(args.subject));
        const unis = getAllUniversities().filter((u) =>
          (!country || countryMatches(u.country, country)) &&
          (!uniToks.length || uniToks.every((t) => normalizeText(u.name).includes(t))) &&
          (!subjToks.length || subjToks.every((t) => u.subjects.some((s) => normalizeText(s).includes(t)))));
        return {
          scholarships: unis.flatMap((u) => (u.scholarships ?? []).map((sc) => ({
            university: u.name, universityId: u.id, country: u.country, scholarship: sc.name, amount: sc.amount, eligibility: sc.description,
          }))).slice(0, 30),
          otherUniversitiesWithScholarships: unis.filter((u) => u.scholarshipsAvailable && !(u.scholarships ?? []).length).map((u) => ({ university: u.name, universityId: u.id })).slice(0, 15),
        };
      },
    },
    {
      spec: {
        name: "get_university_detail",
        description: "The full picture of one university by id: ranking, description, intakes (open/closed, deadlines), entry and English requirements, admission procedure, deposit and payment terms, scholarships, application-fee waiver, campuses, restricted regions, subjects, and its first 40 courses (with ids — use search_courses or find_programs to look through the rest, get_course_detail for one course).",
        parameters: { type: "object", properties: { id: { type: "string" } }, required: ["id"] },
      },
      execute: (args) => {
        const refusal = blocked();
        if (refusal) return refusal;
        const uni = getUniversityById(String(args.id));
        if (!uni) return { error: "No university found with that id." };
        return universitySummary(uni, 40);
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
