// The real, persisted in-app notification inbox every role's header bell reads from — see the
// Notification model's own comment for how this differs from notifications/dispatch.js's outbound
// WhatsApp/email sends. Scoped to whoever's authenticated; nothing here lets a caller read or
// mark another user's notifications.
const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

function actorFrom(req) {
  return { id: req.authUser.roleUserId, role: req.authUser.role };
}

function serializeNotification(n) {
  return {
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body || undefined,
    studentId: n.studentId || undefined,
    applicationId: n.applicationId || undefined,
    activityId: n.activityId || undefined,
    read: n.read,
    createdAt: n.createdAt.toISOString(),
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const actor = actorFrom(req);
    const rows = await prisma.notification.findMany({
      where: { userId: actor.id, userRole: actor.role },
      orderBy: { createdAt: "desc" },
      take: 100,
    });
    res.json(rows.map(serializeNotification));
  } catch (err) {
    next(err);
  }
});

router.patch("/:id/read", requireAuth, async (req, res, next) => {
  try {
    const actor = actorFrom(req);
    const existing = await prisma.notification.findUnique({ where: { id: req.params.id } });
    if (!existing || existing.userId !== actor.id || existing.userRole !== actor.role) {
      return res.status(404).json({ error: "Notification not found." });
    }
    const updated = await prisma.notification.update({ where: { id: req.params.id }, data: { read: true } });
    res.json(serializeNotification(updated));
  } catch (err) {
    next(err);
  }
});

router.patch("/read-all", requireAuth, async (req, res, next) => {
  try {
    const actor = actorFrom(req);
    await prisma.notification.updateMany({
      where: { userId: actor.id, userRole: actor.role, read: false },
      data: { read: true },
    });
    res.json({ ok: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
