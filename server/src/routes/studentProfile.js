// Server-backed student profile sections — see the StudentProfileSection model's comment in
// schema.prisma. Reads/writes follow the same record-level access rules as every student-owned
// resource: a student only their own, an agent only their referrals, internal staff everyone.
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { canAccessStudent, studentWhere } = require("../middleware/access");

const router = express.Router();

const STEP_KEYS = ["personal-information", "academic-details", "english-proficiency", "work-experience", "preferences"];
const SECTIONS = new Set([
  "personal", "english", "english-status", "work", "work-status", "preferences", "academic",
  ...STEP_KEYS.map((k) => `step:${k}`),
]);

function pack(rows) {
  const byStudent = {};
  for (const r of rows) (byStudent[r.studentId] ??= {})[r.section] = r.data;
  return byStudent;
}

// Everything the caller may see, keyed by student then section — one request warms the client cache.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const students = await prisma.student.findMany({ where: studentWhere(req.authUser), select: { id: true } });
    const rows = await prisma.studentProfileSection.findMany({ where: { studentId: { in: students.map((s) => s.id) } } });
    res.json(pack(rows));
  } catch (err) {
    next(err);
  }
});

router.get("/:studentId", requireAuth, async (req, res, next) => {
  try {
    if (!(await canAccessStudent(req.authUser, req.params.studentId))) return res.status(404).json({ error: "Student not found." });
    const rows = await prisma.studentProfileSection.findMany({ where: { studentId: req.params.studentId } });
    res.json(pack(rows)[req.params.studentId] ?? {});
  } catch (err) {
    next(err);
  }
});

router.put("/:studentId/:section", requireAuth, async (req, res, next) => {
  try {
    const { studentId, section } = req.params;
    if (!SECTIONS.has(section)) return res.status(400).json({ error: "Unknown profile section." });
    if (!(await canAccessStudent(req.authUser, studentId))) return res.status(404).json({ error: "Student not found." });
    const data = req.body?.data;
    if (data === undefined || data === null) return res.status(400).json({ error: "data is required." });
    if (JSON.stringify(data).length > 200000) return res.status(413).json({ error: "Too large." });
    const row = await prisma.studentProfileSection.upsert({
      where: { studentId_section: { studentId, section } },
      create: { studentId, section, data },
      update: { data },
    });
    res.json({ studentId: row.studentId, section: row.section });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
