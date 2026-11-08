// Public country pages (/countries and /countries/<name>). Which countries exist comes from Country Management, so a country Data
// Management adds gets a page, a place in the sitemap and a link from /countries on its own — nothing here lists them by hand.
// A country's universities are those whose `country` matches its name (the same match the student pages use).
const prisma = require("./prismaClient");
const courseSearch = require("./courseSearch");
const { slugify, slugClaimer } = require("./slugs");

const TTL_MS = 60 * 1000;
const norm = (s) => String(s ?? "").trim().toLowerCase();
const fullName = (c) => (c === "UK" ? "United Kingdom" : c);
const rankNumber = (r) => parseInt(String(r ?? "").replace(/\D/g, ""), 10) || Infinity;

let cache = { at: 0, value: null };

/** Every country with its slug and counts. Cached for a minute; falls back to counts of 0 if the search index isn't available. */
async function listCountries() {
  if (cache.value && Date.now() - cache.at < TTL_MS) return cache.value;
  const rows = await prisma.country.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, updatedAt: true } });
  let idx = null;
  try { idx = await courseSearch.getIndex(); } catch { /* counts stay 0 */ }
  const byCountry = new Map();
  for (const u of idx?.universities ?? []) {
    const k = norm(fullName(u.country));
    if (!byCountry.has(k)) byCountry.set(k, []);
    byCountry.get(k).push(u);
  }
  const claim = slugClaimer();
  const value = rows.map((r) => {
    const unis = byCountry.get(norm(r.name)) ?? [];
    return {
      id: r.id, name: r.name, slug: claim(slugify(r.name, "country")), updatedAt: r.updatedAt, universities: unis,
      // The exact `country` strings the search filter must be given to match this country's universities.
      destinations: [...new Set(unis.map((u) => u.country))],
      universityCount: unis.length,
      courseCount: unis.reduce((n, u) => n + u.courses.length, 0),
    };
  });
  cache = { at: Date.now(), value };
  return value;
}

function invalidateCountryCache() { cache = { at: 0, value: null }; }

/** A country by its readable name, its id or its exact name (so old links and typed names still work). */
async function resolveCountry(param) {
  const all = await listCountries();
  const p = norm(decodeURIComponent(String(param ?? "")));
  return all.find((c) => c.slug === p) || all.find((c) => norm(c.id) === p) || all.find((c) => norm(c.name) === p) || null;
}

/** What the page shows beyond the country's own record: totals, study areas with counts, top universities by world rank. */
function summarize(country) {
  const subjects = new Map();
  for (const u of country.universities) for (const c of u.courses) if (c.subject) subjects.set(c.subject, (subjects.get(c.subject) ?? 0) + 1);
  const ranked = [...country.universities].sort((a, b) => rankNumber(a.worldRank) - rankNumber(b.worldRank) || a.name.localeCompare(b.name));
  return {
    universityCount: country.universityCount,
    courseCount: country.courseCount,
    destinations: country.destinations,
    subjectCounts: [...subjects.entries()].map(([subject, count]) => ({ subject, count })).sort((a, b) => b.count - a.count || a.subject.localeCompare(b.subject)),
    topUniversities: ranked.slice(0, 5).map((u) => ({ id: u.id, slug: u.slug, name: u.name, worldRank: u.worldRank })),
    universities: ranked.map((u) => ({ id: u.id, slug: u.slug, name: u.name, city: u.city, worldRank: u.worldRank, courseCount: u.courses.length })),
  };
}

module.exports = { listCountries, resolveCountry, summarize, invalidateCountryCache };
