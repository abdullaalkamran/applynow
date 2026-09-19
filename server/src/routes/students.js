const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { threadIdFor } = require("./messages");

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

function actorFrom(req) {
  return { id: req.authUser.roleUserId, role: req.authUser.role, name: req.authUser.name };
}

function serializeComment(c) {
  return {
    id: c.id,
    studentId: c.studentId,
    notes: c.notes,
    timestamp: c.createdAt.toISOString(),
    performedBy: { id: c.performedById, role: c.performedByRole, name: c.performedByName },
  };
}

/** Student + their counsellor + their agent — a case-level comment thread isn't tied to one
 * application, so there's no responsibleCounsellorId/responsibleAdmissionOfficerId to draw on
 * (see applications.js's getApplicationParticipants for that per-application version); this is
 * everyone the Student record itself names. */
async function getStudentParticipants(student) {
  const staffIds = [student.counsellorId, student.agentId].filter(Boolean);
  const staff = staffIds.length ? await prisma.staff.findMany({ where: { id: { in: staffIds } } }) : [];
  const participants = [{ id: student.id, role: "student", name: student.name }];
  for (const s of staff) participants.push({ id: s.id, role: s.role, name: s.name });
  const seen = new Set();
  return participants.filter((p) => {
    const key = `${p.role}:${p.id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// No ownership check, matching every other route in this file — see applications.js's own
// GET/POST /:id/activity for the same reasoning.
router.get("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) return res.status(404).json({ error: "Student not found." });
    const rows = await prisma.studentComment.findMany({
      where: { studentId: req.params.id },
      orderBy: { createdAt: "desc" },
    });
    res.json(rows.map(serializeComment));
  } catch (err) {
    next(err);
  }
});

router.post("/:id/comments", requireAuth, async (req, res, next) => {
  try {
    const { notes } = req.body || {};
    if (typeof notes !== "string" || !notes.trim()) {
      return res.status(400).json({ error: "notes is required." });
    }
    const student = await prisma.student.findUnique({ where: { id: req.params.id } });
    if (!student) return res.status(404).json({ error: "Student not found." });
    const actor = actorFrom(req);

    const row = await prisma.studentComment.create({
      data: {
        studentId: req.params.id,
        notes,
        performedById: actor.id, performedByRole: actor.role, performedByName: actor.name,
      },
    });

    const participants = await getStudentParticipants(student);
    const recipients = participants.filter((p) => !(p.id === actor.id && p.role === actor.role));
    if (recipients.length > 0) {
      await prisma.notification.createMany({
        data: recipients.map((p) => ({
          userId: p.id,
          userRole: p.role,
          type: "student_comment_added",
          title: `${actor.name} commented on ${student.name}'s case`,
          body: notes.slice(0, 280),
          studentId: student.id,
          activityId: row.id,
        })),
      });
      // Same fan-out as applications.js's comment_added — also lands as an individual message
      // from the poster to each other participant.
      await prisma.message.createMany({
        data: recipients.map((p) => ({
          id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}-${p.id}`,
          threadId: threadIdFor(actor, p),
          fromId: actor.id, fromRole: actor.role, fromName: actor.name,
          toId: p.id, toRole: p.role, toName: p.name,
          text: `[${student.name}'s case] ${notes}`,
        })),
      });
    }

    res.status(201).json(serializeComment(row));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
