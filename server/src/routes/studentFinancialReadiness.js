const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { serialize, saveFinancialReadiness, listFinancialReadinessHistory } = require("../financialReadinessRecord");

const router = express.Router();

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { studentId } = req.query;
    const where = studentId ? { studentId: String(studentId) } : {};
    const rows = await prisma.studentFinancialReadiness.findMany({ where });
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

/** Newest-first audit trail of every save to this student's record, from either door. */
router.get("/:studentId/history", requireAuth, async (req, res, next) => {
  try {
    res.json(await listFinancialReadinessHistory(req.params.studentId));
  } catch (err) {
    next(err);
  }
});

// Upsert, merged with whatever's already there — mirrors updateStage's "patch into current data"
// behavior on the frontend, and one record per student means there's never a create-vs-update
// branch the caller needs to worry about.
router.patch("/:studentId", requireAuth, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const existing = await prisma.studentFinancialReadiness.findUnique({ where: { studentId } });
    const patch = req.body || {};

    const data = {
      evidenceRequired: patch.evidenceRequired ?? existing?.evidenceRequired ?? true,
      requiredAmount: patch.requiredAmount !== undefined ? patch.requiredAmount : existing?.requiredAmount,
      currency: patch.currency !== undefined ? patch.currency : existing?.currency,
      holdingPeriodDays: patch.holdingPeriodDays !== undefined ? patch.holdingPeriodDays : existing?.holdingPeriodDays,
      openingDate: patch.openingDate !== undefined ? (patch.openingDate ? new Date(patch.openingDate) : null) : existing?.openingDate,
      maturityDate: patch.maturityDate !== undefined ? (patch.maturityDate ? new Date(patch.maturityDate) : null) : existing?.maturityDate,
      bankStatus: patch.bankStatus ?? existing?.bankStatus ?? "Not Started",
      accountHolder: patch.accountHolder !== undefined ? patch.accountHolder : existing?.accountHolder,
      accountType: patch.accountType !== undefined ? patch.accountType : existing?.accountType,
      depositType: patch.depositType !== undefined ? patch.depositType : existing?.depositType,
    };

    const actor = { id: req.authUser.roleUserId, role: req.authUser.role, name: req.authUser.name };
    res.json(await saveFinancialReadiness(studentId, data, actor));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
