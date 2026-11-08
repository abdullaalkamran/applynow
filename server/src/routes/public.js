// Read-only data for logged-out visitors. Everything else under /api needs a login; this is the one deliberately public
// surface. It carries the marketing landing page's summaries, the public News & Updates posts, and the university catalogue
// a prospective student browses before signing up (list/search, filter options, one university with its course list).
// It never returns student, staff, commission or application data.
const express = require("express");
const prisma = require("../prismaClient");
const { search, facetsFor, getIndex, peekIndex, resolveUniversity } = require("../courseSearch");
const { serializeUniversity } = require("./universities");
const { serializeCountry } = require("./countries");
const { serialize: serializeSubject } = require("./subjects");
const { loadAbout } = require("../aboutPage");
const { listCountries, resolveCountry, summarize } = require("../countryPages");

const router = express.Router();

const DATA_URL = /^data:(image\/(?:png|jpe?g|webp|gif|avif));base64,([A-Za-z0-9+/=\s]+)$/i;
const CACHE_MS = 5 * 60 * 1000;
const MAX_COUNTRIES = 8;
const MAX_LOGOS = 40;

// Photos are stored either as a real file URL (/uploads/…) or, for older records, an inline base64
// data: URL. A data URL must never be embedded in the JSON (a single photo can be megabytes), so those
// are served through /photo/:kind/:id below as a normal cacheable image instead.
function photoRef(kind, id, value) {
  if (typeof value !== "string" || !value) return undefined;
  if (value.startsWith("data:")) return DATA_URL.test(value) ? `/api/public/photo/${kind}/${encodeURIComponent(id)}` : undefined;
  if (value.startsWith("/uploads/") || /^https?:\/\//i.test(value)) return value;
  return undefined;
}

const norm = (s) => String(s || "").trim().toLowerCase();

let cache = { at: 0, data: null };

async function buildLandingPayload() {
  const [countries, groups] = await Promise.all([
    prisma.country.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true, tagline: true, photoUrl: true } }),
    prisma.university.groupBy({ by: ["country"], _count: { _all: true } }),
  ]);

  const countByCountry = new Map();
  let universityTotal = 0;
  for (const g of groups) {
    countByCountry.set(norm(g.country), (countByCountry.get(norm(g.country)) || 0) + g._count._all);
    universityTotal += g._count._all;
  }

  const ranked = countries
    .map((c, index) => ({ c, index, universityCount: countByCountry.get(norm(c.name)) || 0 }))
    // busiest destinations first; ties keep the order the admins created them in
    .sort((a, b) => b.universityCount - a.universityCount || a.index - b.index)
    .slice(0, MAX_COUNTRIES);

  const out = [];
  for (const { c, universityCount } of ranked) {
    let photoUrl = photoRef("country", c.id, c.photoUrl);
    if (!photoUrl && universityCount > 0) {
      // No country photo yet: borrow a real campus cover from one of its universities.
      const uni = await prisma.university.findFirst({
        where: { country: c.name, coverPhotoUrl: { not: null } },
        select: { id: true, coverPhotoUrl: true },
      });
      if (uni) photoUrl = photoRef("university", uni.id, uni.coverPhotoUrl);
    }
    out.push({ id: c.id, name: c.name, tagline: c.tagline || undefined, universityCount, photoUrl });
  }

  // Partner-university logos for the landing page's scrolling strip — only universities that actually have
  // one, name + logo and nothing else.
  const withLogo = await prisma.university.findMany({
    where: { logoUrl: { not: null } },
    orderBy: { createdAt: "asc" },
    take: MAX_LOGOS,
    select: { id: true, name: true, logoUrl: true },
  });
  // Each logo links to its university's page; the readable address is used when the search index is already built (the landing
  // page never waits for it — without a slug the link uses the id and is redirected to the readable address).
  const index = peekIndex();
  const universities = withLogo
    .map((u) => ({ id: u.id, slug: index?.byId.get(u.id)?.slug, name: u.name, logoUrl: photoRef("universityLogo", u.id, u.logoUrl) }))
    .filter((u) => u.logoUrl);

  return { stats: { countries: countries.length, universities: universityTotal }, countries: out, universities };
}

router.get("/landing", async (_req, res, next) => {
  try {
    if (!cache.data || Date.now() - cache.at > CACHE_MS) cache = { at: Date.now(), data: await buildLandingPayload() };
    res.set("Cache-Control", "public, max-age=300");
    res.json(cache.data);
  } catch (err) {
    next(err);
  }
});

// News & Updates for the logged-out landing page: only posts an editor has published, never drafts. List rows carry
// no body (just what a card needs); the full text comes from /news/:slug.
// The About page's text (edited by Data Management): public, cached briefly by the browser like the rest.
router.get("/about", async (_req, res, next) => {
  try {
    const { content } = await loadAbout();
    res.set("Cache-Control", "public, max-age=60").json(content);
  } catch (err) {
    next(err);
  }
});

router.get("/news", async (_req, res, next) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 60,
      select: { id: true, slug: true, title: true, excerpt: true, coverImageUrl: true, publishedAt: true },
    });
    res.set("Cache-Control", "public, max-age=60");
    res.json(posts.map((p) => ({ ...p, excerpt: p.excerpt || "", coverImageUrl: p.coverImageUrl || undefined, publishedAt: p.publishedAt?.toISOString() })));
  } catch (err) {
    next(err);
  }
});

// Counts a visit to a post page — every visit, so the number is page views (never shown to visitors, only to Data
// Management). The same address re-opening the same post within a few seconds is ignored, which only absorbs the page
// firing twice for one visit (dev double-render, a fast double reload), not genuine repeat visits.
const recentReads = new Map(); // `${ip}|${slug}` -> time of the last counted visit
const READ_DEBOUNCE_MS = 5000;
router.post("/news/:slug/read", async (req, res, next) => {
  try {
    const key = `${req.ip}|${req.params.slug}`;
    const now = Date.now();
    if (recentReads.size > 5000) for (const [k, t] of recentReads) if (now - t > READ_DEBOUNCE_MS) recentReads.delete(k);
    if (now - (recentReads.get(key) || 0) < READ_DEBOUNCE_MS) return res.json({ counted: false });
    const { count } = await prisma.blogPost.updateMany({ where: { slug: req.params.slug, status: "published" }, data: { viewCount: { increment: 1 } } });
    if (count === 0) return res.status(404).json({ error: "Post not found." });
    recentReads.set(key, now);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

router.get("/news/:slug", async (req, res, next) => {
  try {
    const post = await prisma.blogPost.findFirst({ where: { slug: req.params.slug, status: "published" } });
    if (!post) return res.status(404).json({ error: "Post not found." });
    res.set("Cache-Control", "public, max-age=60");
    res.json({
      id: post.id, slug: post.slug, title: post.title, excerpt: post.excerpt || "", content: post.content,
      coverImageUrl: post.coverImageUrl || undefined, publishedAt: post.publishedAt?.toISOString(),
    });
  } catch (err) {
    next(err);
  }
});

// ---- University catalogue (public browsing) ------------------------------------------------------------------------------
// The logged-out Explore pages are the SAME pages students see (same components), so these endpoints return the same data the
// signed-in endpoints do: the search, the filter options, one university with all its courses, and the country guides and subject
// list those pages read. Only student/staff/commission/application data stays behind login.
const PUBLIC_MAX_LIMIT = 50;

// Same body as POST /api/courses/search (see routes/courses.js), page size capped.
router.post("/courses/search", async (req, res, next) => {
  try {
    const body = req.body || {};
    res.json(await search({ ...body, shortlistKeys: undefined, limit: Math.min(Number(body.limit) || 20, PUBLIC_MAX_LIMIT) }));
  } catch (err) {
    next(err);
  }
});

router.post("/courses/facets", async (req, res, next) => {
  try {
    res.json(await facetsFor(req.body || {}));
  } catch (err) {
    next(err);
  }
});

// One university with every course — exactly what GET /api/universities/:id gives a signed-in student. Logo / cover photos that are
// stored inline (data: URLs) are served as normal images through /photo/... instead of being embedded in the JSON.
router.get("/universities/:id", async (req, res, next) => {
  try {
    // The address part is the readable slug ("bpp-university") or, for old links, the id.
    let id = req.params.id;
    let hit = null;
    try { hit = resolveUniversity(await getIndex(), req.params.id); } catch { /* index unavailable: treat the part as an id */ }
    if (hit) id = hit.id;
    const row = await prisma.university.findUnique({ where: { id }, include: { courses: true } });
    if (!row) return res.status(404).json({ error: "University not found." });
    const u = serializeUniversity(row);
    res.set("Cache-Control", "public, max-age=60");
    res.json({
      ...u,
      slug: hit?.slug,
      // each course carries its readable slug so the page can link to it
      courses: u.courses.map((c) => ({ ...c, slug: hit?.courseById.get(c.id)?.slug })),
      logoUrl: photoRef("universityLogo", u.id, row.logoUrl),
      coverPhotoUrl: photoRef("university", u.id, row.coverPhotoUrl),
    });
  } catch (err) {
    next(err);
  }
});

// Country pages: every country Data Management has added (readable name, counts) and one country with its guide and summary.
// The country guide is the same record signed-in users get from /api/countries, minus inline sample files and inline images.
function publicCountry(c) {
  const out = serializeCountry(c);
  return {
    ...out,
    logoUrl: out.logoUrl && !out.logoUrl.startsWith("data:") ? out.logoUrl : undefined,
    photoUrl: photoRef("country", c.id, c.photoUrl),
    requiredDocuments: out.requiredDocuments?.map(({ sampleFileDataUrl: _drop, ...doc }) => doc),
  };
}

router.get("/countries", async (_req, res, next) => {
  try {
    const all = await listCountries();
    const rows = await prisma.country.findMany({ select: { id: true, photoUrl: true, tagline: true } });
    const byId = new Map(rows.map((r) => [r.id, r]));
    res.set("Cache-Control", "public, max-age=300").json(
      all.map((c) => ({ id: c.id, slug: c.slug, name: c.name, tagline: byId.get(c.id)?.tagline || undefined, photoUrl: photoRef("country", c.id, byId.get(c.id)?.photoUrl), universityCount: c.universityCount, courseCount: c.courseCount }))
        .sort((a, b) => b.universityCount - a.universityCount || a.name.localeCompare(b.name)),
    );
  } catch (err) {
    next(err);
  }
});

router.get("/countries/:slug", async (req, res, next) => {
  try {
    const hit = await resolveCountry(req.params.slug);
    if (!hit) return res.status(404).json({ error: "Country not found." });
    const row = await prisma.country.findUnique({ where: { id: hit.id } });
    if (!row) return res.status(404).json({ error: "Country not found." });
    res.set("Cache-Control", "public, max-age=300").json({ slug: hit.slug, country: publicCountry(row), ...summarize(hit) });
  } catch (err) {
    next(err);
  }
});

// The country guides and the subject list (curriculum, careers) the university pages draw on — the same records signed-in users
// get from /api/countries and /api/subjects, minus the inline sample-document files and inline images (served via /photo/...).
router.get("/reference", async (_req, res, next) => {
  try {
    const [countries, subjects] = await Promise.all([
      prisma.country.findMany({ orderBy: { createdAt: "asc" } }),
      prisma.subject.findMany({ orderBy: { name: "asc" } }),
    ]);
    res.set("Cache-Control", "public, max-age=300");
    res.json({
      countries: countries.map((c) => {
        const out = serializeCountry(c);
        return {
          ...out,
          logoUrl: out.logoUrl && !out.logoUrl.startsWith("data:") ? out.logoUrl : undefined,
          photoUrl: photoRef("country", c.id, c.photoUrl),
          requiredDocuments: out.requiredDocuments?.map(({ sampleFileDataUrl: _drop, ...doc }) => doc),
        };
      }),
      subjects: subjects.map(serializeSubject),
    });
  } catch (err) {
    next(err);
  }
});

const PHOTO_SOURCES = {
  country: (id) => prisma.country.findUnique({ where: { id }, select: { photoUrl: true } }).then((r) => r?.photoUrl),
  university: (id) => prisma.university.findUnique({ where: { id }, select: { coverPhotoUrl: true } }).then((r) => r?.coverPhotoUrl),
  universityLogo: (id) => prisma.university.findUnique({ where: { id }, select: { logoUrl: true } }).then((r) => r?.logoUrl),
};

router.get("/photo/:kind/:id", async (req, res, next) => {
  try {
    const source = PHOTO_SOURCES[req.params.kind];
    if (!source) return res.status(404).end();
    const value = await source(req.params.id);
    const match = typeof value === "string" ? DATA_URL.exec(value) : null;
    if (!match) return res.status(404).end();
    res.set("Content-Type", match[1]);
    res.set("Cache-Control", "public, max-age=3600");
    res.send(Buffer.from(match[2].replace(/\s/g, ""), "base64"));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
