// University-level counterpart of courseExtraction.js: turns one university web page (ideally
// its "international students" / "how to apply" / fees page, or the homepage) into a *draft*
// University for Data Management to review in the university form. Shares the fetch, HTML→text
// and LLM plumbing; only the prompt and the normalisation are specific to universities.
//
// Option lists mirror the university form (src/features/staff/data/UniversityForm.tsx) — the
// server has no shared module with the frontend, so these are deliberate duplicates.
const { getConfig } = require("./config");
const { callForJson } = require("./llmJson");
const {
  MONTHS, TEST_NAMES, SKILLS, CURRENCY_BY_CODE, CONFIDENCE, asString, asStringList, normalizeMonth, normalizeTestName,
} = require("./courseExtraction");

const TONES = ["violet", "amber", "teal", "rose"];

function buildSystemPrompt({ countryHint, allowedSubjects, allowedCountries, existingUniversityNames }) {
  return `You extract ONE university's profile from one of its web pages into strict JSON for a study-abroad platform that serves INTERNATIONAL students only.

Context:
- ${countryHint ? `The staff member says this university is in: ${countryHint}.` : "The country is not known in advance — take it from the page."}
- Countries the platform knows (use one of these names verbatim for "country" when it fits, else the page's own country name): ${allowedCountries.join(" | ")}
- Subjects / fields of study the platform uses (copy names VERBATIM into "subjects" for every field this university clearly teaches): ${allowedSubjects.join(" | ")}
- Universities already in the catalog: ${existingUniversityNames.length ? existingUniversityNames.join("; ") : "none"}

Hard rules:
1. Use ONLY facts stated on the page. When a value is not on the page, use null (or an empty list). Never estimate or fill in typical values.
2. Everything is about INTERNATIONAL / overseas applicants: fees are the international tuition fees (annual, as a number plus ISO currency code); entry and English requirements are those for international applicants.
3. "intakes" must use month names ONLY from: ${MONTHS.join(", ")}.
4. English test names ONLY from: ${TEST_NAMES.join(", ")}. Skills ONLY from: ${SKILLS.join(", ")}. Give undergraduate and postgraduate requirements separately when the page distinguishes them; if it gives one set, put it under both.
5. "requirements" (academic entry requirements) are short strings, separately for undergraduate and postgraduate (max 10 each).
6. "fees" is a list of {"label", "amount"} for the main annual international tuition figures (e.g. "Undergraduate tuition", "Postgraduate tuition", "MBA") — max 6. "feeCurrency" is the ISO code they're in.
7. Deposit: "minimumDepositAmount" (number, same currency) and "depositRules" (short strings, e.g. refund conditions) only if stated.
8. "campuses": [{"name","city"}] for each campus named on the page (max 8). "scholarships": [{"name","amount","description"}] for international scholarships (max 8; "amount" as text like "£3,000" or "20% of tuition").
9. "highlights": 3-6 short selling points stated on the page. "description": 2-3 sentences summarising the university from the page. "accreditations": bodies/memberships named (e.g. "AACSB", "Russell Group").
10. "studentCount" as text like "25,000+" if stated; "qsRanking"/"timesHigherRanking" as text like "#301-350" or "Top 200" only if the page states them; "employability" as a percentage string only if stated.
11. "admissionSteps": the ordered application steps for international applicants if the page lists them (max 8 short strings).
12. "moiAccepted": true only if the page says a Medium of Instruction letter is accepted instead of an English test; "internalEnglishTestOffered": true only if the university runs its own English test.
13. "confidence" rates each of: name, city, country, intakes, fees, requirements, englishRequirements, deposit, scholarships, campuses — "high" | "medium" | "low". "evidence" gives a short VERBATIM quote (max 200 chars) supporting fees, intakes, englishRequirements and deposit.
14. "possibleDuplicateOf": the catalog university name if this looks like one already listed; else null. "notes": anything a reviewer should know.

Respond with ONLY a single JSON object, no markdown fences, no commentary, in exactly this shape:
{"name": "University of Example", "city": "Exampleton", "country": "United Kingdom", "website": "https://www.example.ac.uk", "description": "...", "highlights": ["..."], "tags": ["..."], "subjects": ["Business & Management"], "intakes": ["September", "January"], "requirements": {"undergraduate": ["..."], "postgraduate": ["..."]}, "englishRequirements": {"undergraduate": [{"testName": "IELTS", "minScore": "6.0", "skillScores": [{"skill": "Writing", "score": "5.5"}]}], "postgraduate": [{"testName": "IELTS", "minScore": "6.5", "skillScores": []}]}, "feeCurrency": "GBP", "fees": [{"label": "Undergraduate tuition", "amount": 15500}], "minimumDepositAmount": 4000, "depositRules": ["..."], "paymentDeadline": null, "admissionSteps": ["..."], "campuses": [{"name": "City Campus", "city": "Exampleton"}], "scholarships": [{"name": "International Excellence Scholarship", "amount": "£3,000", "description": "..."}], "scholarshipsAvailable": true, "accreditations": ["AACSB"], "studentCount": "25,000+", "qsRanking": null, "timesHigherRanking": null, "employability": null, "moiAccepted": false, "internalEnglishTestOffered": false, "confidence": {"name": "high", "city": "high", "country": "high", "intakes": "medium", "fees": "medium", "requirements": "medium", "englishRequirements": "high", "deposit": "low", "scholarships": "medium", "campuses": "high"}, "evidence": {"fees": "International tuition fee: £15,500 per year", "intakes": "September and January intakes", "englishRequirements": "IELTS 6.0 with no less than 5.5", "deposit": null}, "possibleDuplicateOf": null, "notes": ["..."]}`;
}

function buildUserPrompt({ sourceUrl, pageText }) {
  return `Source URL: ${sourceUrl}\n\nPage text:\n"""\n${pageText}\n"""`;
}

function normalizeEnglishList(list, warnings) {
  const out = [];
  for (const entry of Array.isArray(list) ? list : []) {
    if (!entry || typeof entry !== "object") continue;
    const testName = normalizeTestName(entry.testName);
    if (!testName) {
      if (asString(entry.testName, 60)) warnings.push(`English test "${asString(entry.testName, 60)}" isn't one the form knows — left out.`);
      continue;
    }
    const minScore = asString(entry.minScore ?? "", 20);
    const skillScores = (Array.isArray(entry.skillScores) ? entry.skillScores : [])
      .map((s) => ({ skill: SKILLS.find((k) => k.toLowerCase() === asString(s?.skill, 20).toLowerCase()), score: asString(s?.score ?? "", 20) }))
      .filter((s) => s.skill && s.score);
    if (minScore || skillScores.length) out.push({ testName, minScore: minScore || undefined, skillScores });
  }
  return out;
}

function pickTone(name) {
  const seed = [...String(name)].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return TONES[seed % TONES.length];
}

/** Coerces the model's JSON into the `Omit<University,"id">` shape the university form and
 * universityWriteData() accept, plus the review metadata. Same philosophy as the course
 * normaliser: every gap or doubt becomes a visible flag, and money is always flagged. */
function normalizeExtraction(raw, { countryHint, allowedSubjects, allowedCountries, existingUniversities, textSource, pageChars, truncated, extraWarnings = [], sourceUrl }) {
  const r = raw && typeof raw === "object" ? raw : {};
  const warnings = [...extraWarnings];
  const attention = new Set(["fees", "minimumDepositAmount"]);
  const rawEvidence = r.evidence && typeof r.evidence === "object" ? r.evidence : {};
  const evidence = {};
  for (const [rawKey, field] of [["fees", "fees"], ["intakes", "intakes"], ["englishRequirements", "englishRequirements"], ["deposit", "minimumDepositAmount"]]) {
    const q = asString(rawEvidence[rawKey], 200);
    if (q) evidence[field] = q;
  }
  const rawConfidence = r.confidence && typeof r.confidence === "object" ? r.confidence : {};
  const confidence = {};
  for (const [rawKey, field] of [
    ["name", "name"], ["city", "city"], ["country", "country"], ["intakes", "intakes"], ["fees", "fees"], ["requirements", "requirements"],
    ["englishRequirements", "englishRequirements"], ["deposit", "minimumDepositAmount"], ["scholarships", "scholarships"], ["campuses", "campuses"],
  ]) {
    confidence[field] = CONFIDENCE.includes(rawConfidence[rawKey]) ? rawConfidence[rawKey] : "low";
    if (confidence[field] === "low") attention.add(field);
  }

  const name = asString(r.name, 160);
  if (!name) { attention.add("name"); warnings.push("The university's name couldn't be read from the page."); }
  const city = asString(r.city, 80);
  if (!city) { attention.add("city"); warnings.push("City wasn't found on the page."); }

  // Country: the staff member's batch choice wins; otherwise the page's word, matched to the
  // catalog's country names when possible.
  let country = countryHint || "";
  if (!country) {
    const fromPage = asString(r.country, 80);
    country = allowedCountries.find((c) => c.toLowerCase() === fromPage.toLowerCase()) || fromPage;
    if (!country) { attention.add("country"); warnings.push("Country wasn't found on the page — pick it."); }
    else if (!allowedCountries.includes(country)) { attention.add("country"); warnings.push(`Country "${country}" isn't in the platform's country list yet — add it under Countries first, or pick the matching one.`); }
  }

  let website = asString(r.website, 200);
  if (!/^https?:\/\//i.test(website)) {
    try { website = new URL(sourceUrl).origin; } catch { website = ""; }
  }

  const description = asString(r.description, 1200);
  const highlights = asStringList(r.highlights, 6, 160);
  const tags = asStringList(r.tags, 6, 40);
  const subjects = asStringList(r.subjects, 40, 80)
    .map((s) => allowedSubjects.find((a) => a.toLowerCase() === s.toLowerCase()))
    .filter(Boolean);
  const droppedSubjects = asStringList(r.subjects, 40, 80).filter((s) => !subjects.some((a) => a.toLowerCase() === s.toLowerCase()));
  if (droppedSubjects.length) warnings.push(`Subjects not in the platform's list were left out: ${droppedSubjects.slice(0, 6).join(", ")}${droppedSubjects.length > 6 ? "…" : ""}.`);

  const intakes = [];
  for (const value of Array.isArray(r.intakes) ? r.intakes : []) {
    const month = normalizeMonth(value);
    if (month && !intakes.includes(month)) intakes.push(month);
  }
  if (!intakes.length) { attention.add("intakes"); warnings.push("No intake months were found — set them by hand."); }

  const reqRaw = r.requirements && typeof r.requirements === "object" ? r.requirements : {};
  const requirements = { undergraduate: asStringList(reqRaw.undergraduate, 10, 300), postgraduate: asStringList(reqRaw.postgraduate, 10, 300) };
  const engRaw = r.englishRequirements && typeof r.englishRequirements === "object" ? r.englishRequirements : {};
  const englishRequirements = { undergraduate: normalizeEnglishList(engRaw.undergraduate, warnings), postgraduate: normalizeEnglishList(engRaw.postgraduate, warnings) };
  if (englishRequirements.undergraduate.length || englishRequirements.postgraduate.length) attention.add("englishRequirements");

  const feeCode = asString(r.feeCurrency, 5).toUpperCase();
  const currencySymbol = CURRENCY_BY_CODE[feeCode] || "$";
  if (feeCode && !CURRENCY_BY_CODE[feeCode]) warnings.push(`Fee currency "${feeCode}" isn't one the form knows — "$" was used; check it.`);
  if (!feeCode) warnings.push("The page didn't make the fee currency clear — check the currency symbol.");
  const fees = (Array.isArray(r.fees) ? r.fees : [])
    .map((f) => ({ label: asString(f?.label, 60), amount: Number(String(f?.amount ?? "").replace(/[^0-9.]/g, "")) }))
    .filter((f) => f.label && Number.isFinite(f.amount) && f.amount > 0)
    .slice(0, 6);
  if (!fees.length) warnings.push("No international tuition fees were found on the page — enter them by hand.");

  const depositNumber = Number(String(r.minimumDepositAmount ?? "").replace(/[^0-9.]/g, ""));
  const minimumDepositAmount = Number.isFinite(depositNumber) && depositNumber > 0 ? depositNumber : undefined;
  const depositRules = asStringList(r.depositRules, 6, 300);
  const rawDeadline = asString(r.paymentDeadline, 40);
  const paymentDeadline = /^\d{4}-\d{2}-\d{2}$/.test(rawDeadline) ? rawDeadline : undefined;
  const admissionSteps = asStringList(r.admissionSteps, 8, 200);

  const campuses = (Array.isArray(r.campuses) ? r.campuses : [])
    .map((c, i) => ({ id: `cmp-import-${Date.now().toString(36)}-${i}`, name: asString(c?.name, 80), city: asString(c?.city, 80) || city }))
    .filter((c) => c.name)
    .slice(0, 8);
  const scholarships = (Array.isArray(r.scholarships) ? r.scholarships : [])
    .map((s) => ({ name: asString(s?.name, 120), amount: asString(s?.amount, 60), description: asString(s?.description, 300) || undefined }))
    .filter((s) => s.name)
    .slice(0, 8);
  const accreditations = asStringList(r.accreditations, 10, 80);

  const minIELTS =
    Number(englishRequirements.undergraduate.find((e) => e.testName === "IELTS")?.minScore) ||
    Number(englishRequirements.postgraduate.find((e) => e.testName === "IELTS")?.minScore) || 0;

  let possibleDuplicateOf;
  const norm = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
  const dup = existingUniversities.find((u) => norm(u.name) === norm(name)) ||
    existingUniversities.find((u) => asString(r.possibleDuplicateOf, 160) && norm(u.name) === norm(r.possibleDuplicateOf));
  if (dup) {
    possibleDuplicateOf = { id: dup.id, name: dup.name };
    attention.add("name");
    warnings.push(`Looks like "${dup.name}" is already in the catalog.`);
  }
  if (truncated) warnings.push("The page was very long and was cut off before the end — fee tables near the bottom may be missing.");
  for (const note of asStringList(r.notes, 8, 300)) warnings.push(`Page note: ${note}`);

  const university = {
    name, city, country, website, tone: pickTone(name),
    worldRank: asString(r.qsRanking, 40) || asString(r.timesHigherRanking, 40) || "#100",
    qsRanking: asString(r.qsRanking, 40) || undefined,
    timesHigherRanking: asString(r.timesHigherRanking, 40) || undefined,
    employability: asString(r.employability, 20) || "85%",
    studentCount: asString(r.studentCount, 30) || "20,000+",
    description, highlights, tags, subjects, intakes,
    intakeStatus: Object.fromEntries(intakes.map((m) => [m, true])),
    intakeDates: {},
    openIntake: intakes.length ? `${intakes[0]} ${new Date().getFullYear() + 1}` : "",
    requirements, englishRequirements,
    moiAccepted: r.moiAccepted === true, moiAcceptedUniversities: [],
    internalEnglishTestOffered: r.internalEnglishTestOffered === true,
    accreditations,
    scholarshipsAvailable: r.scholarshipsAvailable === true || scholarships.length > 0,
    scholarships,
    currencySymbol, minIELTS, minGPA: 0,
    fees,
    minimumDepositAmount, depositMode: "custom", paymentDeadline, depositRules,
    admissionSteps, restrictedRegions: [],
    campuses, courses: [],
  };

  const config = getConfig();
  const providerModel = { anthropic: config.anthropic.model, openai: config.openai.model, gemini: config.gemini.model, ollama: config.ollama.model, stub: "stub" }[config.provider] || "";
  return {
    university, confidence,
    needsAttention: [...attention],
    warnings, evidence, possibleDuplicateOf,
    meta: { provider: config.provider, model: providerModel, extractedAt: new Date().toISOString(), pageChars, textSource },
  };
}

async function extractUniversity({ sourceUrl, pageText, pageTitle, textSource, countryHint, allowedSubjects, allowedCountries, existingUniversities, truncated, extraWarnings }) {
  const ctx = { countryHint, allowedSubjects, allowedCountries, existingUniversities, textSource, pageChars: pageText.length, truncated, extraWarnings, sourceUrl };
  if (getConfig().provider === "stub") {
    return normalizeExtraction(
      { name: (pageTitle || "").split(/[|–-]/)[0].trim(), confidence: {}, notes: [] },
      { ...ctx, extraWarnings: [...(extraWarnings || []), "The AI provider is set to \"stub\" (no API key) — nothing was extracted from the page. Choose a real provider in Admin → AI Settings and re-run."] }
    );
  }
  return callForJson({
    systemPrompt: buildSystemPrompt({ countryHint, allowedSubjects, allowedCountries, existingUniversityNames: existingUniversities.map((u) => u.name) }),
    userPrompt: buildUserPrompt({ sourceUrl, pageText }),
    validate: (parsed) => normalizeExtraction(parsed, ctx),
    maxTokens: 6144,
    timeoutMs: 75_000,
    label: "University extraction",
  });
}

module.exports = { extractUniversity, normalizeExtraction };
