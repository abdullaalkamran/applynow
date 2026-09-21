const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

function actorFrom(req) {
  return { id: req.authUser.roleUserId, role: req.authUser.role, name: req.authUser.name };
}

function threadIdFor(a, b) {
  const left = `${a.role}:${a.id}`;
  const right = `${b.role}:${b.id}`;
  return [left, right].sort().join("__");
}

function serializeMessage(m) {
  return {
    id: m.id,
    threadId: m.threadId,
    from: { id: m.fromId, role: m.fromRole, name: m.fromName },
    to: { id: m.toId, role: m.toRole, name: m.toName },
    text: m.text,
    read: m.read,
    createdAt: m.createdAt.toISOString(),
  };
}

/** Everyone the current user is allowed to start a conversation with. A student only ever sees
 * their own counsellor/agent/admission officer (mirrors every other "who's connected to this
 * student" rule in the app — see applications.js's getApplicationParticipants). Any staff role
 * sees every student they're actually connected to (as agent, counsellor, or responsible admission
 * officer on one of that student's applications) plus every other staff member, since internal
 * team messaging isn't scoped the same way client contact is. */
async function getContactsFor(actor) {
  if (actor.role === "student") {
    const student = await prisma.student.findUnique({ where: { id: actor.id } });
    if (!student) return [];
    const apps = await prisma.application.findMany({ where: { studentId: actor.id } });
    const staffIds = [...new Set([student.counsellorId, student.agentId, ...apps.map((a) => a.responsibleAdmissionOfficerId)].filter(Boolean))];
    const staff = staffIds.length ? await prisma.staff.findMany({ where: { id: { in: staffIds } } }) : [];
    return staff.map((s) => ({ id: s.id, role: s.role, name: s.name }));
  }

  const [ownStudents, responsibleApps, allStaff] = await Promise.all([
    prisma.student.findMany({ where: { OR: [{ counsellorId: actor.id }, { agentId: actor.id }] } }),
    prisma.application.findMany({ where: { responsibleAdmissionOfficerId: actor.id } }),
    prisma.staff.findMany({ where: { id: { not: actor.id } } }),
  ]);
  const studentIds = [...new Set([...ownStudents.map((s) => s.id), ...responsibleApps.map((a) => a.studentId)])];
  const students = studentIds.length ? await prisma.student.findMany({ where: { id: { in: studentIds } } }) : [];

  return [
    ...students.map((s) => ({ id: s.id, role: "student", name: s.name })),
    ...allStaff.map((s) => ({ id: s.id, role: s.role, name: s.name })),
  ];
}

router.get("/contacts", requireAuth, async (req, res, next) => {
  try {
    res.json(await getContactsFor(actorFrom(req)));
  } catch (err) {
    next(err);
  }
});

/** One row per conversation the current user is part of — the latest message and an unread count,
 * for the chat-list side of a WhatsApp-style messenger. Grouping by threadId in application code
 * rather than a Prisma groupBy, since we need the *other* party's identity out of whichever side
 * of the pair they were on, and the full latest message object, not just an aggregate. */
router.get("/threads", requireAuth, async (req, res, next) => {
  try {
    const actor = actorFrom(req);
    const rows = await prisma.message.findMany({
      where: { OR: [{ fromId: actor.id, fromRole: actor.role }, { toId: actor.id, toRole: actor.role }] },
      orderBy: { createdAt: "desc" },
    });

    const byThread = new Map();
    for (const m of rows) {
      if (!byThread.has(m.threadId)) byThread.set(m.threadId, { latest: m, unread: 0 });
      const entry = byThread.get(m.threadId);
      if (m.toId === actor.id && m.toRole === actor.role && !m.read) entry.unread++;
    }

    const threads = [...byThread.entries()].map(([threadId, { latest, unread }]) => {
      const isMine = latest.fromId === actor.id && latest.fromRole === actor.role;
      const counterpart = isMine
        ? { id: latest.toId, role: latest.toRole, name: latest.toName }
        : { id: latest.fromId, role: latest.fromRole, name: latest.fromName };
      return { threadId, counterpart, lastMessage: serializeMessage(latest), unread };
    });
    threads.sort((a, b) => new Date(b.lastMessage.createdAt) - new Date(a.lastMessage.createdAt));
    res.json(threads);
  } catch (err) {
    next(err);
  }
});

// Thread ids are deterministic ("role:id__role:id"), so the thread itself is only readable by
// one of its two participants — same predicate /threads already uses.
router.get("/:threadId", requireAuth, async (req, res, next) => {
  try {
    const actor = actorFrom(req);
    const messages = await prisma.message.findMany({
      where: {
        threadId: req.params.threadId,
        OR: [{ fromId: actor.id, fromRole: actor.role }, { toId: actor.id, toRole: actor.role }],
      },
      orderBy: { createdAt: "asc" },
    });
    res.json(messages.map(serializeMessage));
  } catch (err) {
    next(err);
  }
});

router.patch("/:threadId/read", requireAuth, async (req, res, next) => {
  try {
    const actor = actorFrom(req);
    await prisma.message.updateMany({
      where: { threadId: req.params.threadId, toId: actor.id, toRole: actor.role, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { to, text } = req.body || {};
    if (!to?.id || !to?.role || typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "to and text are required." });
    }
    if (text.length > 10_000) return res.status(400).json({ error: "Message is too long." });
    const from = actorFrom(req);
    // The recipient must be someone this user is actually allowed to talk to (see getContactsFor),
    // and their display name comes from the directory, never from the request.
    const contacts = await getContactsFor(from);
    const recipient = contacts.find((c) => c.id === String(to.id) && c.role === String(to.role));
    if (!recipient) return res.status(404).json({ error: "Recipient not found." });
    const threadId = threadIdFor(from, recipient);
    const message = await prisma.message.create({
      data: {
        id: `msg-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
        threadId,
        fromId: from.id, fromRole: from.role, fromName: from.name,
        toId: recipient.id, toRole: recipient.role, toName: recipient.name,
        text,
      },
    });
    res.status(201).json(serializeMessage(message));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
module.exports.threadIdFor = threadIdFor;
