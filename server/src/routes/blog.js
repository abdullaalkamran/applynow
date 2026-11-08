// News & Updates management — Data Management (and admin) write posts here; the public landing page reads the
// published ones through routes/public.js (no login). Cover images reuse the existing /api/universities/cover upload.
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { invalidateSeoCache, siteUrl } = require("../seo");
const { makeSlug, isValidSlug, uniqueSlug, detectFaq } = require("../blogSeo");
const { pingIndexNow } = require("../indexNow");
const { requireDataRole } = require("../middleware/access");

const router = express.Router();

const MAX_TITLE = 160;
const MAX_EXCERPT = 300;
const MAX_CONTENT = 60_000;
const STATUSES = ["draft", "published"];
const MAX_SEO_TITLE = 70;
const MAX_QUICK = 600;

function serialize(p) {
  return {
    id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt || "", content: p.content,
    coverImageUrl: p.coverImageUrl || undefined, status: p.status, authorName: p.authorName, viewCount: p.viewCount,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : undefined,
    seoTitle: p.seoTitle || "", quickAnswer: p.quickAnswer || "", coverAlt: p.coverAlt || "", category: p.category || "",
    countries: Array.isArray(p.countries) ? p.countries : [], sources: Array.isArray(p.sources) ? p.sources : [],
    faqCount: Array.isArray(p.faqJson) ? p.faqJson.length : 0,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  };
}


// A cover is either one of our own uploads or an https image — never a javascript:/data: URL.
function validCover(value) {
  if (value === undefined || value === null || value === "") return true;
  return typeof value === "string" && value.length < 2000 && (value.startsWith("/uploads/") || /^https:\/\//i.test(value));
}

/** Validates the editable fields; returns { data } or { error }. `partial` allows PATCH to send only some of them. */
function parseBody(body, partial) {
  const out = {};
  const b = body || {};
  if (!partial || b.title !== undefined) {
    if (typeof b.title !== "string" || !b.title.trim()) return { error: "A title is required." };
    if (b.title.trim().length > MAX_TITLE) return { error: `The title is too long (max ${MAX_TITLE} characters).` };
    out.title = b.title.trim();
  }
  if (!partial || b.content !== undefined) {
    if (typeof b.content !== "string" || !b.content.trim()) return { error: "The post needs some content." };
    if (b.content.length > MAX_CONTENT) return { error: "The post is too long." };
    out.content = b.content;
  }
  if (b.excerpt !== undefined) {
    if (typeof b.excerpt !== "string" || b.excerpt.length > MAX_EXCERPT) return { error: `The summary is too long (max ${MAX_EXCERPT} characters).` };
    out.excerpt = b.excerpt.trim() || null;
  }
  if (b.coverImageUrl !== undefined) {
    if (!validCover(b.coverImageUrl)) return { error: "The cover image must be an uploaded image or an https link." };
    out.coverImageUrl = b.coverImageUrl || null;
  }
  if (b.seoTitle !== undefined) {
    if (typeof b.seoTitle !== "string" || b.seoTitle.length > MAX_SEO_TITLE) return { error: `The search title is too long (max ${MAX_SEO_TITLE} characters).` };
    out.seoTitle = b.seoTitle.trim() || null;
  }
  if (b.quickAnswer !== undefined) {
    if (typeof b.quickAnswer !== "string" || b.quickAnswer.length > MAX_QUICK) return { error: `The quick answer is too long (max ${MAX_QUICK} characters).` };
    out.quickAnswer = b.quickAnswer.trim() || null;
  }
  if (b.coverAlt !== undefined) {
    if (typeof b.coverAlt !== "string" || b.coverAlt.length > 190) return { error: "The cover image description is too long." };
    out.coverAlt = b.coverAlt.trim() || null;
  }
  if (b.category !== undefined) {
    if (typeof b.category !== "string" || b.category.length > 60) return { error: "The category is too long." };
    out.category = b.category.trim() || null;
  }
  if (b.countries !== undefined) {
    if (!Array.isArray(b.countries) || b.countries.length > 20 || b.countries.some((c) => typeof c !== "string" || c.length > 80)) return { error: "The countries list isn't valid." };
    out.countries = [...new Set(b.countries.map((c) => c.trim()).filter(Boolean))];
  }
  if (b.sources !== undefined) {
    if (!Array.isArray(b.sources) || b.sources.length > 15) return { error: "Too many sources (max 15)." };
    const sources = [];
    for (const src of b.sources) {
      const name = typeof src?.name === "string" ? src.name.trim() : "";
      const url = typeof src?.url === "string" ? src.url.trim() : "";
      if (!name && !url) continue; // an empty row
      if (!name || name.length > 160) return { error: "Each source needs a name (max 160 characters)." };
      if (!/^https:\/\/[^\s<>"]{3,1000}$/i.test(url)) return { error: `The link for "${name}" must start with https://` };
      sources.push({ name, url });
    }
    out.sources = sources;
  }
  if (b.slug !== undefined) {
    if (typeof b.slug !== "string") return { error: "The address isn't valid." };
    const slug = b.slug.trim().toLowerCase();
    if (slug && !isValidSlug(slug)) return { error: "The address can only use lowercase letters, numbers and hyphens (max 80 characters)." };
    out.slug = slug || undefined;
  }
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return { error: 'Status must be "draft" or "published".' };
    out.status = b.status;
  }
  return { data: out };
}

/** Every address in use — live slugs and the earlier ones kept for redirects — optionally leaving one post out (the one being edited). */
async function takenSlugs(exceptId) {
  const rows = await prisma.blogPost.findMany({ select: { id: true, slug: true, oldSlugs: true }, take: 5000 });
  const taken = new Set();
  for (const r of rows) {
    if (r.id === exceptId) continue;
    taken.add(r.slug);
    if (Array.isArray(r.oldSlugs)) r.oldSlugs.forEach((x) => taken.add(x));
  }
  return taken;
}

/** After a post goes live, changes or is removed: tell IndexNow engines about it, its old addresses and the lists. Never blocks the save. */
function announce(post, earlierSlugs) {
  try {
    pingIndexNow([`/news/${post.slug}`, ...earlierSlugs.map((x) => `/news/${x}`), "/news", "/rss.xml"], siteUrl());
  } catch { /* a failed ping must never fail a save */ }
}

router.get("/", requireAuth, requireDataRole, async (_req, res, next) => {
  try {
    const posts = await prisma.blogPost.findMany({ orderBy: { createdAt: "desc" }, take: 500 });
    res.json(posts.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const post = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!post) return res.status(404).json({ error: "Post not found." });
    res.json(serialize(post));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const { data, error } = parseBody(req.body, false);
    if (error) return res.status(400).json({ error });
    const status = data.status || "draft";
    const taken = await takenSlugs();
    const wanted = data.slug || makeSlug(data.title);
    if (data.slug && taken.has(wanted)) return res.status(400).json({ error: "That address is already used by another post." });
    const post = await prisma.blogPost.create({
      data: {
        ...data, status, slug: uniqueSlug(wanted, (x) => taken.has(x)), faqJson: detectFaq(data.content),
        authorName: req.authUser.name || "UnifinderAi", authorId: req.authUser.roleUserId,
        publishedAt: status === "published" ? new Date() : null,
      },
    });
    invalidateSeoCache();
    announce(post, []);
    res.status(201).json(serialize(post));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const { data, error } = parseBody(req.body, true);
    if (error) return res.status(400).json({ error });
    const existing = await prisma.blogPost.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Post not found." });
    // First time it goes live, stamp the publish date; unpublishing keeps it so re-publishing doesn't reorder the news.
    if (data.status === "published" && !existing.publishedAt) data.publishedAt = new Date();
    if (data.content !== undefined) data.faqJson = detectFaq(data.content);
    // A new address keeps the old one as a redirect, so links already out there (search results, shares) still work.
    const earlier = [];
    if (data.slug && data.slug !== existing.slug) {
      const taken = await takenSlugs(existing.id);
      if (taken.has(data.slug)) return res.status(400).json({ error: "That address is already used by another post." });
      earlier.push(existing.slug);
      data.oldSlugs = [...new Set([...(Array.isArray(existing.oldSlugs) ? existing.oldSlugs : []), existing.slug])].filter((x) => x !== data.slug);
    } else delete data.slug;
    const post = await prisma.blogPost.update({ where: { id: req.params.id }, data });
    invalidateSeoCache();
    if (existing.status === "published" || post.status === "published") announce(post, earlier);
    res.json(serialize(post));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const gone = await prisma.blogPost.findUnique({ where: { id: req.params.id }, select: { slug: true, status: true } });
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    invalidateSeoCache();
    if (gone?.status === "published") announce({ slug: gone.slug }, []);
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
