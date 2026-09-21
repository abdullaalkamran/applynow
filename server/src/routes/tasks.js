const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { isInternal, accessibleStudent, accessibleApplication } = require("../middleware/access");

const router = express.Router();

const ROLES = ["student", "agent", "counsellor", "admission", "compliance", "data", "finance", "admin"];
const PRIORITIES = ["low", "medium", "high"];
const STAGE_TYPES = ["application", "offer", "financial_readiness", "payment", "interview", "university_document", "visa", "evisa"];
const ID_RE = /^tk-[A-Za-z0-9_-]{1,60}$/;

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

function actorFrom(req) {
  return { id: req.authUser.roleUserId, role: req.authUser.role, name: req.authUser.name };
}

/** `YYYY-MM-DD` (or any parseable date) → Date, else null; `undefined` when absent. */
function parseDueDate(value) {
  if (value === undefined) return undefined;
  if (value === null || value === "") return null;
  if (typeof value !== "string") return NaN;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? NaN : d;
}

function optionalString(v) {
  return v === undefined || v === null || typeof v === "string";
}

/** What the caller may see: their own tasks (assigned to or by them) plus, for students and
 * agents, tasks about their own student record(s). Internal staff see everything, as today. */
function taskScope(actor) {
  if (isInternal({ role: actor.role })) return {};
  const mine = [{ assignedToId: actor.id, assignedToRole: actor.role }, { assignedById: actor.id, assignedByRole: actor.role }];
  if (actor.role === "student") return { OR: [...mine, { studentId: actor.id }] };
  return { OR: [...mine, { student: { agentId: actor.id } }] };
}

async function canTouchTask(actor, task) {
  if (isInternal({ role: actor.role })) return true;
  if (task.assignedToId === actor.id && task.assignedToRole === actor.role) return true;
  if (task.assignedById === actor.id && task.assignedByRole === actor.role) return true;
  return false;
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { assignedToId, assignedToRole, studentId, applicationId } = req.query;
    const where = { ...taskScope(actorFrom(req)) };
    if (assignedToId) where.assignedToId = String(assignedToId);
    if (assignedToRole) {
      if (!ROLES.includes(String(assignedToRole))) return res.json([]);
      where.assignedToRole = String(assignedToRole);
    }
    if (studentId) where.studentId = String(studentId);
    if (applicationId) where.applicationId = String(applicationId);
    const tasks = await prisma.task.findMany({ where, orderBy: { createdAt: "asc" } });
    res.json(tasks.map(serializeTask));
  } catch (err) {
    next(err);
  }
});

// `assignedBy` is always whoever is actually calling — a task "from Admin" can't be forged. Who
// may be assigned mirrors the client's taskAssignment.ts: a student only themselves, an agent
// themselves or one of their own students, internal staff anyone.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { id, title, description, assignedTo, dueDate, studentId, studentName, applicationId, stageType, taskType, priority, externalOwner } = req.body || {};
    if (typeof title !== "string" || !title.trim() || !assignedTo?.id || !assignedTo?.role) {
      return res.status(400).json({ error: "title and assignedTo are required." });
    }
    if (!ROLES.includes(String(assignedTo.role))) return res.status(400).json({ error: "Invalid assignee role." });
    if (priority !== undefined && priority !== null && !PRIORITIES.includes(priority)) return res.status(400).json({ error: "Invalid priority." });
    if (stageType !== undefined && stageType !== null && !STAGE_TYPES.includes(stageType)) return res.status(400).json({ error: "Invalid stageType." });
    for (const [key, value] of Object.entries({ description, studentId, studentName, applicationId, taskType, externalOwner })) {
      if (!optionalString(value)) return res.status(400).json({ error: `${key} must be a string.` });
    }
    const due = parseDueDate(dueDate);
    if (Number.isNaN(due)) return res.status(400).json({ error: "dueDate must be a valid date." });

    const actor = actorFrom(req);
    const assigneeId = String(assignedTo.id);
    const assigneeRole = String(assignedTo.role);
    const isSelf = assigneeId === actor.id && assigneeRole === actor.role;
    if (!isInternal(actor)) {
      const ownStudent = assigneeRole === "student" && actor.role === "agent" && (await accessibleStudent(req.authUser, assigneeId));
      if (!isSelf && !ownStudent) return res.status(403).json({ error: "You can't assign a task to that person." });
    }
    // The assignee's name comes from the directory when we can resolve it, not from the body.
    let assigneeName = typeof assignedTo.name === "string" ? assignedTo.name : "";
    if (isSelf) assigneeName = actor.name;
    else if (assigneeRole === "student") {
      const s = await prisma.student.findUnique({ where: { id: assigneeId }, select: { name: true } });
      if (s) assigneeName = s.name;
    } else {
      const s = await prisma.staff.findUnique({ where: { id: assigneeId }, select: { name: true } });
      if (s) assigneeName = s.name;
    }
    if (studentId && !(await accessibleStudent(req.authUser, studentId))) return res.status(404).json({ error: "Student not found." });
    if (applicationId && !(await accessibleApplication(req.authUser, applicationId))) return res.status(404).json({ error: "Application not found." });

    const task = await prisma.task.create({
      data: {
        id: typeof id === "string" && ID_RE.test(id) ? id : `tk-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        title: title.trim(),
        description: description?.trim() || undefined,
        assignedToId: assigneeId, assignedToRole: assigneeRole, assignedToName: assigneeName,
        assignedById: actor.id, assignedByRole: actor.role, assignedByName: actor.name,
        dueDate: due ?? undefined,
        studentId: studentId || undefined, studentName: studentName || undefined, applicationId: applicationId || undefined,
        stageType: stageType || undefined, taskType: taskType || undefined, priority: priority || undefined, externalOwner: externalOwner || undefined,
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
    if (title !== undefined && (typeof title !== "string" || !title.trim())) return res.status(400).json({ error: "title can't be empty." });
    if (!optionalString(description) || !optionalString(taskType)) return res.status(400).json({ error: "Invalid task fields." });
    if (done !== undefined && typeof done !== "boolean") return res.status(400).json({ error: "done must be true or false." });
    if (priority !== undefined && priority !== null && !PRIORITIES.includes(priority)) return res.status(400).json({ error: "Invalid priority." });
    const due = parseDueDate(dueDate);
    if (Number.isNaN(due)) return res.status(400).json({ error: "dueDate must be a valid date." });

    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing || !(await canTouchTask(actorFrom(req), existing))) return res.status(404).json({ error: "Task not found." });

    const task = await prisma.task.update({
      where: { id: req.params.id },
      data: { title, description, dueDate: due, done, priority, taskType },
    });
    res.json(serializeTask(task));
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const existing = await prisma.task.findUnique({ where: { id: req.params.id } });
    if (!existing || !(await canTouchTask(actorFrom(req), existing))) return res.status(404).json({ error: "Task not found." });
    await prisma.task.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
