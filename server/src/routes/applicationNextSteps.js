const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

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

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { applicationId } = req.query;
    const where = {};
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
    if (!applicationId || !title?.trim()) {
      return res.status(400).json({ error: "applicationId and title are required." });
    }
    const step = await prisma.applicationNextStep.create({
      data: { applicationId, title: title.trim(), dueDate: dueDate ? new Date(dueDate) : undefined },
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
    const existing = await prisma.applicationNextStep.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Next step not found." });
    if (existing.done) {
      return res.status(400).json({ error: "This step is already completed and locked." });
    }

    const { done, dueDate } = req.body || {};
    const data = {};
    if (done !== undefined) {
      data.done = !!done;
      if (data.done) data.completedAt = new Date();
    }
    if (dueDate !== undefined) data.dueDate = dueDate ? new Date(dueDate) : null;
    const step = await prisma.applicationNextStep.update({ where: { id: req.params.id }, data });
    res.json(serialize(step));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.applicationNextStep.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
