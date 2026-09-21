const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { requireStaff, applicationWhere, accessibleApplication } = require("../middleware/access");

const router = express.Router();

function serialize(d) {
  return {
    id: d.id,
    applicationId: d.applicationId,
    docType: d.docType,
    dueDate: d.dueDate.toISOString().slice(0, 10),
  };
}

// Scoped through the application (see middleware/access.js); ordered so repeated polls compare
// equal instead of remounting the page when Postgres returns rows in a different order.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { applicationId } = req.query;
    const scope = applicationWhere(req.authUser);
    const where = Object.keys(scope).length ? { application: scope } : {};
    if (applicationId) where.applicationId = String(applicationId);
    const rows = await prisma.documentDueDate.findMany({ where, orderBy: [{ applicationId: "asc" }, { docType: "asc" }] });
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

// One due date per (applicationId, docType) — posting again just moves the date, same as any
// other "set" action (no separate update route needed). Set by the staff working the
// application (agent/counsellor), never by the student it applies to.
router.post("/", requireAuth, requireStaff, async (req, res, next) => {
  try {
    const { applicationId, docType, dueDate } = req.body || {};
    if (!applicationId || typeof docType !== "string" || !docType.trim() || typeof dueDate !== "string") {
      return res.status(400).json({ error: "applicationId, docType and dueDate are required." });
    }
    const due = new Date(dueDate);
    if (Number.isNaN(due.getTime())) return res.status(400).json({ error: "dueDate must be a valid date." });
    if (!(await accessibleApplication(req.authUser, applicationId))) return res.status(404).json({ error: "Application not found." });
    const row = await prisma.documentDueDate.upsert({
      where: { applicationId_docType: { applicationId: String(applicationId), docType } },
      create: { applicationId: String(applicationId), docType, dueDate: due },
      update: { dueDate: due },
    });
    res.status(201).json(serialize(row));
  } catch (err) {
    next(err);
  }
});

router.delete("/", requireAuth, requireStaff, async (req, res, next) => {
  try {
    const { applicationId, docType } = req.query;
    if (!applicationId || !docType) {
      return res.status(400).json({ error: "applicationId and docType are required." });
    }
    if (!(await accessibleApplication(req.authUser, String(applicationId)))) return res.status(404).json({ error: "Application not found." });
    await prisma.documentDueDate.deleteMany({ where: { applicationId: String(applicationId), docType: String(docType) } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
