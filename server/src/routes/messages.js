const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

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
    createdAt: m.createdAt.toISOString(),
  };
}

router.get("/:threadId", requireAuth, async (req, res, next) => {
  try {
    const messages = await prisma.message.findMany({
      where: { threadId: req.params.threadId },
      orderBy: { createdAt: "asc" },
    });
    res.json(messages.map(serializeMessage));
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { from, to, text } = req.body || {};
    if (!from?.id || !to?.id || !text) {
      return res.status(400).json({ error: "from, to and text are required." });
    }
    const threadId = threadIdFor(from, to);
    const message = await prisma.message.create({
      data: {
        id: `msg-${Date.now().toString(36)}`,
        threadId,
        fromId: from.id, fromRole: from.role, fromName: from.name,
        toId: to.id, toRole: to.role, toName: to.name,
        text,
      },
    });
    res.status(201).json(serializeMessage(message));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
