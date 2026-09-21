// Real AI vision extraction of a passport data page — replaces what used to be a fabricated mock
// (a hardcoded fake person filled in on a timer, regardless of what was actually uploaded). Follows
// the same shape as courseExtraction.js/universityExtraction.js: a system prompt, a callForJson()
// round trip, and a normalizer that never invents a value the model didn't actually report.
const { getConfig } = require("./config");
const { getProvider } = require("./providers");
const { callForJson } = require("./llmJson");

const CONFIDENCE = ["high", "medium", "low"];

// Every field the personal-information form can auto-fill from a passport, plus the optional
// "Personal Data and Emergency Contact" page some booklets include.
const FIELD_KEYS = [
  "firstName", "lastName", "passportNumber", "personalNumber", "nationality", "dob", "gender",
  "fatherName", "motherName", "placeOfBirth", "issuingAuthority", "issueDate", "expiryDate", "permanentAddress",
];
const EMERGENCY_CONTACT_KEYS = ["name", "relationship", "address", "phone"];

function asString(v, max = 300) {
  if (typeof v !== "string") return "";
  return v.trim().slice(0, max);
}

function asDate(v) {
  const s = asString(v, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : "";
}

function buildSystemPrompt() {
  return `You read ONE passport photo or scan and extract its data-page fields into strict JSON, for a study-abroad platform's identity-verification form.

Hard rules:
1. Use ONLY what is actually printed and legible on the image. Never guess, estimate, or invent a plausible-looking value. When a field isn't visible, isn't printed, or is too blurry to read confidently, use null for it.
2. Dates must be ISO format YYYY-MM-DD, converting from whatever format the passport prints (e.g. DD/MM/YYYY, DD MMM YYYY).
3. "nationality" is the country name in plain English, as printed or clearly implied (e.g. "Bangladesh", "India"), or null.
4. "gender" is exactly "Male", "Female", or null if not printed or not legible.
5. Most booklets have no separate emergency-contact page — "emergencyContact" must be null unless the image actually shows a filled-in "Personal Data and Emergency Contact" (or equivalent) page; never fabricate one.
6. "confidence" rates each non-null top-level field "high" | "medium" | "low" based on how clearly it was legible.
7. If the image isn't a passport at all, or is too blurry/dark/cropped to read anything reliably, return every field as null and say why in "notes".

Respond with ONLY a single JSON object, no markdown fences, no commentary, in exactly this shape:
{"firstName": "...", "lastName": "...", "passportNumber": "...", "personalNumber": null, "nationality": "...", "dob": "1998-04-12", "gender": "Female", "fatherName": null, "motherName": null, "placeOfBirth": "...", "issuingAuthority": "...", "issueDate": "2019-01-01", "expiryDate": "2029-01-01", "permanentAddress": null, "emergencyContact": null, "confidence": {"firstName": "high"}, "notes": []}`;
}

/** Coerces the model's JSON into `{ fields, emergencyContact, confidence, extractedKeys, warnings }`
 * — only fields the model actually reported make it into `fields`/`extractedKeys`; every gap is
 * left out rather than papered over, so the caller only marks genuinely-extracted fields as
 * "auto-filled" instead of blindly trusting a fixed field list. */
function normalizeExtraction(raw) {
  const r = raw && typeof raw === "object" ? raw : {};
  const warnings = [];
  const rawConfidence = r.confidence && typeof r.confidence === "object" ? r.confidence : {};

  const fields = {};
  const confidence = {};
  for (const key of FIELD_KEYS) {
    const isDate = key === "dob" || key === "issueDate" || key === "expiryDate";
    const value = isDate ? asDate(r[key]) : asString(r[key], key === "permanentAddress" ? 300 : 120);
    if (value) {
      fields[key] = value;
      confidence[key] = CONFIDENCE.includes(rawConfidence[key]) ? rawConfidence[key] : "medium";
    }
  }
  const extractedKeys = Object.keys(fields);

  let emergencyContact;
  const ecRaw = r.emergencyContact && typeof r.emergencyContact === "object" ? r.emergencyContact : null;
  if (ecRaw) {
    const ec = {};
    for (const key of EMERGENCY_CONTACT_KEYS) {
      const value = asString(ecRaw[key], key === "address" ? 300 : 120);
      if (value) ec[key] = value;
    }
    if (Object.keys(ec).length > 0) emergencyContact = ec;
  }

  if (extractedKeys.length === 0 && !emergencyContact) {
    warnings.push("Nothing could be read from this image — make sure it's a clear, well-lit photo of the passport's data page, or fill the form in by hand.");
  }
  for (const note of Array.isArray(r.notes) ? r.notes : []) {
    const n = asString(note, 300);
    if (n) warnings.push(n);
  }

  return { fields, emergencyContact, confidence, extractedKeys, warnings };
}

/** `imageBuffer`/`mimeType` come straight from the multer upload in routes/passportExtraction.js.
 * Mirrors universityExtraction.js's stub short-circuit: no fabricated data when no real provider
 * is configured, just an honest "not available" the frontend surfaces instead of auto-filling. */
async function extractPassport({ imageBuffer, mimeType }) {
  const config = getConfig();
  if (config.provider === "stub") {
    return {
      fields: {}, emergencyContact: undefined, confidence: {}, extractedKeys: [], available: false,
      warnings: ["No AI provider is configured — set one in Admin → AI Settings to enable passport auto-fill."],
    };
  }
  const provider = getProvider(config.provider);
  if (typeof provider.send !== "function") {
    return {
      fields: {}, emergencyContact: undefined, confidence: {}, extractedKeys: [], available: false,
      warnings: [`The active AI provider ("${config.provider}") doesn't support image extraction.`],
    };
  }

  const result = await callForJson({
    systemPrompt: buildSystemPrompt(),
    userPrompt: "Extract this passport's data-page fields.",
    image: { mimeType, base64: imageBuffer.toString("base64") },
    validate: (parsed) => normalizeExtraction(parsed),
    maxTokens: 1024,
    timeoutMs: 45_000,
    label: "Passport extraction",
  });
  return { ...result, available: true };
}

module.exports = { extractPassport };
