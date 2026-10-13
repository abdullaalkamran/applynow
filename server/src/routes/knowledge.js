// Counsellor/agent training knowledge base. Data Management (and admin) author documents; every
// non-student role's assistant reads them through GET /search (the `search_knowledge` tool).
// Plain keyword scoring over chunks — MySQL has no vector type, and a few hundred short training
// notes don't need one.
const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse/lib/pdf-parse.js");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { requireDataRole, requireStaff } = require("../middleware/access");

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 1 } });

const MAX_CONTENT_CHARS = 200000;
const CHUNK_CHARS = 1200;

function summary(d) {
  return { id: d.id, title: d.title, source: d.source || undefined, category: d.category || undefined, length: d.content.length, updatedAt: d.updatedAt.toISOString() };
}

function words(text) {
  return (text.toLowerCase().match(/[a-z0-9]{3,}/g) || []);
}

// Paragraph-aligned chunks of roughly CHUNK_CHARS so a hit returns a readable passage, not a fragment.
function chunk(content) {
  const out = [];
  let cur = "";
  for (const para of content.split(/\n\s*\n/)) {
    if (cur && cur.length + para.length > CHUNK_CHARS) { out.push(cur.trim()); cur = ""; }
    cur += (cur ? "\n\n" : "") + para;
    while (cur.length > CHUNK_CHARS * 2) { out.push(cur.slice(0, CHUNK_CHARS * 2)); cur = cur.slice(CHUNK_CHARS * 2); }
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

// Pulls the text out of an uploaded PDF so the author can review/trim it before saving. Nothing is
// stored here — the file is read from memory and discarded. Registered before "/:id".
router.post("/extract-pdf", requireAuth, requireDataRole, (req, res, next) => {
  upload.single("file")(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.code === "LIMIT_FILE_SIZE" ? "PDF is too large (max 15 MB)." : "Upload failed." });
    try {
      const file = req.file;
      if (!file || file.buffer.slice(0, 5).toString() !== "%PDF-") return res.status(400).json({ error: "Please upload a PDF file." });
      const parsed = await pdfParse(file.buffer);
      const text = (parsed.text || "").replace(/\r/g, "").replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
      if (!text) return res.status(422).json({ error: "No readable text found — this looks like a scanned PDF. Paste the text instead." });
      res.json({ text: text.slice(0, MAX_CONTENT_CHARS), truncated: text.length > MAX_CONTENT_CHARS, pages: parsed.numpages });
    } catch (err) {
      res.status(422).json({ error: "Couldn't read that PDF." });
    }
  });
});

// Registered before "/:id" so "search" isn't read as an id.
router.get("/search", requireAuth, requireStaff, async (req, res, next) => {
  try {
    const terms = Array.from(new Set(words(String(req.query.q || ""))));
    if (terms.length === 0) return res.status(400).json({ error: "q is required." });
    const docs = await prisma.knowledgeDoc.findMany();
    const hits = [];
    for (const d of docs) {
      const titleWords = new Set(words(d.title));
      for (const text of chunk(d.content)) {
        const lower = text.toLowerCase();
        let score = 0;
        for (const t of terms) {
          if (lower.includes(t)) score += 1 + Math.min(3, lower.split(t).length - 2) * 0.25;
          if (titleWords.has(t)) score += 0.5;
        }
        if (score > 0) hits.push({ score, title: d.title, source: d.source || undefined, category: d.category || undefined, text });
      }
    }
    hits.sort((a, b) => b.score - a.score);
    res.json({ totalMatches: hits.length, results: hits.slice(0, 5).map(({ score, ...h }) => h) });
  } catch (err) {
    next(err);
  }
});

router.get("/", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const rows = await prisma.knowledgeDoc.findMany({ orderBy: { updatedAt: "desc" } });
    res.json(rows.map(summary));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const row = await prisma.knowledgeDoc.findUnique({ where: { id: req.params.id } });
    if (!row) return res.status(404).json({ error: "Not found." });
    res.json({ ...summary(row), content: row.content });
  } catch (err) {
    next(err);
  }
});

function parseBody(body) {
  const { title, source, category, content } = body || {};
  if (typeof title !== "string" || !title.trim()) return { error: "title is required." };
  if (typeof content !== "string" || !content.trim()) return { error: "content is required." };
  if (content.length > MAX_CONTENT_CHARS) return { error: `content is too long (max ${MAX_CONTENT_CHARS} characters) — split it into several documents.` };
  return { data: { title: title.trim().slice(0, 191), source: typeof source === "string" && source.trim() ? source.trim() : null, category: typeof category === "string" && category.trim() ? category.trim().slice(0, 191) : null, content: content.trim() } };
}

router.post("/", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const { data, error } = parseBody(req.body);
    if (error) return res.status(400).json({ error });
    const row = await prisma.knowledgeDoc.create({ data });
    res.status(201).json(summary(row));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const { data, error } = parseBody(req.body);
    if (error) return res.status(400).json({ error });
    const row = await prisma.knowledgeDoc.update({ where: { id: req.params.id }, data });
    res.json(summary(row));
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Not found." });
    next(err);
  }
});

router.delete("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    await prisma.knowledgeDoc.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Not found." });
    next(err);
  }
});

module.exports = router;
