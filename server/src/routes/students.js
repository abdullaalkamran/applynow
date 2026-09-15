const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const AVATAR_COLORS = ["bg-sky-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-indigo-500", "bg-teal-500"];

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { agentId, counsellorId } = req.query;
    const where = {};
    if (agentId) where.agentId = String(agentId);
    if (counsellorId) where.counsellorId = String(counsellorId);
    const students = await prisma.student.findMany({ where, orderBy: { createdAt: "asc" } });
    res.json(students);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) return res.status(404).json({ error: "Student not found." });
    res.json(student);
  } catch (err) {
    next(err);
  }
});

// Ownership (agentId/counsellorId) is derived from the caller's own identity, not the request
// body — an agent can only create students under themselves, same for a counsellor, so one role
// can never assign another's ownership by supplying a different id in the payload.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { name, email, country } = req.body || {};
    if (!name || !email || !country) {
      return res.status(400).json({ error: "name, email and country are required." });
    }

    const count = await prisma.student.count();
    const student = await prisma.student.create({
      data: {
        id: `st-${Date.now().toString(36)}`,
        name,
        email,
        country,
        agentId: req.authUser.role === "agent" ? req.authUser.roleUserId : undefined,
        counsellorId: req.authUser.role === "counsellor" ? req.authUser.roleUserId : undefined,
        avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length],
        riskFlag: "none",
      },
    });
    res.status(201).json(student);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const { name, email, phone, country, riskFlag, counsellorId, agentId } = req.body || {};
    const student = await prisma.student.update({
      where: { id: req.params.id },
      data: { name, email, phone, country, riskFlag, counsellorId, agentId },
    });
    res.json(student);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
