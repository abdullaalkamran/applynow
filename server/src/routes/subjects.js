// Data Management's real, editable field-of-study catalog — name plus a "why this subject"
// description, curriculum modules and recognized accrediting bodies. See the Subject model's own
// comment in schema.prisma for how `modules` feeds back into subjectCurriculum.ts.
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { requireDataRole } = require("../middleware/access");

const router = express.Router();

function serialize(s) {
  return {
    id: s.id,
    name: s.name,
    custom: s.custom,
    description: s.description || undefined,
    modules: s.modules,
    careers: s.careers,
    accreditations: s.accreditations,
    disciplineArea: s.disciplineArea || undefined,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const rows = await prisma.subject.findMany({ orderBy: { name: "asc" } });
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const { name, description, modules, careers, accreditations, disciplineArea } = req.body || {};
    if (typeof name !== "string" || !name.trim()) {
      return res.status(400).json({ error: "name is required." });
    }
    const row = await prisma.subject.create({
      data: {
        name: name.trim(),
        custom: true,
        description: description || undefined,
        modules: Array.isArray(modules) ? modules : [],
        careers: Array.isArray(careers) ? careers : [],
        accreditations: Array.isArray(accreditations) ? accreditations : [],
        disciplineArea: disciplineArea || undefined,
      },
    });
    res.status(201).json(serialize(row));
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: `"${req.body.name}" already exists.` });
    next(err);
  }
});

router.patch("/:id", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    const { name, description, modules, careers, accreditations, disciplineArea } = req.body || {};
    const row = await prisma.subject.update({
      where: { id: req.params.id },
      data: {
        name: typeof name === "string" && name.trim() ? name.trim() : undefined,
        description: description !== undefined ? description || null : undefined,
        modules: Array.isArray(modules) ? modules : undefined,
        careers: Array.isArray(careers) ? careers : undefined,
        accreditations: Array.isArray(accreditations) ? accreditations : undefined,
        disciplineArea: disciplineArea !== undefined ? disciplineArea || null : undefined,
      },
    });
    res.json(serialize(row));
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Subject not found." });
    next(err);
  }
});

module.exports = router;
