const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

function serializeTask(t) {
  return {
    id: t.id,
    title: t.title,
    description: t.description || undefined,
    assignedTo: { id: t.assignedToId, role: t.assignedToRole, name: t.assignedToName },
    assignedBy: { id: t.assignedById, role: t.assignedByRole, name: t.assignedByName },
    dueDate: t.dueDate ? t.dueDate.toISOString().slice(0, 10) : undefined,
    done: t.done,
    createdAt: t.createdAt.toISOString(),
    studentId: t.studentId || undefined,
    studentName: t.studentName || undefined,
    applicationId: t.applicationId || undefined,
    stageType: t.stageType || undefined,
    taskType: t.taskType || undefined,
    priority: t.priority || undefined,
    externalOwner: t.externalOwner || undefined,
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { assignedToId, assignedToRole, studentId, applicationId } = req.query;
    const where = {};
    if (assignedToId) where.assignedToId = String(assignedToId);
    if (assignedToRole) where.assignedToRole = String(assignedToRole);
    if (studentId) where.studentId = String(studentId);
    if (applicationId) where.applicationId = String(applicationId);
    const tasks = await prisma.task.findMany({ where, orderBy: { createdAt: "asc" } });
    res.json(tasks.map(serializeTask));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { id, title, description, assignedTo, assignedBy, dueDate, studentId, studentName, applicationId, stageType, taskType, priority, externalOwner } = req.body || {};
    if (!title || !assignedTo?.id || !assignedBy?.id) {
      return res.status(400).json({ error: "title, assignedTo and assignedBy are required." });
    }
    const task = await prisma.task.create({
      data: {
        id: id || `tk-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`,
        title: title.trim(),
        description: description?.trim() || undefined,
        assignedToId: assignedTo.id, assignedToRole: assignedTo.role, assignedToName: assignedTo.name,
        assignedById: assignedBy.id, assignedByRole: assignedBy.role, assignedByName: assignedBy.name,
        dueDate: dueDate ? new Date(dueDate) : undefined,
        studentId, studentName, applicationId, stageType, taskType, priority, externalOwner,
      },
    });
    res.status(201).json(serializeTask(task));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, async (req, res, next) => {
  try {
    const { title, description, dueDate, done, priority, taskType } = req.body || {};
    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: {
        title, description,
        dueDate: dueDate === null ? null : dueDate ? new Date(dueDate) : undefined,
        done, priority, taskType,
      },
    });
    res.json(serializeTask(task));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
