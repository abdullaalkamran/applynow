// The one write path for a student's shared Financial Readiness record — used by both doors it
// can be edited through (PATCH /api/financial-readiness/:studentId from the student's Dashboard
// form, and the financial_readiness stage of PATCH /api/applications/:id/journey/:stageType from
// a counsellor's Journey panel) so they can't drift apart, and so every save from either door
// lands in the same StudentFinancialReadinessHistory audit trail.
const prisma = require("./prismaClient");

// Same terminal-status rule the per-application financial_readiness StageRecord uses (see
// applicationJourneyStore.ts's STAGE_TERMINAL_STATUS) — kept in sync manually since this is a
// plain string column, not shared code with the frontend.
const TERMINAL_STATUSES = ["Ready", "Matured"];

// Every field a save can change, in the order the history entry lists them.
const TRACKED_FIELDS = [
  "bankStatus", "depositType", "openingDate", "requiredAmount", "currency",
  "accountHolder", "accountType", "holdingPeriodDays", "maturityDate",
];

const toDateString = (d) => (d ? new Date(d).toISOString().slice(0, 10) : undefined);

function serialize(r) {
  return {
    studentId: r.studentId,
    evidenceRequired: r.evidenceRequired,
    requiredAmount: r.requiredAmount ?? undefined,
    currency: r.currency || undefined,
    holdingPeriodDays: r.holdingPeriodDays ?? undefined,
    openingDate: toDateString(r.openingDate),
    maturityDate: toDateString(r.maturityDate),
    bankStatus: r.bankStatus,
    accountHolder: r.accountHolder || undefined,
    accountType: r.accountType || undefined,
    depositType: r.depositType || undefined,
    completedAt: toDateString(r.completedAt),
  };
}

function serializeHistory(h) {
  return {
    id: h.id,
    studentId: h.studentId,
    changedAt: h.changedAt.toISOString(),
    changedBy: { id: h.changedById, role: h.changedByRole, name: h.changedByName },
    changes: h.changes,
  };
}

/** Field-level before/after list between two serialized records (null for "not set"). */
function diff(before, after) {
  const changes = [];
  for (const field of TRACKED_FIELDS) {
    const from = before?.[field] ?? null;
    const to = after[field] ?? null;
    if (from !== to) changes.push({ field, from, to });
  }
  return changes;
}

/** Upserts the student's record from an already-merged `data` object (the caller decides the
 * merge rule — the two doors differ slightly there, see each route), stamps completedAt the first
 * time a terminal status is reached, and appends a history row when anything actually changed.
 * Returns the saved record, serialized. */
async function saveFinancialReadiness(studentId, data, actor) {
  const existing = await prisma.studentFinancialReadiness.findUnique({ where: { studentId } });

  // Once complete, stays complete — same "never un-set completedAt on its own" rule the
  // per-application journey stage follows; only ever set the first time the status reaches a
  // terminal one.
  if (!existing?.completedAt && !data.completedAt && TERMINAL_STATUSES.includes(data.bankStatus)) {
    data.completedAt = new Date();
  }

  const updated = await prisma.$transaction(async (tx) => {
    const saved = await tx.studentFinancialReadiness.upsert({
      where: { studentId },
      create: { studentId, ...data },
      update: data,
    });
    const changes = diff(existing ? serialize(existing) : null, serialize(saved));
    if (changes.length > 0) {
      await tx.studentFinancialReadinessHistory.create({
        data: {
          studentId,
          changedById: actor.id, changedByRole: actor.role, changedByName: actor.name,
          changes,
        },
      });
    }
    return saved;
  });

  return serialize(updated);
}

async function listFinancialReadinessHistory(studentId) {
  const rows = await prisma.studentFinancialReadinessHistory.findMany({
    where: { studentId },
    orderBy: { changedAt: "desc" },
  });
  return rows.map(serializeHistory);
}

module.exports = { serialize, saveFinancialReadiness, listFinancialReadinessHistory, TERMINAL_STATUSES };
