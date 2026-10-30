// Read-only data for the logged-out marketing landing page. Everything else under /api needs a login;
// this is the one deliberately public surface, so it only ever returns a tiny, non-sensitive summary
// (country name, tagline, how many partner universities it has, a photo) — never student, staff or
// application data, and never the full Country Guide / university records.
const express = require("express");
const prisma = require("../prismaClient");

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
  const universities = withLogo
    .map((u) => ({ id: u.id, name: u.name, logoUrl: photoRef("universityLogo", u.id, u.logoUrl) }))
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
router.get("/news", async (_req, res, next) => {
  try {
    const posts = await prisma.blogPost.findMany({
      where: { status: "published" },
      orderBy: { publishedAt: "desc" },
      take: 60,
      select: { id: true, slug: true, title: true, excerpt: true, coverImageUrl: true, authorName: true, publishedAt: true },
    });
    res.set("Cache-Control", "public, max-age=60");
    res.json(posts.map((p) => ({ ...p, excerpt: p.excerpt || "", coverImageUrl: p.coverImageUrl || undefined, publishedAt: p.publishedAt?.toISOString() })));
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
      coverImageUrl: post.coverImageUrl || undefined, authorName: post.authorName, publishedAt: post.publishedAt?.toISOString(),
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
