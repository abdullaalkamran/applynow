const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

// Same terminal-status rule the per-application financial_readiness StageRecord uses (see
// applicationJourneyStore.ts's STAGE_TERMINAL_STATUS) — kept in sync manually since this is a
// plain string column, not shared code with the frontend.
const TERMINAL_STATUSES = ["Ready", "Matured"];

function serialize(r) {
  return {
    studentId: r.studentId,
    evidenceRequired: r.evidenceRequired,
    requiredAmount: r.requiredAmount ?? undefined,
    currency: r.currency || undefined,
    holdingPeriodDays: r.holdingPeriodDays ?? undefined,
    openingDate: r.openingDate ? r.openingDate.toISOString().slice(0, 10) : undefined,
    maturityDate: r.maturityDate ? r.maturityDate.toISOString().slice(0, 10) : undefined,
    bankStatus: r.bankStatus,
    accountHolder: r.accountHolder || undefined,
    accountType: r.accountType || undefined,
    completedAt: r.completedAt ? r.completedAt.toISOString().slice(0, 10) : undefined,
  };
}

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
    };

    // Once complete, stays complete — same "never un-set completedAt on its own" rule the
    // per-application journey stage follows; only ever set the first time the status reaches a
    // terminal one.
    if (!existing?.completedAt && TERMINAL_STATUSES.includes(data.bankStatus)) {
      data.completedAt = new Date();
    }

    const updated = await prisma.studentFinancialReadiness.upsert({
      where: { studentId },
      create: { studentId, ...data },
      update: data,
    });

    res.json(serialize(updated));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
