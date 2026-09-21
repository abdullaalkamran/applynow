const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { applicationWhere, accessibleApplication } = require("../middleware/access");

const router = express.Router();

function serialize(s) {
  return {
    id: s.id,
    applicationId: s.applicationId,
    title: s.title,
    createdAt: s.createdAt.toISOString().slice(0, 10),
    done: s.done,
    completedAt: s.completedAt ? s.completedAt.toISOString().slice(0, 10) : undefined,
    dueDate: s.dueDate ? s.dueDate.toISOString().slice(0, 10) : undefined,
  };
}

const parseDate = (v) => {
  if (v === undefined) return undefined;
  if (!v) return null;
  if (typeof v !== "string") return NaN;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? NaN : d;
};

/** The step if it exists and belongs to an application the caller may access, else null. */
async function accessibleStep(authUser, id) {
  const step = await prisma.applicationNextStep.findUnique({ where: { id } });
  if (!step) return null;
  return (await accessibleApplication(authUser, step.applicationId)) ? step : null;
}

// Scoped through the application: a student sees their own applications' steps, an agent their
// students', internal staff any (see middleware/access.js).
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { applicationId } = req.query;
    const scope = applicationWhere(req.authUser);
    const where = Object.keys(scope).length ? { application: scope } : {};
    if (applicationId) where.applicationId = String(applicationId);
    const steps = await prisma.applicationNextStep.findMany({ where, orderBy: { createdAt: "asc" } });
    res.json(steps.map(serialize));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { applicationId, title, dueDate } = req.body || {};
    if (!applicationId || typeof title !== "string" || !title.trim()) {
      return res.status(400).json({ error: "applicationId and title are required." });
    }
    const due = parseDate(dueDate);
    if (Number.isNaN(due)) return res.status(400).json({ error: "dueDate must be a valid date." });
    if (!(await accessibleApplication(req.authUser, applicationId))) return res.status(404).json({ error: "Application not found." });
    const step = await prisma.applicationNextStep.create({
      data: { applicationId: String(applicationId), title: title.trim(), dueDate: due ?? undefined },
    });
    res.status(201).json(serialize(step));
  } catch (err) {
    next(err);
  }
});

// Completing a step is one-way — once `done` is true (completedAt set), the step is locked and
// can't be un-checked, so the completion date stays a reliable record of when it actually
// happened rather than something a later click can quietly erase.
router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await accessibleStep(req.authUser, req.params.id);
    if (!existing) return res.status(404).json({ error: "Next step not found." });
    if (existing.done) {
      return res.status(400).json({ error: "This step is already completed and locked." });
    }

    const { done, dueDate } = req.body || {};
    const due = parseDate(dueDate);
    if (Number.isNaN(due)) return res.status(400).json({ error: "dueDate must be a valid date." });
    const data = {};
    if (done !== undefined) {
      data.done = !!done;
      if (data.done) data.completedAt = new Date();
    }
    if (due !== undefined) data.dueDate = due;
    const step = await prisma.applicationNextStep.update({ where: { id: req.params.id }, data });
    res.json(serialize(step));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await accessibleStep(req.authUser, req.params.id);
    if (!existing) return res.status(404).json({ error: "Next step not found." });
    await prisma.applicationNextStep.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
