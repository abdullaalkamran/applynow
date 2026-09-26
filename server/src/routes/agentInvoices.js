const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { isInternal, requireInternal } = require("../middleware/access");

const router = express.Router();

function serializeInvoice(invoice) {
  return {
    id: invoice.id,
    agentId: invoice.agentId,
    createdAt: invoice.createdAt.toISOString().slice(0, 10),
    totalAmount: invoice.totalAmount,
    status: invoice.status,
    lines: invoice.lines.map((l) => ({
      applicationId: l.applicationId,
      studentName: l.studentName,
      university: l.university,
      course: l.course,
      amount: l.amount,
    })),
  };
}

// An agent sees only their own invoices; any internal role (admin/finance/etc — never another
// agent) sees everyone's, optionally narrowed to one agent — same scoping convention as
// middleware/access.js's studentWhere/applicationWhere.
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const where = req.authUser.role === "agent" ? { agentId: req.authUser.roleUserId } : req.query.agentId ? { agentId: String(req.query.agentId) } : {};
    if (req.authUser.role !== "agent" && !isInternal(req.authUser)) return res.status(403).json({ error: "You don't have permission to do that." });
    const invoices = await prisma.agentInvoice.findMany({ where, include: { lines: true }, orderBy: { createdAt: "desc" } });
    res.json(invoices.map(serializeInvoice));
  } catch (err) {
    next(err);
  }
});

// An agent generates their own invoice from their claimable (enrolled, not-yet-invoiced)
// commissions — see src/utils/commissionEngine.ts and src/features/agent/Commissions.tsx for the
// client-side rules this mirrors. The unique constraint on InvoiceLine.applicationId (see the
// migration) is what actually stops an enrolment being invoiced twice; the 409 below just turns
// that into a clean error instead of a generic 500.
router.post("/", requireAuth, async (req, res, next) => {
  try {
    if (req.authUser.role !== "agent") return res.status(403).json({ error: "Only an agent can generate their own invoice." });
    const { lines } = req.body || {};
    if (!Array.isArray(lines) || lines.length === 0) {
      return res.status(400).json({ error: "At least one commission line is required." });
    }
    for (const l of lines) {
      if (!l || typeof l.applicationId !== "string" || typeof l.studentName !== "string" || typeof l.university !== "string" || typeof l.course !== "string" || typeof l.amount !== "number") {
        return res.status(400).json({ error: "Each line needs applicationId, studentName, university, course and amount." });
      }
    }

    const agentId = req.authUser.roleUserId;
    const totalAmount = lines.reduce((s, l) => s + l.amount, 0);
    const existingCount = await prisma.agentInvoice.count({ where: { agentId } });
    const id = `INV-${new Date().getFullYear()}-${agentId.toUpperCase()}-${String(existingCount + 1).padStart(4, "0")}`;

    const invoice = await prisma.$transaction(async (tx) => {
      await tx.agentInvoice.create({ data: { id, agentId, totalAmount, status: "Issued" } });
      await tx.invoiceLine.createMany({
        data: lines.map((l) => ({
          invoiceId: id,
          applicationId: l.applicationId,
          studentName: l.studentName,
          university: l.university,
          course: l.course,
          amount: l.amount,
        })),
      });
      return tx.agentInvoice.findUnique({ where: { id }, include: { lines: true } });
    });

    res.status(201).json(serializeInvoice(invoice));
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "One of these applications has already been invoiced." });
    next(err);
  }
});

router.patch("/:id", requireAuth, requireInternal, async (req, res, next) => {
  try {
    const { status } = req.body || {};
    if (status !== "Paid" && status !== "Issued") return res.status(400).json({ error: 'status must be "Issued" or "Paid".' });
    const invoice = await prisma.agentInvoice.update({ where: { id: req.params.id }, data: { status }, include: { lines: true } });
    res.json(serializeInvoice(invoice));
  } catch (err) {
    if (err.code === "P2025") return res.status(404).json({ error: "Invoice not found." });
    next(err);
  }
});

module.exports = router;
