// The editable About page. Data Management edits it (routes/about.js); the public page, its SEO markup (seo.js) and the sitemap
// read it. Stored as one JSON row in SitePage; with no row (or a damaged one) the built-in default text is used, so the page
// is never empty and a bad save can't take /about down.
const prisma = require("./prismaClient");
const DEFAULTS = require("../../src/data/aboutDefault.json");

const KEY = "about";
const LIMITS = { metaTitle: 120, metaDescription: 320, heading: 120, subheading: 200, body: 60000, faqQ: 300, faqA: 2000, faqs: 40, field: 300, url: 500 };
const COMPANY_FIELDS = ["legalName", "foundedYear", "founders", "address", "email", "phone"];
const SOCIAL_FIELDS = ["instagram", "facebook", "linkedin", "youtube"];

const str = (v, max) => (typeof v === "string" ? v.trim().slice(0, max) : "");

/** Cleans stored or submitted content into the full shape, filling anything missing from the default. `strict` rejects bad input. */
function normalize(input, { strict = false } = {}) {
  const src = input && typeof input === "object" ? input : {};
  const fail = (message) => { if (strict) throw Object.assign(new Error(message), { status: 400 }); };
  const out = {};
  for (const k of ["metaTitle", "metaDescription", "heading", "subheading"]) {
    if (typeof src[k] === "string" && src[k].length > LIMITS[k]) fail(`"${k}" is too long (max ${LIMITS[k]} characters).`);
    out[k] = typeof src[k] === "string" ? str(src[k], LIMITS[k]) : DEFAULTS[k];
  }
  if (!out.heading) fail("The page needs a heading.");
  if (typeof src.body === "string") {
    if (src.body.length > LIMITS.body) fail("The page text is too long.");
    out.body = src.body.slice(0, LIMITS.body);
  } else out.body = DEFAULTS.body;
  if (Array.isArray(src.faqs)) {
    if (src.faqs.length > LIMITS.faqs) fail(`Too many questions (max ${LIMITS.faqs}).`);
    out.faqs = src.faqs.map((f) => ({ q: str(f?.q, LIMITS.faqQ), a: str(f?.a, LIMITS.faqA) })).filter((f) => f.q && f.a);
  } else out.faqs = DEFAULTS.faqs;
  out.company = {};
  for (const k of COMPANY_FIELDS) out.company[k] = str(src.company?.[k], LIMITS.field);
  out.social = {};
  for (const k of SOCIAL_FIELDS) {
    const url = str(src.social?.[k], LIMITS.url);
    // Only real web links: this ends up in an href and in structured data.
    if (url && !/^https:\/\/[^\s<>"]+$/i.test(url)) { fail(`The ${k} link must start with https://`); out.social[k] = ""; } else out.social[k] = url;
  }
  if (strict && out.company.email && !/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(out.company.email)) fail("The contact email doesn't look right.");
  return out;
}

/** The page content plus whether it's still the untouched default. Never throws on bad stored data. */
async function loadAbout() {
  let row = null;
  try { row = await prisma.sitePage.findUnique({ where: { key: KEY } }); } catch { /* table not migrated yet: use the default */ }
  if (!row) return { content: normalize(DEFAULTS), isDefault: true, updatedAt: null, updatedBy: null };
  let parsed = null;
  try { parsed = JSON.parse(row.data); } catch { /* damaged row: fall back to the default */ }
  return { content: normalize(parsed || DEFAULTS), isDefault: !parsed, updatedAt: row.updatedAt, updatedBy: row.updatedBy };
}

async function saveAbout(input, updatedBy) {
  const content = normalize(input, { strict: true });
  const data = JSON.stringify(content);
  await prisma.sitePage.upsert({ where: { key: KEY }, create: { key: KEY, data, updatedBy }, update: { data, updatedBy } });
  return content;
}

async function resetAbout() {
  await prisma.sitePage.deleteMany({ where: { key: KEY } });
}

module.exports = { loadAbout, saveAbout, resetAbout, normalize, DEFAULTS };
