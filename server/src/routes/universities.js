// The real partner-university catalog — see the University/Course models' own comments in
// schema.prisma. Replaces universityCatalogStore.ts's old localStorage-only "created universities"
// list, which meant a university Data Management added was only ever visible in the browser that
// created it.
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { requireDataRole } = require("../middleware/access");

const zlib = require("zlib");
const { getCatalog, invalidateCatalog } = require("../catalogCache");

const router = express.Router();

function serializeCourse(c) {
  return {
    id: c.id,
    name: c.name,
    level: c.level,
    duration: c.duration,
    subject: c.subject,
    feeUSD: c.feeUSD,
    feeStatus: c.feeStatus,
    intakes: c.intakes.length ? c.intakes : undefined,
    applicationDeadline: c.applicationDeadline || undefined,
    requirements: c.requirements.length ? c.requirements : undefined,
    englishRequirements: c.englishRequirements || undefined,
    currencySymbol: c.currencySymbol || undefined,
    campusIds: c.campusIds.length ? c.campusIds : undefined,
    description: c.description || undefined,
    studyMode: c.studyMode || undefined,
    courseUrl: c.courseUrl || undefined,
    modules: c.modules.length ? c.modules : undefined,
    careers: c.careers.length ? c.careers : undefined,
    accreditations: Array.isArray(c.accreditations) && c.accreditations.length ? c.accreditations : undefined,
    standardizedTests: c.standardizedTests.length ? c.standardizedTests : undefined,
    programLevel: c.programLevel.length ? c.programLevel : undefined,
    mathsRequired: c.mathsRequired,
    isStemProgram: c.isStemProgram,
    accepts15YearsEducation: c.accepts15YearsEducation,
  };
}

function serializeUniversity(u) {
  return {
    id: u.id,
    name: u.name,
    city: u.city,
    country: u.country,
    tags: u.tags,
    subjects: u.subjects,
    intakes: u.intakes,
    worldRank: u.worldRank,
    qsRanking: u.qsRanking || undefined,
    timesHigherRanking: u.timesHigherRanking || undefined,
    employability: u.employability,
    studentCount: u.studentCount,
    description: u.description,
    highlights: u.highlights,
    courses: (u.courses || []).map(serializeCourse),
    campuses: u.campuses || undefined,
    requirements: u.requirements,
    fees: u.fees,
    minimumDepositAmount: u.minimumDepositAmount ?? undefined,
    depositMode: u.depositMode || undefined,
    paymentDeadline: u.paymentDeadline || undefined,
    depositRules: u.depositRules.length ? u.depositRules : undefined,
    admissionSteps: u.admissionSteps.length ? u.admissionSteps : undefined,
    restrictedRegions: u.restrictedRegions.length ? u.restrictedRegions : undefined,
    state: u.state || undefined,
    eslElpAvailable: u.eslElpAvailable ?? undefined,
    applicationFeeWaiverAvailable: u.applicationFeeWaiverAvailable ?? undefined,
    applicationFeeWaiverPercent: u.applicationFeeWaiverPercent ?? undefined,
    currencySymbol: u.currencySymbol,
    minIELTS: u.minIELTS,
    minGPA: u.minGPA,
    englishRequirements: u.englishRequirements || undefined,
    moiAccepted: u.moiAccepted ?? undefined,
    moiAcceptedUniversities: u.moiAcceptedUniversities.length ? u.moiAcceptedUniversities : undefined,
    internalEnglishTestOffered: u.internalEnglishTestOffered ?? undefined,
    internalEnglishTestFree: u.internalEnglishTestFree ?? undefined,
    internalEnglishTestFee: u.internalEnglishTestFee ?? undefined,
    accreditations: u.accreditations,
    scholarshipsAvailable: u.scholarshipsAvailable,
    scholarships: u.scholarships || undefined,
    openIntake: u.openIntake,
    intakeStatus: u.intakeStatus || undefined,
    intakeDates: u.intakeDates || undefined,
    website: u.website,
    tone: u.tone,
    logoUrl: u.logoUrl || undefined,
    coverPhotoUrl: u.coverPhotoUrl || undefined,
  };
}

/** `University.subjects` is the union of whatever Data Management explicitly picked for the
 * university plus every one of its courses' own subject — see universityCatalogStore.ts's old
 * mergedSubjects() for the same rule, now computed here at write-time instead of on every read. */
function mergedSubjects(manual, courses) {
  return Array.from(new Set([...(manual ?? []), ...courses.map((c) => c.subject).filter(Boolean)]));
}

// A base64 data: URL embedded directly in logoUrl/coverPhotoUrl is what made this table (and
// /api/universities' response) enormous before routes/universityImages.js existed — the frontend
// now always uploads through that endpoint first and saves the real URL it returns, so a data:
// value reaching here means an old client build or a direct API call, not a legitimate save.
function rejectDataUrlImages(body) {
  if (typeof body.logoUrl === "string" && body.logoUrl.startsWith("data:")) return "logoUrl";
  if (typeof body.coverPhotoUrl === "string" && body.coverPhotoUrl.startsWith("data:")) return "coverPhotoUrl";
  return null;
}

function universityWriteData(body, courses) {
  return {
    name: body.name,
    city: body.city,
    country: body.country,
    tags: body.tags ?? [],
    subjects: mergedSubjects(body.subjects, courses),
    intakes: body.intakes ?? [],
    worldRank: body.worldRank,
    qsRanking: body.qsRanking || null,
    timesHigherRanking: body.timesHigherRanking || null,
    employability: body.employability,
    studentCount: body.studentCount,
    description: body.description,
    highlights: body.highlights ?? [],
    campuses: body.campuses ?? undefined,
    requirements: body.requirements ?? { undergraduate: [], postgraduate: [] },
    fees: body.fees ?? [],
    minimumDepositAmount: body.minimumDepositAmount ?? null,
    depositMode: body.depositMode || null,
    paymentDeadline: body.paymentDeadline || null,
    depositRules: body.depositRules ?? [],
    admissionSteps: body.admissionSteps ?? [],
    restrictedRegions: body.restrictedRegions ?? [],
    state: body.state || null,
    eslElpAvailable: body.eslElpAvailable ?? null,
    applicationFeeWaiverAvailable: body.applicationFeeWaiverAvailable ?? null,
    applicationFeeWaiverPercent: body.applicationFeeWaiverPercent ?? null,
    currencySymbol: body.currencySymbol,
    minIELTS: body.minIELTS,
    minGPA: body.minGPA,
    englishRequirements: body.englishRequirements ?? undefined,
    moiAccepted: body.moiAccepted ?? null,
    moiAcceptedUniversities: body.moiAcceptedUniversities ?? [],
    internalEnglishTestOffered: body.internalEnglishTestOffered ?? null,
    internalEnglishTestFree: body.internalEnglishTestFree ?? null,
    internalEnglishTestFee: body.internalEnglishTestFee ?? null,
    accreditations: body.accreditations ?? [],
    scholarshipsAvailable: !!body.scholarshipsAvailable,
    scholarships: body.scholarships ?? undefined,
    openIntake: body.openIntake,
    intakeStatus: body.intakeStatus ?? undefined,
    intakeDates: body.intakeDates ?? undefined,
    website: body.website,
    tone: body.tone,
    logoUrl: body.logoUrl || null,
    coverPhotoUrl: body.coverPhotoUrl || null,
  };
}

const FEE_STATUSES = ["amount", "free", "unknown"];

function badRequest(message) {
  const err = new Error(message);
  err.status = 400;
  return err;
}

const FEE_REQUIRED = "Annual fee is required: enter an amount, or mark the course Free or Not provided.";

/** Turns whatever fee fields a client sent into the two stored columns, or throws a 400 the data manager can act on.
 *   feeStatus "free" / "unknown" → feeUSD is stored as 0 (never displayed or compared).
 *   a number above 0            → a real fee ("amount").
 *   0 with no status            → "unknown": a bare 0 has always been what unknown fees were saved as, so it is
 *                                 never silently read as free. Free exists only when explicitly chosen.
 *   "amount" with 0             → the legacy shape every existing row has; passed through untouched so re-saving an
 *                                 old course (e.g. the replace-all university save) does not change it.
 * Missing, null, non-numeric or negative amounts are rejected here instead of reaching Prisma as `undefined`/`null`. */
function resolveFee(c) {
  const status = c.feeStatus;
  if (status !== undefined && status !== null && !FEE_STATUSES.includes(status)) throw badRequest("feeStatus must be amount, free or unknown.");
  if (status === "free" || status === "unknown") return { feeUSD: 0, feeStatus: status };
  const raw = c.feeUSD;
  const amount = typeof raw === "number" ? raw : typeof raw === "string" && raw.trim() !== "" ? Number(raw) : NaN;
  if (!Number.isFinite(amount)) throw badRequest(FEE_REQUIRED);
  if (amount < 0) throw badRequest("Annual fee can't be negative.");
  if (amount > 0) return { feeUSD: amount, feeStatus: "amount" };
  return { feeUSD: 0, feeStatus: status === "amount" ? "amount" : "unknown" };
}

function courseWriteData(c) {
  return {
    name: c.name,
    level: c.level,
    duration: c.duration,
    subject: c.subject,
    ...resolveFee(c),
    intakes: c.intakes ?? [],
    applicationDeadline: c.applicationDeadline || null,
    requirements: c.requirements ?? [],
    englishRequirements: c.englishRequirements ?? undefined,
    currencySymbol: c.currencySymbol || null,
    campusIds: Array.isArray(c.campusIds) ? c.campusIds : [],
    description: c.description || null,
    studyMode: c.studyMode || null,
    courseUrl: typeof c.courseUrl === "string" && c.courseUrl.trim() ? c.courseUrl.trim() : null,
    modules: Array.isArray(c.modules) ? c.modules : [],
    careers: Array.isArray(c.careers) ? c.careers : [],
    accreditations: Array.isArray(c.accreditations) ? c.accreditations : [],
    standardizedTests: Array.isArray(c.standardizedTests) ? c.standardizedTests : [],
    programLevel: Array.isArray(c.programLevel) ? c.programLevel : [],
    mathsRequired: c.mathsRequired ?? true,
    isStemProgram: !!c.isStemProgram,
    accepts15YearsEducation: !!c.accepts15YearsEducation,
  };
}

// The catalog is big (every university with every course) — see catalogCache.js for how it is built and cached so that a
// page load neither exhausts the server's memory nor repeats the work. Same JSON as before, served gzipped.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const catalog = await getCatalog(serializeUniversity);
    res.set({ ETag: catalog.etag, "Cache-Control": "private, no-cache", Vary: "Accept-Encoding", "Content-Type": "application/json; charset=utf-8" });
    if (req.fresh) return res.status(304).end(); // the browser already holds this exact catalog
    if (req.acceptsEncodings("gzip")) {
      res.set({ "Content-Encoding": "gzip", "Content-Length": String(catalog.gzip.length) });
      return res.end(catalog.gzip);
    }
    zlib.gunzip(catalog.gzip, (err, plain) => (err ? next(err) : res.end(plain)));
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const university = await prisma.university.findUnique({ where: { id: req.params.id }, include: { courses: true } });
    if (!university) return res.status(404).json({ error: "University not found." });
    res.json(serializeUniversity(university));
  } catch (err) {
    next(err);
  }
});

// `id` is client-supplied (same scheme as before: u-custom-<timestamp>) so the caller can navigate
// straight to it without waiting on a round trip — same convention Task ids already use.
router.post("/", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const { id, courses } = req.body || {};
    if (typeof id !== "string" || !id || typeof req.body.name !== "string" || !req.body.name) return res.status(400).json({ error: "id and name are required." });
    if (courses !== undefined && !Array.isArray(courses)) return res.status(400).json({ error: "courses must be an array." });
    const dataUrlField = rejectDataUrlImages(req.body);
    if (dataUrlField) return res.status(400).json({ error: `${dataUrlField} must be a real URL from /api/universities/logo or /cover, not an embedded data: URL.` });
    const courseInputs = (courses ?? []).map((c, i) => ({ id: c.id || `crs-custom-${Date.now().toString(36)}-${i}`, ...courseWriteData(c) }));

    const university = await prisma.university.create({
      data: {
        id,
        ...universityWriteData(req.body, courseInputs),
        courses: { create: courseInputs },
      },
      include: { courses: true },
    });
    invalidateCatalog(); // the cached catalog is now out of date
    res.status(201).json(serializeUniversity(university));
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "A university with that id already exists." });
    next(err);
  }
});

// A courses-array patch fully replaces the course list (matches the old store's behavior, where
// addCourse/updateCourse/removeCourse each re-saved the whole array) — everything else here is a
// plain field patch merged onto the existing row.
router.patch("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const existing = await prisma.university.findUnique({ where: { id: req.params.id }, include: { courses: true } });
    if (!existing) return res.status(404).json({ error: "University not found." });

    if (req.body.courses !== undefined && !Array.isArray(req.body.courses)) return res.status(400).json({ error: "courses must be an array." });
    const dataUrlField = rejectDataUrlImages(req.body);
    if (dataUrlField) return res.status(400).json({ error: `${dataUrlField} must be a real URL from /api/universities/logo or /cover, not an embedded data: URL.` });
    const merged = { ...serializeUniversity(existing), ...req.body };
    const courseInputs = (req.body.courses ?? existing.courses).map((c, i) => ({
      id: c.id || `crs-custom-${Date.now().toString(36)}-${i}`,
      ...courseWriteData(c),
    }));

    const university = await prisma.$transaction(async (tx) => {
      if (req.body.courses) {
        await tx.course.deleteMany({ where: { universityId: req.params.id } });
      }
      return tx.university.update({
        where: { id: req.params.id },
        data: {
          ...universityWriteData(merged, courseInputs),
          ...(req.body.courses ? { courses: { create: courseInputs } } : {}),
        },
        include: { courses: true },
      });
    });
    invalidateCatalog(); // the cached catalog is now out of date
    res.json(serializeUniversity(university));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    await prisma.university.delete({ where: { id: req.params.id } });
    invalidateCatalog(); // the cached catalog is now out of date
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "University not found." });
    next(err);
  }
});

router.post("/:id/courses", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const university = await prisma.university.findUnique({ where: { id: req.params.id }, include: { courses: true } });
    if (!university) return res.status(404).json({ error: "University not found." });
    const id = req.body.id || `crs-custom-${Date.now().toString(36)}`;
    const course = await prisma.course.create({ data: { id, universityId: req.params.id, ...courseWriteData(req.body) } });
    await prisma.university.update({
      where: { id: req.params.id },
      data: { subjects: mergedSubjects(university.subjects, [...university.courses, course]) },
    });
    invalidateCatalog(); // the cached catalog is now out of date
    res.status(201).json(serializeCourse(course));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/courses/:courseId", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    // A real merge: only the keys the caller sent change. courseWriteData() maps an absent key to
    // null/[] (right for create), which here would silently blank every field a partial patch —
    // updateCourse(id, Partial<Course>) on the frontend — happened to leave out.
    const existing = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!existing) return res.status(404).json({ error: "Course not found." });
    const body = req.body || {};
    const sentFee = "feeUSD" in body || "feeStatus" in body;
    // Fee fields are resolved against the stored row, and only when the caller actually sent one of them: a patch that
    // doesn't mention the fee must never touch it (and must not be rejected for "missing" a fee it never owned).
    let feeData = {};
    if (sentFee) {
      // Typing a new amount (no explicit status) replaces whatever status the row had; a bare 0 only keeps an
      // explicit Free — it never turns an amount or an unknown fee into Free.
      const status = "feeStatus" in body ? body.feeStatus : Number(body.feeUSD) === 0 && existing.feeStatus === "free" ? "free" : undefined;
      const merged = { feeUSD: "feeUSD" in body ? body.feeUSD : existing.feeUSD, feeStatus: status };
      // An old client re-saving a legacy "0" it was shown: leave the stored fee exactly as it is.
      const untouchedLegacyZero = !("feeStatus" in body) && Number(body.feeUSD) === 0 && existing.feeUSD === 0 && existing.feeStatus !== "free";
      if (!untouchedLegacyZero) feeData = resolveFee(merged);
    }
    const { feeUSD: _f, feeStatus: _s, ...rest } = courseWriteData({ ...body, feeUSD: existing.feeUSD, feeStatus: existing.feeStatus });
    const data = { ...Object.fromEntries(Object.entries(rest).filter(([key]) => key in body)), ...feeData };
    const course = await prisma.course.update({ where: { id: req.params.courseId }, data });
    const university = await prisma.university.findUnique({ where: { id: req.params.id }, include: { courses: true } });
    if (university) {
      await prisma.university.update({ where: { id: req.params.id }, data: { subjects: mergedSubjects(university.subjects, university.courses) } });
    }
    invalidateCatalog(); // the cached catalog is now out of date
    res.json(serializeCourse(course));
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Course not found." });
    next(err);
  }
});

router.delete("/:id/courses/:courseId", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    await prisma.course.delete({ where: { id: req.params.courseId } });
    invalidateCatalog(); // the cached catalog is now out of date
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Course not found." });
    next(err);
  }
});

// The course write/read helpers are shared with routes/courseImports.js so an approved import
// is created exactly the way a hand-entered course is. Attaching them to the router keeps
// `app.use("/api/universities", require(...))` working unchanged.
module.exports = Object.assign(router, { courseWriteData, serializeCourse, mergedSubjects, universityWriteData, serializeUniversity });
