const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { serialize, saveFinancialReadiness, listFinancialReadinessHistory } = require("../financialReadinessRecord");
const { studentWhere, accessibleStudent } = require("../middleware/access");

const router = express.Router();

// Bank details — a student sees/edits only their own record, an agent their own students',
// internal staff any (see middleware/access.js).
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { studentId } = req.query;
    const scope = studentWhere(req.authUser);
    const where = Object.keys(scope).length ? { student: scope } : {};
    if (studentId) where.studentId = String(studentId);
    const rows = await prisma.studentFinancialReadiness.findMany({ where, orderBy: { studentId: "asc" } });
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

/** Newest-first audit trail of every save to this student's record, from either door. */
router.get("/:studentId/history", requireAuth, async (req, res, next) => {
  try {
    if (!(await accessibleStudent(req.authUser, req.params.studentId))) return res.status(404).json({ error: "Student not found." });
    res.json(await listFinancialReadinessHistory(req.params.studentId));
  } catch (err) {
    next(err);
  }
});

const optionalString = (v) => v === undefined || v === null || typeof v === "string";
const optionalNumber = (v) => v === undefined || v === null || (typeof v === "number" && Number.isFinite(v));
const parseDate = (v) => {
  if (v === undefined) return undefined;
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? NaN : d;
};

// Upsert, merged with whatever's already there — mirrors updateStage's "patch into current data"
// behavior on the frontend, and one record per student means there's never a create-vs-update
// branch the caller needs to worry about.
router.patch("/:studentId", requireAuth, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (!(await accessibleStudent(req.authUser, studentId))) return res.status(404).json({ error: "Student not found." });
    const patch = req.body || {};

    if (patch.evidenceRequired !== undefined && typeof patch.evidenceRequired !== "boolean") return res.status(400).json({ error: "evidenceRequired must be true or false." });
    if (!optionalNumber(patch.requiredAmount) || patch.requiredAmount < 0) return res.status(400).json({ error: "requiredAmount must be a number." });
    if (!optionalNumber(patch.holdingPeriodDays) || (patch.holdingPeriodDays != null && (!Number.isInteger(patch.holdingPeriodDays) || patch.holdingPeriodDays < 0))) {
      return res.status(400).json({ error: "holdingPeriodDays must be a whole number." });
    }
    for (const key of ["currency", "bankStatus", "bankName", "accountHolder", "accountType", "depositType"]) {
      if (!optionalString(patch[key])) return res.status(400).json({ error: `${key} must be a string.` });
    }
    const openingDate = parseDate(patch.openingDate);
    const maturityDate = parseDate(patch.maturityDate);
    if (Number.isNaN(openingDate) || Number.isNaN(maturityDate)) return res.status(400).json({ error: "Dates must be valid." });

    const existing = await prisma.studentFinancialReadiness.findUnique({ where: { studentId } });
    const data = {
      evidenceRequired: patch.evidenceRequired ?? existing?.evidenceRequired ?? true,
      requiredAmount: patch.requiredAmount !== undefined ? patch.requiredAmount : existing?.requiredAmount,
      currency: patch.currency !== undefined ? patch.currency : existing?.currency,
      holdingPeriodDays: patch.holdingPeriodDays !== undefined ? patch.holdingPeriodDays : existing?.holdingPeriodDays,
      openingDate: openingDate !== undefined ? openingDate : existing?.openingDate,
      maturityDate: maturityDate !== undefined ? maturityDate : existing?.maturityDate,
      bankStatus: patch.bankStatus ?? existing?.bankStatus ?? "Not Started",
      bankName: patch.bankName !== undefined ? patch.bankName : existing?.bankName,
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
