// The real partner-university catalog — see the University/Course models' own comments in
// schema.prisma. Replaces universityCatalogStore.ts's old localStorage-only "created universities"
// list, which meant a university Data Management added was only ever visible in the browser that
// created it.
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

function serializeCourse(c) {
  return {
    id: c.id,
    name: c.name,
    level: c.level,
    duration: c.duration,
    subject: c.subject,
    feeUSD: c.feeUSD,
    intakes: c.intakes.length ? c.intakes : undefined,
    applicationDeadline: c.applicationDeadline || undefined,
    requirements: c.requirements.length ? c.requirements : undefined,
    englishRequirements: c.englishRequirements || undefined,
    currencySymbol: c.currencySymbol || undefined,
    campusIds: c.campusIds.length ? c.campusIds : undefined,
    description: c.description || undefined,
    studyMode: c.studyMode || undefined,
    modules: c.modules.length ? c.modules : undefined,
    careers: c.careers.length ? c.careers : undefined,
    accreditations: Array.isArray(c.accreditations) && c.accreditations.length ? c.accreditations : undefined,
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

function courseWriteData(c) {
  return {
    name: c.name,
    level: c.level,
    duration: c.duration,
    subject: c.subject,
    feeUSD: c.feeUSD,
    intakes: c.intakes ?? [],
    applicationDeadline: c.applicationDeadline || null,
    requirements: c.requirements ?? [],
    englishRequirements: c.englishRequirements ?? undefined,
    currencySymbol: c.currencySymbol || null,
    campusIds: Array.isArray(c.campusIds) ? c.campusIds : [],
    description: c.description || null,
    studyMode: c.studyMode || null,
    modules: Array.isArray(c.modules) ? c.modules : [],
    careers: Array.isArray(c.careers) ? c.careers : [],
    accreditations: Array.isArray(c.accreditations) ? c.accreditations : [],
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const universities = await prisma.university.findMany({ include: { courses: true }, orderBy: { createdAt: "asc" } });
    res.json(universities.map(serializeUniversity));
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
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { id, courses } = req.body || {};
    if (!id || !req.body.name) return res.status(400).json({ error: "id and name are required." });
    const courseInputs = (courses ?? []).map((c, i) => ({ id: c.id || `crs-custom-${Date.now().toString(36)}-${i}`, ...courseWriteData(c) }));

    const university = await prisma.university.create({
      data: {
        id,
        ...universityWriteData(req.body, courseInputs),
        courses: { create: courseInputs },
      },
      include: { courses: true },
    });
    res.status(201).json(serializeUniversity(university));
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "A university with that id already exists." });
    next(err);
  }
});

// A courses-array patch fully replaces the course list (matches the old store's behavior, where
// addCourse/updateCourse/removeCourse each re-saved the whole array) — everything else here is a
// plain field patch merged onto the existing row.
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.university.findUnique({ where: { id: req.params.id }, include: { courses: true } });
    if (!existing) return res.status(404).json({ error: "University not found." });

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
    res.json(serializeUniversity(university));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.university.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "University not found." });
    next(err);
  }
});

router.post("/:id/courses", requireAuth, async (req, res, next) => {
  try {
    const university = await prisma.university.findUnique({ where: { id: req.params.id }, include: { courses: true } });
    if (!university) return res.status(404).json({ error: "University not found." });
    const id = req.body.id || `crs-custom-${Date.now().toString(36)}`;
    const course = await prisma.course.create({ data: { id, universityId: req.params.id, ...courseWriteData(req.body) } });
    await prisma.university.update({
      where: { id: req.params.id },
      data: { subjects: mergedSubjects(university.subjects, [...university.courses, course]) },
    });
    res.status(201).json(serializeCourse(course));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/courses/:courseId", requireAuth, async (req, res, next) => {
  try {
    // A real merge: only the keys the caller sent change. courseWriteData() maps an absent key to
    // null/[] (right for create), which here would silently blank every field a partial patch —
    // updateCourse(id, Partial<Course>) on the frontend — happened to leave out.
    const existing = await prisma.course.findUnique({ where: { id: req.params.courseId } });
    if (!existing) return res.status(404).json({ error: "Course not found." });
    const full = courseWriteData(req.body || {});
    const data = Object.fromEntries(Object.entries(full).filter(([key]) => key in (req.body || {})));
    const course = await prisma.course.update({ where: { id: req.params.courseId }, data });
    const university = await prisma.university.findUnique({ where: { id: req.params.id }, include: { courses: true } });
    if (university) {
      await prisma.university.update({ where: { id: req.params.id }, data: { subjects: mergedSubjects(university.subjects, university.courses) } });
    }
    res.json(serializeCourse(course));
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Course not found." });
    next(err);
  }
});

router.delete("/:id/courses/:courseId", requireAuth, async (req, res, next) => {
  try {
    await prisma.course.delete({ where: { id: req.params.courseId } });
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
