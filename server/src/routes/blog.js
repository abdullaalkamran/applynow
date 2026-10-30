// News & Updates management — Data Management (and admin) write posts here; the public landing page reads the
// published ones through routes/public.js (no login). Cover images reuse the existing /api/universities/cover upload.
const express = require("express");
const crypto = require("crypto");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { invalidateSeoCache } = require("../seo");
const { requireDataRole } = require("../middleware/access");

const router = express.Router();

const MAX_TITLE = 160;
const MAX_EXCERPT = 300;
const MAX_CONTENT = 60_000;
const STATUSES = ["draft", "published"];

function serialize(p) {
  return {
    id: p.id, slug: p.slug, title: p.title, excerpt: p.excerpt || "", content: p.content,
    coverImageUrl: p.coverImageUrl || undefined, status: p.status, authorName: p.authorName,
    publishedAt: p.publishedAt ? p.publishedAt.toISOString() : undefined,
    createdAt: p.createdAt.toISOString(), updatedAt: p.updatedAt.toISOString(),
  };
}

function slugify(title) {
  const base = String(title).toLowerCase().normalize("NFKD").replace(/[^\w\s-]/g, "").trim().replace(/[\s_]+/g, "-").replace(/-+/g, "-").slice(0, 70) || "post";
  return `${base}-${crypto.randomBytes(3).toString("hex")}`;
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
  if (b.status !== undefined) {
    if (!STATUSES.includes(b.status)) return { error: 'Status must be "draft" or "published".' };
    out.status = b.status;
  }
  return { data: out };
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
    const post = await prisma.blogPost.create({
      data: {
        ...data, status, slug: slugify(data.title),
        authorName: req.authUser.name || "UnifinderAi", authorId: req.authUser.roleUserId,
        publishedAt: status === "published" ? new Date() : null,
      },
    });
    invalidateSeoCache();
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
    const post = await prisma.blogPost.update({ where: { id: req.params.id }, data });
    invalidateSeoCache();
    res.json(serialize(post));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    await prisma.blogPost.delete({ where: { id: req.params.id } });
    invalidateSeoCache();
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
