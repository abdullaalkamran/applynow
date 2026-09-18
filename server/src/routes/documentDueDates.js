const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

function serialize(d) {
  return {
    id: d.id,
    applicationId: d.applicationId,
    docType: d.docType,
    dueDate: d.dueDate.toISOString().slice(0, 10),
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { applicationId } = req.query;
    const where = {};
    if (applicationId) where.applicationId = String(applicationId);
    const rows = await prisma.documentDueDate.findMany({ where });
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

// One due date per (applicationId, docType) — posting again just moves the date, same as any
// other "set" action (no separate update route needed).
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const { applicationId, docType, dueDate } = req.body || {};
    if (!applicationId || !docType || !dueDate) {
      return res.status(400).json({ error: "applicationId, docType and dueDate are required." });
    }
    const row = await prisma.documentDueDate.upsert({
      where: { applicationId_docType: { applicationId, docType } },
      create: { applicationId, docType, dueDate: new Date(dueDate) },
      update: { dueDate: new Date(dueDate) },
    });
    res.status(201).json(serialize(row));
  } catch (err) {
    next(err);
  }
});

router.delete("/", requireAuth, async (req, res, next) => {
  try {
    const { applicationId, docType } = req.query;
    if (!applicationId || !docType) {
      return res.status(400).json({ error: "applicationId and docType are required." });
    }
    await prisma.documentDueDate.deleteMany({ where: { applicationId: String(applicationId), docType: String(docType) } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
