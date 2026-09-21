// Data Management's AI university-import queue — the university-level twin of courseImports.js:
// paste university page URLs in bulk, let the model draft each university's profile
// (universityExtraction.js), then review and approve from the university form. `approve` is the
// only path into the catalog and uses the same universityWriteData() as a hand-entered university.
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { getConfig } = require("../config");
const { universityWriteData, serializeUniversity } = require("./universities");
const { assertFetchableUrl, obtainPageText, assertUsefulText, fetchPage, htmlToText, detectBlockedPage, FetchError, MAX_PAGE_CHARS } = require("../courseExtraction");
const { extractUniversity } = require("../universityExtraction");

const router = express.Router();

const MAX_URLS_PER_BATCH = 50;
const STALE_RUNNING_MS = 2 * 60 * 1000;

function requireDataRole(req, res, next) {
  if (!["data", "admin"].includes(req.authUser?.role)) return res.status(403).json({ error: "Only Data Management can import universities." });
  if (!getConfig().courseImportEnabled) return res.status(403).json({ error: "AI import is turned off by the admin." });
  next();
}

function serializeImportItem(item) {
  return {
    id: item.id,
    sourceUrl: item.sourceUrl,
    extraUrls: item.extraUrls?.length ? item.extraUrls : undefined,
    status: item.status,
    countryHint: item.countryHint || undefined,
    textSource: item.textSource || undefined,
    hasPageText: !!item.pageText,
    pageTextPreview: item.pageText ? item.pageText.slice(0, 300) : undefined,
    extracted: item.extracted || undefined,
    error: item.error || undefined,
    approvedUniversityId: item.approvedUniversityId || undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

router.get("/", requireAuth, requireDataRole, async (_req, res, next) => {
  try {
    const items = await prisma.universityImportItem.findMany({ orderBy: { createdAt: "asc" } });
    res.json(items.map(serializeImportItem));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const { urls, country } = req.body || {};
    if (!Array.isArray(urls)) return res.status(400).json({ error: "urls[] is required." });
    const countryHint = typeof country === "string" && country.trim() ? country.trim() : null;

    const open = await prisma.universityImportItem.findMany({ where: { status: { in: ["queued", "running", "needs_review"] } }, select: { sourceUrl: true } });
    const alreadyOpen = new Set(open.map((i) => i.sourceUrl));
    // One line = one university. A line may list several of that university's pages (fees,
    // entry requirements, scholarships…) separated by "|" or spaces; they're read together.
    const skipped = [];
    const accepted = [];
    const seen = new Set();
    for (const rawLine of urls.map((u) => String(u || "").trim()).filter(Boolean)) {
      if (accepted.length >= MAX_URLS_PER_BATCH) { skipped.push({ url: rawLine, reason: `Only ${MAX_URLS_PER_BATCH} universities per batch — add the rest afterwards.` }); continue; }
      const parts = rawLine.split(/[|\s]+/).map((u) => u.trim()).filter(Boolean);
      const normalizedParts = [];
      let bad = null;
      for (const part of parts) {
        try { normalizedParts.push(await assertFetchableUrl(part)); } catch (err) { bad = `${part}: ${err.message}`; break; }
      }
      if (bad) { skipped.push({ url: rawLine, reason: bad }); continue; }
      const [sourceUrl, ...extraUrls] = [...new Set(normalizedParts)];
      if (seen.has(sourceUrl)) { skipped.push({ url: rawLine, reason: "Listed twice." }); continue; }
      seen.add(sourceUrl);
      if (alreadyOpen.has(sourceUrl)) { skipped.push({ url: rawLine, reason: "Already in the queue." }); continue; }
      accepted.push({ sourceUrl, extraUrls: extraUrls.slice(0, 5) });
    }
    const created = [];
    for (const { sourceUrl, extraUrls } of accepted) {
      created.push(await prisma.universityImportItem.create({ data: { sourceUrl, extraUrls, countryHint, createdBy: String(req.authUser.sub || req.authUser.roleUserId || "") } }));
    }
    res.status(201).json({ created: created.map(serializeImportItem), skipped });
  } catch (err) {
    next(err);
  }
});

/** Body may carry `pageText` / `refetch` (as for courses) plus the client's `countries` and
 * `subjects` name lists — those live in the frontend's registries, not in Postgres, and the
 * model must copy names from them verbatim. */
router.post("/:itemId/run", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const item = await prisma.universityImportItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: "Import row not found." });
    if (item.status === "approved") return res.status(409).json({ error: "This row was already approved." });
    if (item.status === "running" && Date.now() - item.updatedAt.getTime() < STALE_RUNNING_MS) {
      return res.status(409).json({ error: "This row is already being processed." });
    }
    await prisma.universityImportItem.update({ where: { id: item.id }, data: { status: "running", error: null } });

    const body = req.body || {};
    let outcome;
    try {
      const first = await obtainPageText({ item, body });
      assertUsefulText(first.text);
      const { title, textSource } = first;
      let { text, truncated } = first;
      const extraWarnings = [];

      // Further pages of the same university (only when the text was fetched or is being
      // refetched — pasted text is taken as the whole picture). Each extra page gets its own
      // budget; one that can't be read is reported but doesn't sink the row.
      if (textSource !== "paste" && Array.isArray(item.extraUrls) && item.extraUrls.length && (!item.pageText || body.refetch === true)) {
        for (const extraUrl of item.extraUrls) {
          try {
            const page = await fetchPage(await assertFetchableUrl(extraUrl));
            const cleaned = htmlToText(page.html);
            if (detectBlockedPage(cleaned.text)) throw new FetchError("blocked", "bot protection");
            text += `\n\n===== Additional page: ${extraUrl} =====\n${cleaned.text.slice(0, MAX_PAGE_CHARS)}`;
            truncated = truncated || cleaned.truncated;
          } catch (err) {
            extraWarnings.push(`Couldn't read the extra page ${extraUrl} (${err.message}) — its facts are missing from this draft.`);
          }
        }
      }
      let allowedSubjects = Array.isArray(body.subjects) ? body.subjects.map((s) => String(s)).filter(Boolean) : [];
      if (!allowedSubjects.length) allowedSubjects = (await prisma.subject.findMany({ select: { name: true } })).map((s) => s.name);
      let allowedCountries = Array.isArray(body.countries) ? body.countries.map((c) => String(c)).filter(Boolean) : [];
      if (!allowedCountries.length) allowedCountries = (await prisma.country.findMany({ select: { name: true } })).map((c) => c.name);
      const existingUniversities = await prisma.university.findMany({ select: { id: true, name: true } });

      const extracted = await extractUniversity({
        sourceUrl: item.sourceUrl, pageText: text, pageTitle: title, textSource,
        countryHint: item.countryHint || "", allowedSubjects, allowedCountries, existingUniversities, truncated, extraWarnings,
      });
      outcome = { status: "needs_review", pageText: text, textSource, extracted, error: null };
    } catch (err) {
      const message = err instanceof FetchError ? err.message : err?.message || "Extraction failed.";
      console.error(`[university-import] ${item.sourceUrl}:`, message);
      outcome = { status: "failed", error: message };
    }
    const updated = await prisma.universityImportItem.update({ where: { id: item.id }, data: outcome });
    res.json(serializeImportItem(updated));
  } catch (err) {
    prisma.universityImportItem
      .update({ where: { id: req.params.itemId }, data: { status: "failed", error: err?.message || "Unexpected error." } })
      .catch(() => {});
    next(err);
  }
});

router.patch("/:itemId", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const item = await prisma.universityImportItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: "Import row not found." });
    if (!["needs_review", "failed"].includes(item.status)) return res.status(409).json({ error: "Only rows awaiting review can be edited." });
    const university = req.body?.university && typeof req.body.university === "object" ? req.body.university : {};
    const extracted = { ...(item.extracted || {}), university: { ...((item.extracted || {}).university || {}), ...university } };
    const updated = await prisma.universityImportItem.update({ where: { id: item.id }, data: { extracted } });
    res.json(serializeImportItem(updated));
  } catch (err) {
    next(err);
  }
});

/** The only way an import becomes a University — same validation as the form, same write path
 * as POST /api/universities, in one transaction with the row flip. */
router.post("/:itemId/approve", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const item = await prisma.universityImportItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: "Import row not found." });
    if (item.status !== "needs_review") return res.status(409).json({ error: "Only rows awaiting review can be approved." });

    const draft = { ...((item.extracted || {}).university || {}), ...((req.body && req.body.university) || {}) };
    for (const field of ["name", "city", "country"]) {
      if (!String(draft[field] || "").trim()) return res.status(400).json({ error: `${field[0].toUpperCase()}${field.slice(1)} is required.` });
    }
    if (!draft.website) draft.website = (() => { try { return new URL(item.sourceUrl).origin; } catch { return ""; } })();
    if (!draft.currencySymbol) draft.currencySymbol = "$";
    if (!draft.openIntake) draft.openIntake = Array.isArray(draft.intakes) && draft.intakes[0] ? `${draft.intakes[0]} ${new Date().getFullYear() + 1}` : "TBC";
    const clash = await prisma.university.findFirst({ where: { name: { equals: String(draft.name).trim(), mode: "insensitive" } } });
    if (clash) return res.status(409).json({ error: `"${clash.name}" is already in the catalog.` });

    const id = (req.body && req.body.id) || `u-import-${Date.now().toString(36)}-${item.id.slice(-4)}`;
    const courseInputs = [];
    const { university, updatedItem } = await prisma.$transaction(async (tx) => {
      const created = await tx.university.create({
        data: { id, ...universityWriteData({ ...draft, minIELTS: Number(draft.minIELTS) || 0, minGPA: Number(draft.minGPA) || 0, tone: draft.tone || "violet", worldRank: draft.worldRank || "#100", employability: draft.employability || "85%", studentCount: draft.studentCount || "", description: draft.description || "" }, courseInputs) },
        include: { courses: true },
      });
      const flipped = await tx.universityImportItem.update({
        where: { id: item.id },
        data: { status: "approved", approvedUniversityId: id, extracted: { ...(item.extracted || {}), university: draft } },
      });
      return { university: created, updatedItem: flipped };
    });
    res.status(201).json({ item: serializeImportItem(updatedItem), university: serializeUniversity(university) });
  } catch (err) {
    next(err);
  }
});

router.post("/:itemId/discard", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const item = await prisma.universityImportItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: "Import row not found." });
    if (item.status === "approved") return res.status(409).json({ error: "An approved row can't be discarded — delete the university instead." });
    const updated = await prisma.universityImportItem.update({ where: { id: item.id }, data: { status: "discarded" } });
    res.json(serializeImportItem(updated));
  } catch (err) {
    next(err);
  }
});

router.delete("/:itemId", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    await prisma.universityImportItem.delete({ where: { id: req.params.itemId } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Import row not found." });
    next(err);
  }
});

module.exports = router;
