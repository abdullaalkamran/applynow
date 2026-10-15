// Reads a batch of a student's documents (passport, transcripts, certificates, English test reports, CV) and
// proposes a profile from them — the staff-side counterpart to passportExtraction.js, which only handles one
// passport photo for the student's own form. Same contract: strict-JSON prompt through callForJson(), a
// normaliser that never keeps a value the model didn't actually report, and an honest "not available" instead
// of fabricated data when no real AI provider is configured. Nothing is stored here — the caller shows the
// proposal to the counsellor for approval before anything is created.
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const { getConfig } = require("./config");
const { callForJson } = require("./llmJson");

const DOC_TYPES = ["passport", "transcript", "certificate", "english_test", "cv", "other"];
const LEVELS = ["SSC / O-Level", "HSC / A-Level", "Diploma", "Bachelor's", "Master's", "PhD", "Other"];
const PERSONAL_KEYS = [
  "firstName", "lastName", "dob", "gender", "nationality", "passportNumber", "personalNumber", "placeOfBirth",
  "issuingAuthority", "issueDate", "passportExpiry", "fatherName", "motherName", "permanentAddress", "email", "phone",
];
const DATE_KEYS = new Set(["dob", "issueDate", "passportExpiry"]);
const MAX_PDF_TEXT = 14000;

const str = (v, max = 300) => (typeof v === "string" ? v.trim().slice(0, max) : typeof v === "number" ? String(v) : "");
const isoDate = (v) => { const s = str(v, 10); return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : ""; };

const SYSTEM_PROMPT = `You read ONE document belonging to a student (a photo, scan or extracted text) for a study-abroad platform, classify it, and extract profile data into strict JSON.

Hard rules:
1. Use ONLY what is actually printed and legible. Never guess or invent a plausible value. If something isn't there, use null / an empty list.
2. Dates are ISO YYYY-MM-DD where a full date is printed (convert from any format). Years like passingYear are 4-digit strings.
3. "docType" is exactly one of: passport, transcript, certificate, english_test, cv, other.
4. "academic" entries: "level" is exactly one of "SSC / O-Level", "HSC / A-Level", "Diploma", "Bachelor's", "Master's", "PhD", "Other" (map e.g. Secondary/Matric/GCSE -> SSC / O-Level, Higher Secondary/Intermediate/A-Level -> HSC / A-Level, BSc/BA/BEng -> Bachelor's, MSc/MA/MBA -> Master's). Give institution, board (for school levels), group (e.g. Science/Commerce/Arts, school levels only), major (degree levels), grade (as printed, e.g. "3.85 / 4.00" or "5.00") and passingYear.
5. "english": one entry per English test result with testName (e.g. "IELTS", "TOEFL iBT", "PTE Academic", "Duolingo English Test"), overallScore, listening, reading, writing, speaking, testDate, reportNumber — scores as printed.
6. "work": employment history from a CV (company, title, industry, startDate, endDate, currentlyWorking, description of 1-2 sentences). Only for real entries.
7. Only fill "personal" from documents that actually state those facts (passport data page, CV header). Never infer a gender or nationality from a name.
8. If the document is unreadable or irrelevant, return docType "other", empty data, and explain in "notes".

Respond with ONLY one JSON object, no fences, in exactly this shape:
{"docType":"transcript","personal":{"firstName":null,"lastName":null,"dob":null,"gender":null,"nationality":null,"passportNumber":null,"personalNumber":null,"placeOfBirth":null,"issuingAuthority":null,"issueDate":null,"passportExpiry":null,"fatherName":null,"motherName":null,"permanentAddress":null,"email":null,"phone":null},"academic":[{"level":"Bachelor's","institution":"...","board":null,"group":null,"major":"...","grade":"...","passingYear":"2025"}],"english":[],"work":[],"notes":[]}`;

function normalize(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const docType = DOC_TYPES.includes(r.docType) ? r.docType : "other";
  const p = r.personal && typeof r.personal === "object" ? r.personal : {};
  const personal = {};
  for (const k of PERSONAL_KEYS) {
    const v = DATE_KEYS.has(k) ? isoDate(p[k]) : str(p[k], k === "permanentAddress" ? 300 : 120);
    if (v) personal[k] = v;
  }
  if (personal.gender && !["Male", "Female"].includes(personal.gender)) delete personal.gender;
  const academic = (Array.isArray(r.academic) ? r.academic : []).map((a) => ({
    level: LEVELS.includes(a?.level) ? a.level : "Other",
    institution: str(a?.institution, 150), board: str(a?.board, 100), group: str(a?.group, 60),
    major: str(a?.major, 120), grade: str(a?.grade, 40), passingYear: /^\d{4}$/.test(str(a?.passingYear, 4)) ? str(a.passingYear, 4) : "",
  })).filter((a) => a.institution);
  const english = (Array.isArray(r.english) ? r.english : []).map((e) => ({
    testName: str(e?.testName, 60), overallScore: str(e?.overallScore, 10), listening: str(e?.listening, 10), reading: str(e?.reading, 10),
    writing: str(e?.writing, 10), speaking: str(e?.speaking, 10), testDate: isoDate(e?.testDate), reportNumber: str(e?.reportNumber, 60),
  })).filter((e) => e.testName && e.overallScore);
  const work = (Array.isArray(r.work) ? r.work : []).map((w) => ({
    company: str(w?.company, 120), title: str(w?.title, 120), industry: str(w?.industry, 80), startDate: str(w?.startDate, 10),
    endDate: str(w?.endDate, 10), currentlyWorking: w?.currentlyWorking === true, description: str(w?.description, 600),
  })).filter((w) => w.company && w.title);
  const notes = (Array.isArray(r.notes) ? r.notes : []).map((n) => str(n, 300)).filter(Boolean);
  return { docType, personal, academic, english, work, notes };
}

/** One uploaded file -> its classified/extracted content. Images go to the model as vision input; PDFs are read
 * through their text layer (scanned, text-less PDFs can't be read — the counsellor is told to upload a photo). */
async function extractOne(file) {
  const base = { fileName: file.originalname };
  try {
    let image;
    let userPrompt = "Classify this document and extract its profile data.";
    if (/^image\//i.test(file.mimetype)) {
      image = { mimeType: file.mimetype, base64: file.buffer.toString("base64") };
    } else if (file.buffer.slice(0, 5).toString() === "%PDF-") {
      const text = ((await pdfParse(file.buffer)).text || "").trim();
      if (!text) return { ...base, docType: "other", warnings: ["This PDF has no readable text (it looks scanned) — upload a clear photo of each page instead."], personal: {}, academic: [], english: [], work: [] };
      userPrompt += `\n\nDocument text:\n${text.slice(0, MAX_PDF_TEXT)}`;
    } else {
      return { ...base, docType: "other", warnings: ["Unsupported file type — upload an image or PDF."], personal: {}, academic: [], english: [], work: [] };
    }
    const result = await callForJson({ systemPrompt: SYSTEM_PROMPT, userPrompt, image, validate: normalize, maxTokens: 2048, timeoutMs: 60_000, label: "Document extraction" });
    const { notes, ...rest } = result;
    return { ...base, ...rest, warnings: notes };
  } catch (err) {
    return { ...base, docType: "other", warnings: [err?.message || "Couldn't read this file."], personal: {}, academic: [], english: [], work: [] };
  }
}

// Passport first so its identity fields win over a CV/transcript's looser ones.
const MERGE_ORDER = { passport: 0, english_test: 1, transcript: 2, certificate: 3, cv: 4, other: 5 };

function merge(docs) {
  const personal = {};
  const academic = [];
  const english = [];
  const work = [];
  for (const d of [...docs].sort((a, b) => MERGE_ORDER[a.docType] - MERGE_ORDER[b.docType])) {
    for (const [k, v] of Object.entries(d.personal)) if (!personal[k]) personal[k] = v;
    for (const a of d.academic) {
      const dup = academic.find((x) => x.level === a.level && x.institution.toLowerCase() === a.institution.toLowerCase());
      if (dup) { for (const k of Object.keys(a)) if (!dup[k] && a[k]) dup[k] = a[k]; } else academic.push({ ...a });
    }
    for (const e of d.english) if (!english.some((x) => x.testName === e.testName && x.reportNumber === e.reportNumber && x.overallScore === e.overallScore)) english.push(e);
    for (const w of d.work) if (!work.some((x) => x.company.toLowerCase() === w.company.toLowerCase() && x.title.toLowerCase() === w.title.toLowerCase())) work.push(w);
  }
  return { personal, academic, english, work };
}

async function extractProfile(files) {
  if (getConfig().provider === "stub") {
    return { available: false, documents: [], profile: { personal: {}, academic: [], english: [], work: [] }, warnings: ["No AI provider is configured — set one in Admin → AI Settings to read documents."] };
  }
  const documents = await Promise.all(files.map(extractOne));
  return { available: true, documents, profile: merge(documents), warnings: [] };
}

module.exports = { extractProfile, _test: { normalize, merge } };
