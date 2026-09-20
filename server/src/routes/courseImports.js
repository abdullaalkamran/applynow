// Data Management's AI course-import queue: paste course-page URLs in bulk, have the model draft
// each one (courseExtraction.js), review and approve from the course form. The AI never writes
// a Course itself — `approve` is the only path into the catalog, and it goes through the same
// courseWriteData() as a hand-entered course.
//
// Shape of the work: one synchronous request per URL (`POST /:id/run`), driven by a client-side
// loop, with every row persisted in CourseImportItem. That keeps each request bounded (fetch
// 15s + model 60s) for Passenger-style hosting, and a page reload just re-lists the queue.
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { getConfig } = require("../config");
const { courseWriteData, serializeCourse, mergedSubjects } = require("./universities");
const { assertFetchableUrl, obtainPageText, assertUsefulText, extractCourse, FetchError } = require("../courseExtraction");

const router = express.Router();

const MAX_URLS_PER_BATCH = 50;
const STALE_RUNNING_MS = 2 * 60 * 1000;

/** Only Data Management (and admins) may import, and only while the admin switch is on. */
function requireDataRole(req, res, next) {
  if (!["data", "admin"].includes(req.authUser?.role)) return res.status(403).json({ error: "Only Data Management can import courses." });
  if (!getConfig().courseImportEnabled) return res.status(403).json({ error: "AI import is turned off by the admin." });
  next();
}

function providerReady(config) {
  switch (config.provider) {
    case "anthropic": return !!config.anthropic.apiKey;
    case "openai": return !!config.openai.apiKey;
    case "gemini": return !!config.gemini.apiKey;
    case "ollama": return true;
    default: return false;
  }
}

/** What a row looks like to the client — the full page text stays server-side (it's up to 40k
 * characters per row); a short preview is enough for the queue to show what was read. */
function serializeImportItem(item) {
  return {
    id: item.id,
    universityId: item.universityId,
    sourceUrl: item.sourceUrl,
    status: item.status,
    textSource: item.textSource || undefined,
    hasPageText: !!item.pageText,
    pageTextPreview: item.pageText ? item.pageText.slice(0, 300) : undefined,
    extracted: item.extracted || undefined,
    error: item.error || undefined,
    approvedCourseId: item.approvedCourseId || undefined,
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString(),
  };
}

// Every signed-in user may ask whether the feature is on — the Courses tab uses it to decide
// whether to show the button at all, and the import page to explain when it's off.
router.get("/config", requireAuth, (_req, res) => {
  const config = getConfig();
  res.json({ enabled: config.courseImportEnabled, provider: config.provider, providerReady: providerReady(config) });
});

router.get("/", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const universityId = String(req.query.universityId || "");
    if (!universityId) return res.status(400).json({ error: "universityId is required." });
    const items = await prisma.courseImportItem.findMany({ where: { universityId }, orderBy: { createdAt: "asc" } });
    res.json(items.map(serializeImportItem));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const { universityId, urls } = req.body || {};
    if (!universityId || !Array.isArray(urls)) return res.status(400).json({ error: "universityId and urls[] are required." });
    const university = await prisma.university.findUnique({ where: { id: universityId } });
    if (!university) return res.status(404).json({ error: "University not found." });

    const open = await prisma.courseImportItem.findMany({
      where: { universityId, status: { in: ["queued", "running", "needs_review"] } },
      select: { sourceUrl: true },
    });
    const alreadyOpen = new Set(open.map((i) => i.sourceUrl));

    const skipped = [];
    const accepted = [];
    const seen = new Set();
    for (const raw of urls.map((u) => String(u || "").trim()).filter(Boolean)) {
      if (accepted.length >= MAX_URLS_PER_BATCH) {
        skipped.push({ url: raw, reason: `Only ${MAX_URLS_PER_BATCH} URLs per batch — add the rest afterwards.` });
        continue;
      }
      let normalized;
      try {
        normalized = assertFetchableUrl(raw);
      } catch (err) {
        skipped.push({ url: raw, reason: err.message });
        continue;
      }
      if (seen.has(normalized)) {
        skipped.push({ url: raw, reason: "Listed twice." });
        continue;
      }
      seen.add(normalized);
      if (alreadyOpen.has(normalized)) {
        skipped.push({ url: raw, reason: "Already in this university's queue." });
        continue;
      }
      accepted.push(normalized);
    }

    const created = [];
    for (const sourceUrl of accepted) {
      created.push(await prisma.courseImportItem.create({ data: { universityId, sourceUrl, createdBy: String(req.authUser.sub || req.authUser.roleUserId || "") } }));
    }
    res.status(201).json({ created: created.map(serializeImportItem), skipped });
  } catch (err) {
    next(err);
  }
});

/** Fetch (or take pasted text) + extract, for one row. The row always ends in `needs_review` or
 * `failed` — never left `running` — and the response is 200 with the row either way, because a
 * page that couldn't be read is a normal outcome the queue shows, not a request error. */
router.post("/:itemId/run", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const item = await prisma.courseImportItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: "Import row not found." });
    if (item.status === "approved") return res.status(409).json({ error: "This row was already approved." });
    if (item.status === "running" && Date.now() - item.updatedAt.getTime() < STALE_RUNNING_MS) {
      return res.status(409).json({ error: "This row is already being processed." });
    }
    const university = await prisma.university.findUnique({ where: { id: item.universityId }, include: { courses: true } });
    if (!university) return res.status(404).json({ error: "University not found." });

    await prisma.courseImportItem.update({ where: { id: item.id }, data: { status: "running", error: null } });

    const body = req.body || {};
    const extraWarnings = [];
    let outcome;
    try {
      // 1. Text — pasted by staff, reused from the last run, or fetched fresh (shared with the
      //    university import route).
      const { text, title, truncated, textSource } = await obtainPageText({ item, body });
      assertUsefulText(text);

      // 2. Which subjects the model may pick from — the university's own list, like the course form.
      let allowedSubjects = Array.isArray(university.subjects) ? university.subjects : [];
      if (!allowedSubjects.length) {
        allowedSubjects = (await prisma.subject.findMany({ select: { name: true } })).map((s) => s.name);
        extraWarnings.push(`${university.name} has no subjects selected yet, so the whole subject catalogue was offered — add its subjects on Edit Details for tighter matching.`);
      }

      // 3. Extract.
      const extracted = await extractCourse({
        university, sourceUrl: item.sourceUrl, pageText: text, pageTitle: title, textSource,
        existingCourses: university.courses, allowedSubjects, truncated, extraWarnings,
      });
      outcome = { status: "needs_review", pageText: text, textSource, extracted, error: null };
    } catch (err) {
      const message = err instanceof FetchError ? err.message : err?.message || "Extraction failed.";
      console.error(`[course-import] ${item.sourceUrl}:`, message);
      outcome = { status: "failed", error: message, ...(body.pageText ? { pageText: undefined } : {}) };
    }

    const updated = await prisma.courseImportItem.update({ where: { id: item.id }, data: outcome });
    res.json(serializeImportItem(updated));
  } catch (err) {
    // Something outside the guarded block failed — make sure the row isn't stuck as `running`.
    prisma.courseImportItem
      .update({ where: { id: req.params.itemId }, data: { status: "failed", error: err?.message || "Unexpected error." } })
      .catch(() => {});
    next(err);
  }
});

/** Staff edits to the draft without approving yet. */
router.patch("/:itemId", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const item = await prisma.courseImportItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: "Import row not found." });
    if (!["needs_review", "failed"].includes(item.status)) return res.status(409).json({ error: "Only rows awaiting review can be edited." });
    const course = req.body?.course && typeof req.body.course === "object" ? req.body.course : {};
    const extracted = { ...(item.extracted || {}), course: { ...((item.extracted || {}).course || {}), ...course } };
    const updated = await prisma.courseImportItem.update({ where: { id: item.id }, data: { extracted } });
    res.json(serializeImportItem(updated));
  } catch (err) {
    next(err);
  }
});

/** The only way an import becomes a Course. Validates the same way the form does, writes the
 * course through courseWriteData() and recomputes the university's subjects, all in one
 * transaction with the row flip to `approved`. */
router.post("/:itemId/approve", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const item = await prisma.courseImportItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: "Import row not found." });
    if (item.status !== "needs_review") return res.status(409).json({ error: "Only rows awaiting review can be approved." });
    const university = await prisma.university.findUnique({ where: { id: item.universityId }, include: { courses: true } });
    if (!university) return res.status(404).json({ error: "University not found." });

    const draft = { ...((item.extracted || {}).course || {}), ...((req.body && req.body.course) || {}) };
    const name = String(draft.name || "").trim();
    const duration = String(draft.duration || "").trim();
    const subject = String(draft.subject || "").trim();
    const feeUSD = Number(draft.feeUSD);
    if (!name) return res.status(400).json({ error: "Course name is required." });
    if (!duration) return res.status(400).json({ error: "Duration is required." });
    if (!subject) return res.status(400).json({ error: "Pick a subject before approving." });
    const allowedSubjects = university.subjects.length ? university.subjects : (await prisma.subject.findMany({ select: { name: true } })).map((s) => s.name);
    if (!allowedSubjects.includes(subject)) return res.status(400).json({ error: `"${subject}" isn't one of ${university.name}'s subjects.` });
    if (!Number.isFinite(feeUSD) || feeUSD < 0) return res.status(400).json({ error: "Annual fee must be a number." });

    const id = (req.body && req.body.id) || `crs-import-${Date.now().toString(36)}-${item.id.slice(-4)}`;
    const courseData = courseWriteData({ ...draft, name, duration, subject, feeUSD });
    const { course, updatedItem } = await prisma.$transaction(async (tx) => {
      const created = await tx.course.create({ data: { id, universityId: university.id, ...courseData } });
      await tx.university.update({
        where: { id: university.id },
        data: { subjects: mergedSubjects(university.subjects, [...university.courses, created]) },
      });
      const flipped = await tx.courseImportItem.update({
        where: { id: item.id },
        data: { status: "approved", approvedCourseId: id, extracted: { ...(item.extracted || {}), course: { ...draft, name, duration, subject, feeUSD } } },
      });
      return { course: created, updatedItem: flipped };
    });
    res.status(201).json({ item: serializeImportItem(updatedItem), course: serializeCourse(course) });
  } catch (err) {
    next(err);
  }
});

router.post("/:itemId/discard", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const item = await prisma.courseImportItem.findUnique({ where: { id: req.params.itemId } });
    if (!item) return res.status(404).json({ error: "Import row not found." });
    if (item.status === "approved") return res.status(409).json({ error: "An approved row can't be discarded — delete the course instead." });
    const updated = await prisma.courseImportItem.update({ where: { id: item.id }, data: { status: "discarded" } });
    res.json(serializeImportItem(updated));
  } catch (err) {
    next(err);
  }
});

router.delete("/:itemId", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    await prisma.courseImportItem.delete({ where: { id: req.params.itemId } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Import row not found." });
    next(err);
  }
});

module.exports = router;
