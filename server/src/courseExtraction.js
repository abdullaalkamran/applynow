// Turns one university course web page into a *draft* Course for Data Management to review:
// fetch the page (or take pasted text), boil the HTML down to readable text, ask the active LLM
// provider for a strictly-shaped JSON extraction, then normalise that JSON against the app's own
// enums and the university's own constraints. The model never writes to the catalog — every row
// goes through the course form and a human's Approve (see routes/courseImports.js).
//
// Keep the option lists here in sync with src/features/staff/data/CourseForm.tsx and
// src/utils/universityFilter.ts (TEST_NAME_OPTIONS) — the server has no shared module with the
// frontend, so these are deliberate duplicates.
const { getConfig } = require("./config");
const { callForJson } = require("./llmJson");

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const LEVELS = ["Undergraduate", "Postgraduate"];
const STUDY_MODES = ["Full-time", "Part-time", "Online", "Blended"];
const TEST_NAMES = [
  "IELTS", "TOEFL iBT", "TOEFL Essentials", "PTE Academic", "Duolingo English Test",
  "Cambridge C1 Advanced (CAE)", "Cambridge C2 Proficiency (CPE)", "Oxford ELLT", "LanguageCert Academic",
  "MOI (Medium of Instruction)", "Other",
];
const SKILLS = ["Listening", "Reading", "Writing", "Speaking"];
const CURRENCY_BY_CODE = { USD: "$", GBP: "£", EUR: "€", CAD: "C$", AUD: "A$", AED: "AED ", NZD: "NZ$", SGD: "S$", MYR: "RM " };
const CONFIDENCE = ["high", "medium", "low"];

const MAX_HTML_BYTES = 2_000_000;
const MAX_PAGE_CHARS = 40_000;
const MIN_USEFUL_CHARS = 800;
const FETCH_TIMEOUT_MS = 15_000;

// --- Fetching -------------------------------------------------------------------------------

class FetchError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

/** Staff paste arbitrary URLs and the server fetches them — refuse anything that could reach
 * the server's own network (SSRF guard). Public http(s) hosts only. */
function assertFetchableUrl(raw) {
  let url;
  try {
    url = new URL(String(raw).trim());
  } catch {
    throw Object.assign(new Error("Not a valid URL."), { status: 400 });
  }
  if (!["http:", "https:"].includes(url.protocol)) throw Object.assign(new Error("Only http(s) URLs can be fetched."), { status: 400 });
  const host = url.hostname.toLowerCase();
  const privateHost =
    host === "localhost" || host.endsWith(".localhost") || host === "::1" || host === "[::1]" ||
    /^127\./.test(host) || /^10\./.test(host) || /^192\.168\./.test(host) || /^169\.254\./.test(host) ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(host) || /^0\./.test(host);
  if (privateHost) throw Object.assign(new Error("Local and private-network addresses can't be imported."), { status: 400 });
  return url.toString();
}

/** Downloads one page with browser-like headers and hard limits on time and size. Every failure
 * becomes a FetchError whose message is written for the staff member reading the queue. */
async function fetchPage(url) {
  let response;
  try {
    response = await fetch(url, {
      redirect: "follow",
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      headers: {
        "user-agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "accept-language": "en-GB,en;q=0.9",
      },
    });
  } catch (err) {
    if (err && (err.name === "TimeoutError" || err.name === "AbortError")) {
      throw new FetchError("timeout", `The page didn't respond within ${FETCH_TIMEOUT_MS / 1000}s — try again later, or paste the page's text instead.`);
    }
    throw new FetchError("network", `Couldn't reach the page (${err?.message || "network error"}) — check the URL, or paste the page's text instead.`);
  }

  if ([401, 403, 429, 503].includes(response.status)) {
    // Cloudflare / Akamai style bot checks answer 403 with a small challenge page that only a
    // real, interactive browser can pass — the fix is the staff member's own browser, not us.
    const body = await response.text().catch(() => "");
    const challenge = /just a moment|attention required|enable javascript and cookies|verify you are human|checking your browser/i.test(body.slice(0, 5000));
    const vendor = /cloudflare/i.test(body) ? "Cloudflare" : "a security check";
    throw new FetchError(
      "blocked",
      challenge
        ? `This site's bot protection (${vendor}) blocks automatic reading. Open the page in your browser, press Ctrl+A then Ctrl+C, and use "Paste text" — or save the page (Ctrl+S, "Webpage, Complete") and choose the .html file there.`
        : `The site refused the request (HTTP ${response.status}) — open the page in your browser, copy its text, and use "Paste text" instead.`
    );
  }
  if (!response.ok) {
    throw new FetchError("http_error", `The page returned HTTP ${response.status} — check the URL.`);
  }
  const contentType = (response.headers.get("content-type") || "").toLowerCase();
  if (contentType && !/html|xml|text\/plain/.test(contentType)) {
    const kind = contentType.includes("pdf") ? "a PDF" : `a ${contentType.split(";")[0]} file`;
    throw new FetchError("unsupported_content_type", `This URL is ${kind}, not a web page — open it, copy the text, and use "Paste text" instead.`);
  }
  const declared = Number(response.headers.get("content-length") || 0);
  if (declared > MAX_HTML_BYTES) throw new FetchError("too_large", "The page is too large to import.");

  const html = (await response.text()).slice(0, MAX_HTML_BYTES);
  return { html, finalUrl: response.url || url, status: response.status };
}

// --- HTML → text -------------------------------------------------------------------------------

const ENTITIES = {
  amp: "&", lt: "<", gt: ">", quot: '"', apos: "'", nbsp: " ", pound: "£", euro: "€", dollar: "$", yen: "¥",
  copy: "©", reg: "®", trade: "™", ndash: "–", mdash: "—", hellip: "…", lsquo: "‘", rsquo: "’", ldquo: "“", rdquo: "”", bull: "•", middot: "·",
};

function decodeEntities(text) {
  return text
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(parseInt(hex, 16)))
    .replace(/&#(\d+);/g, (_, dec) => String.fromCodePoint(Number(dec)))
    .replace(/&([a-z]+);/gi, (m, name) => ENTITIES[name.toLowerCase()] ?? m);
}

function stripTags(fragment) {
  return fragment
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|section|article|tr|table|ul|ol|dl|dd|dt|blockquote|figure|fieldset|form)>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<h[1-6][^>]*>/gi, "\n## ")
    .replace(/<li[^>]*>/gi, "\n- ")
    .replace(/<\/li>/gi, "\n")
    .replace(/<\/(td|th)>/gi, " | ")
    .replace(/<[^>]+>/g, " ");
}

function tagContent(html, tag) {
  const match = html.match(new RegExp(`<${tag}\\b[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return match ? match[1] : "";
}

function metaContent(html, attr, value) {
  const re = new RegExp(`<meta\\s+[^>]*${attr}=["']${value}["'][^>]*>`, "i");
  const tag = html.match(re)?.[0];
  if (!tag) return "";
  return tag.match(/content=["']([^"']*)["']/i)?.[1] ?? "";
}

/** Boils a page down to what a person would read: no scripts, styles, chrome (header/nav/
 * footer/aside) or hidden markup; headings, list items and table cells keep a little structure so
 * the model can tell a fee table from prose. Regex-only on purpose — no HTML parser dependency. */
function htmlToText(html) {
  const source = String(html || "");
  const title = decodeEntities(stripTags(tagContent(source, "title"))).trim();
  const description = decodeEntities(metaContent(source, "name", "description") || metaContent(source, "property", "og:description")).trim();

  let body = source
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<(script|style|noscript|svg|template|iframe|canvas|video|audio|picture|select)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(header|nav|footer|aside)\b[\s\S]*?<\/\1>/gi, "");

  // Prefer the page's main content when it's clearly marked and substantial.
  const main = tagContent(body, "main") || tagContent(body, "article");
  if (main && decodeEntities(stripTags(main)).replace(/\s+/g, " ").length >= MIN_USEFUL_CHARS) {
    body = main;
  } else {
    body = tagContent(body, "body") || body;
  }

  const lines = decodeEntities(stripTags(body))
    .replace(/[ \t ]+/g, " ")
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length >= 3 && line !== "|" && line !== "-");
  let text = lines.join("\n").replace(/\n{3,}/g, "\n\n");

  const head = [title ? `Title: ${title}` : "", description ? `Description: ${description}` : ""].filter(Boolean).join("\n");
  text = head ? `${head}\n\n${text}` : text;

  let truncated = false;
  if (text.length > MAX_PAGE_CHARS) {
    text = `${text.slice(0, MAX_PAGE_CHARS)}\n[... page truncated ...]`;
    truncated = true;
  }
  return { text, title, truncated };
}

/** Bot-protection interstitials come back as HTTP 200 with a tiny challenge page. */
function detectBlockedPage(text) {
  const head = text.slice(0, 1500);
  return /just a moment|enable javascript and cookies|access denied|are you a human|attention required|verify you are human|checking your browser/i.test(head);
}

// --- Prompt -------------------------------------------------------------------------------------

function buildSystemPrompt({ university, allowedSubjects, existingCourseNames, allowedMonths }) {
  return `You extract ONE degree course from a university course web page into strict JSON for a study-abroad platform that serves INTERNATIONAL students only.

University context:
- Name: ${university.name} (${university.city}, ${university.country})
- The platform's default currency symbol for this university: ${university.currencySymbol}
- Courses already listed for this university: ${existingCourseNames.length ? existingCourseNames.join("; ") : "none"}

Hard rules:
1. Use ONLY facts stated on the page. When a value is not on the page, use null. Never estimate, infer from other universities, or fill in typical values.
2. Fees: report the fee for INTERNATIONAL / overseas / non-EU students, never the home/domestic fee. Report the number without currency symbols or thousands separators, the ISO currency code, and "feePeriod": "per_year" if the page gives an annual fee, "total" if it gives a whole-programme fee, or "unknown".
3. English language requirements: only those that apply to international applicants. Use test names ONLY from this list: ${TEST_NAMES.join(", ")}. Skills ONLY from: ${SKILLS.join(", ")}.
4. "level" must be exactly "Undergraduate" or "Postgraduate" (Master's, MBA, PhD, PGDip count as Postgraduate; Bachelor's, foundation years count as Undergraduate).
5. "intakes" must use month names ONLY from this list: ${allowedMonths.join(", ")}. Leave out any intake month not in the list.
6. "subject" must be copied VERBATIM from this list of subjects the university offers: ${allowedSubjects.join(" | ")}. If none of them genuinely fits, set "subject" to null and put your own short field-of-study label in "subjectGuess".
7. "studyMode" must be one of: ${STUDY_MODES.join(", ")} — or null.
8. "durationAmount" is a number and "durationUnit" is "months" or "years" (e.g. 12 + "months", 1.5 + "years").
9. "applicationDeadline" must be an ISO date YYYY-MM-DD, or null if the page gives no exact date (e.g. "rolling admissions").
10. "modules" and "careers" are short strings copied from the page (max 30 and 20 items). "requirements" are the academic entry requirements for international applicants (max 12 short strings).
11. "confidence" rates each field "high" (stated plainly on the page), "medium" (stated but ambiguous, e.g. several fee figures) or "low" (not found / guessed / unclear). "evidence" gives a short VERBATIM quote (max 200 characters) from the page that supports the fee, duration, intakes, applicationDeadline and englishRequirements values.
12. "possibleDuplicateOf": if this course looks like one already listed for the university (see above), give that listed name; otherwise null.
13. "notes": anything a human reviewer should know (fee year, conditions, multiple variants on the page, sandwich year, etc.).

Respond with ONLY a single JSON object, no markdown fences, no commentary, in exactly this shape:
{"name": "MSc Data Science", "level": "Postgraduate", "durationAmount": 12, "durationUnit": "months", "subject": "Computer Science & IT", "subjectGuess": null, "fee": 24500, "feeCurrency": "GBP", "feePeriod": "per_year", "intakes": ["September", "January"], "applicationDeadline": "2026-06-30", "studyMode": "Full-time", "description": "One or two sentences summarising the course, taken from the page.", "requirements": ["2:1 honours degree in a quantitative subject"], "englishRequirements": [{"testName": "IELTS", "minScore": "6.5", "skillScores": [{"skill": "Writing", "score": "6.0"}]}], "modules": ["..."], "careers": ["..."], "confidence": {"name": "high", "level": "high", "duration": "high", "subject": "medium", "fee": "medium", "intakes": "high", "applicationDeadline": "low", "requirements": "medium", "englishRequirements": "high", "studyMode": "high", "description": "high", "modules": "high", "careers": "medium"}, "evidence": {"fee": "International students: £24,500 per year", "duration": "12 months full-time", "intakes": "Start dates: September, January", "applicationDeadline": null, "englishRequirements": "IELTS 6.5 overall with no component below 6.0"}, "possibleDuplicateOf": null, "notes": ["Fee shown is for 2025/26 entry"]}`;
}

function buildUserPrompt({ sourceUrl, pageText }) {
  return `Source URL: ${sourceUrl}\n\nPage text:\n"""\n${pageText}\n"""`;
}

// --- Normalisation ---------------------------------------------------------------------------

const asString = (v, max = 400) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const asStringList = (v, max, each = 300) =>
  Array.isArray(v) ? [...new Set(v.map((s) => asString(s, each)).filter(Boolean))].slice(0, max) : [];
const normalizeName = (s) => String(s || "").toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();

function formatDuration(amount, unit) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) return "";
  const months = /month/i.test(String(unit));
  const singular = months ? "month" : "year";
  return `${n} ${n === 1 ? singular : `${singular}s`}`;
}

function parseDurationText(text) {
  const m = /(\d+(?:\.\d+)?)\s*(month|year)/i.exec(String(text || ""));
  return m ? formatDuration(m[1], m[2]) : "";
}

function normalizeMonth(value) {
  const s = asString(value, 20).toLowerCase();
  if (!s) return null;
  return MONTHS.find((m) => m.toLowerCase() === s || m.toLowerCase().startsWith(s.slice(0, 3))) ?? null;
}

function normalizeTestName(value) {
  const s = asString(value, 60);
  if (!s) return null;
  const exact = TEST_NAMES.find((t) => t.toLowerCase() === s.toLowerCase());
  if (exact) return exact;
  const lower = s.toLowerCase();
  if (/toefl/.test(lower)) return /essential/.test(lower) ? "TOEFL Essentials" : "TOEFL iBT";
  if (/pte/.test(lower)) return "PTE Academic";
  if (/duolingo/.test(lower)) return "Duolingo English Test";
  if (/c1|cae|advanced/.test(lower) && /cambridge/.test(lower)) return "Cambridge C1 Advanced (CAE)";
  if (/c2|cpe|proficiency/.test(lower) && /cambridge/.test(lower)) return "Cambridge C2 Proficiency (CPE)";
  if (/oxford/.test(lower)) return "Oxford ELLT";
  if (/languagecert/.test(lower)) return "LanguageCert Academic";
  if (/moi|medium of instruction/.test(lower)) return "MOI (Medium of Instruction)";
  if (/ielts/.test(lower)) return "IELTS";
  return null;
}

function normalizeLevel(rawLevel, name) {
  const s = asString(rawLevel, 40);
  const exact = LEVELS.find((l) => l.toLowerCase() === s.toLowerCase());
  if (exact) return { level: exact, guessed: false };
  const probe = `${s} ${name}`;
  if (/\b(msc|ma|mba|mres|mphil|llm|meng|march|med|mfa|phd|dba|master|masters|postgraduate|pgdip|pgcert|doctor)/i.test(probe)) return { level: "Postgraduate", guessed: true };
  if (/\b(bsc|ba|beng|bbs|llb|barch|bed|bachelor|bachelors|undergraduate|foundation|hnd|diploma)/i.test(probe)) return { level: "Undergraduate", guessed: true };
  return { level: "Postgraduate", guessed: true, unknown: true };
}

/** Coerces whatever the model produced into a `CourseDraft` the course form and courseWriteData()
 * accept, plus the review metadata. Every silent gap becomes a visible flag: a field the model
 * left null, marked low-confidence, or that failed a constraint lands in `needsAttention`, and
 * the money/date fields are always there regardless. Deterministic — no model calls. */
function normalizeExtraction(raw, { university, allowedSubjects, existingCourses, textSource, pageChars, truncated, extraWarnings = [] }) {
  const r = raw && typeof raw === "object" ? raw : {};
  const warnings = [...extraWarnings];
  const attention = new Set(["feeUSD", "applicationDeadline"]);
  const evidence = {};
  const rawEvidence = r.evidence && typeof r.evidence === "object" ? r.evidence : {};
  const quote = (key) => asString(rawEvidence[key], 200);
  if (quote("fee")) evidence.feeUSD = quote("fee");
  if (quote("duration")) evidence.duration = quote("duration");
  if (quote("intakes")) evidence.intakes = quote("intakes");
  if (quote("applicationDeadline")) evidence.applicationDeadline = quote("applicationDeadline");
  if (quote("englishRequirements")) evidence.englishRequirements = quote("englishRequirements");

  const rawConfidence = r.confidence && typeof r.confidence === "object" ? r.confidence : {};
  const confidenceOf = (key) => (CONFIDENCE.includes(rawConfidence[key]) ? rawConfidence[key] : "low");
  const confidence = {};
  const FIELD_MAP = {
    name: "name", level: "level", duration: "duration", subject: "subject", fee: "feeUSD", intakes: "intakes",
    applicationDeadline: "applicationDeadline", requirements: "requirements", englishRequirements: "englishRequirements",
    studyMode: "studyMode", description: "description", modules: "modules", careers: "careers",
  };
  for (const [rawKey, field] of Object.entries(FIELD_MAP)) {
    confidence[field] = confidenceOf(rawKey);
    if (confidence[field] === "low") attention.add(field);
  }

  // Name
  const name = asString(r.name, 200);
  if (!name) {
    attention.add("name");
    warnings.push("The course name couldn't be read from the page.");
  }

  // Level
  const { level, guessed: levelGuessed, unknown: levelUnknown } = normalizeLevel(r.level, name);
  if (levelUnknown) {
    attention.add("level");
    warnings.push('Level (Undergraduate / Postgraduate) wasn\'t clear from the page — defaulted to "Postgraduate".');
  } else if (levelGuessed) {
    confidence.level = confidence.level === "high" ? "medium" : confidence.level;
  }

  // Duration
  let duration = formatDuration(r.durationAmount, r.durationUnit) || parseDurationText(r.duration);
  if (!duration) {
    attention.add("duration");
    warnings.push("Course duration wasn't found on the page.");
  }

  // Subject — only the university's own list, verbatim.
  const rawSubject = asString(r.subject, 120);
  const subject = allowedSubjects.find((s) => s.toLowerCase() === rawSubject.toLowerCase()) ?? "";
  const subjectGuess = asString(r.subjectGuess, 80) || (rawSubject && !subject ? rawSubject : "");
  if (!subject) {
    attention.add("subject");
    warnings.push(
      subjectGuess
        ? `Subject: the page suggests "${subjectGuess}", which isn't in ${university.name}'s subject list — pick one, or add it on the university's Edit Details first.`
        : `Subject couldn't be matched to ${university.name}'s subject list — pick one.`
    );
  }

  // Fee + currency
  const feeNumber = Number(String(r.fee ?? "").replace(/[^0-9.]/g, ""));
  const feeUSD = Number.isFinite(feeNumber) && feeNumber > 0 ? feeNumber : 0;
  if (!feeUSD) warnings.push("No international tuition fee was found on the page — enter it by hand.");
  const feeCode = asString(r.feeCurrency, 5).toUpperCase();
  let currencySymbol = university.currencySymbol;
  if (feeCode && CURRENCY_BY_CODE[feeCode]) currencySymbol = CURRENCY_BY_CODE[feeCode];
  else if (feeCode) warnings.push(`Fee currency "${feeCode}" isn't one the form knows — the university's default (${university.currencySymbol.trim()}) was used; check it.`);
  const feePeriod = asString(r.feePeriod, 10);
  if (feeUSD && feePeriod === "total") {
    warnings.push("The fee on the page looks like the TOTAL programme fee; the app stores the fee PER YEAR — divide it if the course is longer than a year.");
  } else if (feeUSD && feePeriod === "unknown") {
    warnings.push("The page doesn't say whether the fee is per year or for the whole programme — check before approving.");
  }

  // Intakes — month names, restricted to the university's own intake months when it has any.
  const universityMonths = Array.isArray(university.intakes) && university.intakes.length ? university.intakes : MONTHS;
  const intakes = [];
  const droppedIntakes = [];
  for (const value of Array.isArray(r.intakes) ? r.intakes : []) {
    const month = normalizeMonth(value);
    if (!month) continue;
    if (!universityMonths.includes(month)) droppedIntakes.push(month);
    else if (!intakes.includes(month)) intakes.push(month);
  }
  if (droppedIntakes.length) {
    attention.add("intakes");
    warnings.push(`The page lists ${droppedIntakes.join(", ")} intake(s) that ${university.name} doesn't have — add them to the university first if they're real.`);
  }

  // Deadline — strict ISO date or nothing.
  let applicationDeadline;
  const rawDeadline = asString(r.applicationDeadline, 40);
  if (/^\d{4}-\d{2}-\d{2}$/.test(rawDeadline) && !Number.isNaN(new Date(rawDeadline).getTime())) applicationDeadline = rawDeadline;
  else if (rawDeadline) warnings.push(`Application deadline "${rawDeadline}" isn't an exact date — left blank.`);

  // Requirements / English
  const requirements = asStringList(r.requirements, 12, 300);
  const englishRequirements = [];
  for (const entry of Array.isArray(r.englishRequirements) ? r.englishRequirements : []) {
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
    if (minScore || skillScores.length) englishRequirements.push({ testName, minScore: minScore || undefined, skillScores });
  }
  if (englishRequirements.length) attention.add("englishRequirements");

  // Study mode / description / lists
  const rawMode = asString(r.studyMode, 20);
  const studyMode = STUDY_MODES.find((m) => m.toLowerCase() === rawMode.toLowerCase()) ?? "Full-time";
  if (rawMode && studyMode !== rawMode && !STUDY_MODES.some((m) => m.toLowerCase() === rawMode.toLowerCase())) {
    warnings.push(`Study mode "${rawMode}" isn't one of the form's options — set to Full-time.`);
  }
  const description = asString(r.description, 600);
  const modules = asStringList(r.modules, 30, 200);
  const careers = asStringList(r.careers, 20, 120);

  // Duplicate check against what the university already lists.
  let possibleDuplicateOf;
  const normalizedName = normalizeName(name);
  const dup = normalizedName ? existingCourses.find((c) => normalizeName(c.name) === normalizedName) : undefined;
  const modelDup = asString(r.possibleDuplicateOf, 200);
  const modelDupMatch = modelDup ? existingCourses.find((c) => normalizeName(c.name) === normalizeName(modelDup)) : undefined;
  if (dup || modelDupMatch) {
    const hit = dup || modelDupMatch;
    possibleDuplicateOf = { id: hit.id, name: hit.name };
    attention.add("name");
    warnings.push(`Looks like a duplicate of the existing course "${hit.name}".`);
  }

  if (truncated) warnings.push("The page was very long and was cut off before the end — fee or requirement tables near the bottom may be missing.");
  for (const note of asStringList(r.notes, 8, 300)) warnings.push(`Page note: ${note}`);

  const course = {
    name, level, duration, subject,
    feeUSD, currencySymbol,
    intakes, applicationDeadline,
    requirements, englishRequirements,
    campusIds: [], description, studyMode, modules, careers, accreditations: [],
  };

  const config = getConfig();
  const providerModel = { anthropic: config.anthropic.model, openai: config.openai.model, gemini: config.gemini.model, ollama: config.ollama.model, stub: "stub" }[config.provider] || "";

  return {
    course,
    confidence,
    needsAttention: [...attention],
    warnings,
    evidence,
    subjectGuess: subjectGuess || undefined,
    possibleDuplicateOf,
    meta: { provider: config.provider, model: providerModel, extractedAt: new Date().toISOString(), pageChars, textSource },
  };
}

// --- Shared "get me the page text" step (course and university import routes) -----------------

const MAX_PASTED_CHARS = 200_000;

/** Resolves the text the model should read for one queue row, in priority order: text the staff
 * member pasted in the request body (HTML or plain), the text stored from the last run (unless a
 * refetch was asked for), or a fresh fetch of the row's URL. Throws a FetchError with a message
 * written for the queue when the page can't be read. */
async function obtainPageText({ item, body }) {
  if (typeof body.pageText === "string" && body.pageText.trim()) {
    const pasted = body.pageText.slice(0, MAX_PASTED_CHARS);
    const cleaned = /^\s*</.test(pasted) ? htmlToText(pasted) : htmlToText(`<body>${pasted.replace(/\n/g, "<br>")}</body>`);
    return { text: cleaned.text, title: cleaned.title, truncated: cleaned.truncated, textSource: "paste" };
  }
  if (item.pageText && body.refetch !== true) {
    return { text: item.pageText, title: item.pageText.match(/^Title: (.+)$/m)?.[1] || "", truncated: false, textSource: item.textSource || "fetch" };
  }
  const url = assertFetchableUrl(item.sourceUrl);
  const page = await fetchPage(url);
  const cleaned = htmlToText(page.html);
  if (detectBlockedPage(cleaned.text)) {
    throw new FetchError("blocked", "The site showed a bot-protection page instead of the content — open it in your browser, copy the text, and use \"Paste text\".");
  }
  return { text: cleaned.text, title: cleaned.title, truncated: cleaned.truncated, textSource: "fetch" };
}

/** The uniform "not enough to work with" check both routes apply after obtainPageText. */
function assertUsefulText(text) {
  if (text.replace(/\s+/g, " ").length < MIN_USEFUL_CHARS) {
    throw new FetchError("too_little_text", `Only ${text.length} characters of text came back — the page is probably built by JavaScript or blocked. Open it in your browser, select all, copy, and use "Paste text".`);
  }
}

// --- Entry point ------------------------------------------------------------------------------

/** Runs the model over already-cleaned page text and returns the normalised ExtractionResult.
 * With the stub provider (no API key configured) it returns a deterministic title-only draft so
 * the whole review flow can be exercised without spending anything. */
async function extractCourse({ university, sourceUrl, pageText, pageTitle, textSource, existingCourses, allowedSubjects, truncated, extraWarnings }) {
  const ctx = { university, allowedSubjects, existingCourses, textSource, pageChars: pageText.length, truncated, extraWarnings };
  if (getConfig().provider === "stub") {
    return normalizeExtraction(
      { name: pageTitle || "", confidence: {}, notes: [] },
      { ...ctx, extraWarnings: [...(extraWarnings || []), "The AI provider is set to \"stub\" (no API key) — nothing was extracted from the page. Choose a real provider in Admin → AI Settings and re-run."] }
    );
  }
  const allowedMonths = Array.isArray(university.intakes) && university.intakes.length ? university.intakes : MONTHS;
  const existingCourseNames = existingCourses.map((c) => c.name);
  return callForJson({
    systemPrompt: buildSystemPrompt({ university, allowedSubjects, existingCourseNames, allowedMonths }),
    userPrompt: buildUserPrompt({ sourceUrl, pageText }),
    validate: (parsed) => normalizeExtraction(parsed, ctx),
    maxTokens: 4096,
    timeoutMs: 60_000,
    label: "Course extraction",
  });
}

module.exports = {
  assertFetchableUrl, fetchPage, htmlToText, detectBlockedPage, obtainPageText, assertUsefulText,
  extractCourse, normalizeExtraction, FetchError,
  MAX_PAGE_CHARS, MIN_USEFUL_CHARS, MONTHS, TEST_NAMES, SKILLS, CURRENCY_BY_CODE, CONFIDENCE,
  asString, asStringList, normalizeMonth, normalizeTestName,
};
