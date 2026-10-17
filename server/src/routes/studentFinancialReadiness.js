const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { serialize, serializeAccount, saveFinancialReadiness, listFinancialReadinessHistory, replaceBankAccounts, sweepMaturity, ACCOUNT_STATUSES } = require("../financialReadinessRecord");
const { studentWhere, accessibleStudent } = require("../middleware/access");

const router = express.Router();

// Bank details — a student sees/edits only their own record, an agent their own students',
// internal staff any (see middleware/access.js).
router.get("/", requireAuth, async (req, res, next) => {
  try {
    await sweepMaturity().catch((err) => console.warn("Bank maturity sweep failed:", err));
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

// Every bank account the caller may see (one student may have several). Registered before "/:studentId/…".
router.get("/accounts", requireAuth, async (req, res, next) => {
  try {
    await sweepMaturity().catch((err) => console.warn("Bank maturity sweep failed:", err));
    const scope = studentWhere(req.authUser);
    const where = Object.keys(scope).length ? { studentId: { in: (await prisma.student.findMany({ where: scope, select: { id: true } })).map((s) => s.id) } } : {};
    if (req.query.studentId) where.studentId = String(req.query.studentId);
    const rows = await prisma.studentBankAccount.findMany({ where, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
    res.json(rows.map(serializeAccount));
  } catch (err) {
    next(err);
  }
});

// Replaces the student's full list of bank accounts — the same door for a student and for their counsellor/agent.
router.put("/:studentId/accounts", requireAuth, async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (!(await accessibleStudent(req.authUser, studentId))) return res.status(404).json({ error: "Student not found." });
    const raw = req.body?.accounts;
    if (!Array.isArray(raw) || raw.length > 20) return res.status(400).json({ error: "accounts must be a list of up to 20 bank accounts." });
    // Matured / Ready (and the maturity date that drives Matured) belong to the counsellor. A student or agent can set
    // Not Opened / Preparing / Maintaining, but can't grant — or change — the later stages.
    const canSetLaterStages = req.authUser.role === "counsellor" || req.authUser.role === "admin";
    const LATER = ["Matured", "Ready"];
    const existingById = new Map((await prisma.studentBankAccount.findMany({ where: { studentId } })).map((e) => [e.id, e]));
    const accounts = [];
    for (const a of raw) {
      if (!a || typeof a.bankName !== "string" || !a.bankName.trim()) return res.status(400).json({ error: "Every bank account needs a bank name." });
      if (!ACCOUNT_STATUSES.includes(a.status)) return res.status(400).json({ error: "Invalid bank account status." });
      if (a.amount != null && (typeof a.amount !== "number" || !Number.isFinite(a.amount) || a.amount < 0)) return res.status(400).json({ error: "Amount must be a positive number." });
      const date = a.openingDate ? new Date(a.openingDate) : null;
      if (date && Number.isNaN(date.getTime())) return res.status(400).json({ error: "Cash-in date must be valid." });
      for (const key of ["depositType", "currency", "accountHolder", "accountType"]) {
        if (a[key] != null && typeof a[key] !== "string") return res.status(400).json({ error: `${key} must be a string.` });
      }
      const matDate = a.maturityDate ? new Date(a.maturityDate) : null;
      if (matDate && Number.isNaN(matDate.getTime())) return res.status(400).json({ error: "Maturity date must be valid." });
      const before = typeof a.id === "string" ? existingById.get(a.id) : undefined;
      let status = a.status;
      let maturityDate = matDate;
      if (!canSetLaterStages) {
        if (LATER.includes(status) && before?.status !== status) return res.status(403).json({ error: "Only a counsellor can mark an account Matured or Ready." });
        // An account the counsellor already moved on keeps its stage and date; nothing else a student sends can change them.
        if (before && LATER.includes(before.status)) status = before.status;
        maturityDate = before?.maturityDate ?? null;
      }
      accounts.push({
        id: typeof a.id === "string" ? a.id : undefined, bankName: a.bankName.trim().slice(0, 190), depositType: a.depositType || null,
        openingDate: date, maturityDate, amount: a.amount ?? null, currency: a.currency || null, accountHolder: a.accountHolder || null,
        accountType: a.accountType || null, status,
      });
    }
    const actor = { id: req.authUser.roleUserId, role: req.authUser.role, name: req.authUser.name };
    res.json(await replaceBankAccounts(studentId, accounts, actor));
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
