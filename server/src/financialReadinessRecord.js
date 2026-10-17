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
  "bankStatus", "bankName", "depositType", "openingDate", "requiredAmount", "currency",
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
    bankName: r.bankName || undefined,
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

// --- Multiple bank accounts -------------------------------------------------------------------
// A student may hold the required funds across several banks. Each account lives in StudentBankAccount; the shared
// record above keeps a derived summary so everything downstream (journey stage, tasks, notifications, AI tools)
// continues to read one set of fields.
const ACCOUNT_STATUSES = ["Not Required", "Not Started", "Preparing", "Maintaining", "Matured", "Ready", "Expired"];
// Overall status is the least-advanced account's: funds aren't "Ready" until every account is.
const STATUS_RANK = { Expired: 0, "Not Started": 1, Preparing: 2, Maintaining: 3, Matured: 4, Ready: 5 };
const HOLDING_STATUSES = new Set(["Maintaining", "Matured", "Ready"]);

function serializeAccount(a) {
  return {
    id: a.id, studentId: a.studentId, bankName: a.bankName, depositType: a.depositType || undefined,
    openingDate: toDateString(a.openingDate), amount: a.amount ?? undefined, currency: a.currency || undefined,
    accountHolder: a.accountHolder || undefined, accountType: a.accountType || undefined, status: a.status,
  };
}

/** Folds a student's accounts into the single-record fields: names joined, amount summed, cash-in date = the most
 * recent one (conservative — all funds have then been held at least that long), status = least advanced, and
 * deposit/holder/type from the first account. Returns null when there are no accounts. */
function summarizeAccounts(accounts) {
  if (accounts.length === 0) return null;
  const active = accounts.filter((a) => a.status !== "Not Required");
  const counted = active.length ? active : accounts;
  const holding = counted.filter((a) => HOLDING_STATUSES.has(a.status));
  const dates = holding.map((a) => a.openingDate).filter(Boolean).map((d) => new Date(d).getTime());
  const first = counted[0];
  const bankStatus = active.length
    ? active.reduce((worst, a) => ((STATUS_RANK[a.status] ?? 1) < (STATUS_RANK[worst] ?? 1) ? a.status : worst), active[0].status)
    : "Not Required";
  return {
    bankStatus,
    bankName: counted.map((a) => a.bankName).join(", ").slice(0, 190),
    requiredAmount: holding.length ? holding.reduce((sum, a) => sum + (a.amount || 0), 0) : null,
    currency: holding.find((a) => a.currency)?.currency ?? first.currency ?? null,
    openingDate: dates.length ? new Date(Math.max(...dates)) : null,
    depositType: first.depositType ?? null,
    accountHolder: first.accountHolder ?? null,
    accountType: first.accountType ?? null,
  };
}

async function listBankAccounts(studentId) {
  const rows = await prisma.studentBankAccount.findMany({ where: { studentId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  return rows.map(serializeAccount);
}

/** Replaces the student's whole account list (the editor sends the full list) and refreshes the shared summary,
 * so the save lands in the same history trail and completion rule as any other edit. */
async function replaceBankAccounts(studentId, accounts, actor) {
  await prisma.$transaction(async (tx) => {
    const keep = accounts.filter((a) => a.id).map((a) => a.id);
    await tx.studentBankAccount.deleteMany({ where: { studentId, ...(keep.length ? { id: { notIn: keep } } : {}) } });
    for (const a of accounts) {
      const data = {
        bankName: a.bankName, depositType: a.depositType ?? null, openingDate: a.openingDate ?? null, amount: a.amount ?? null,
        currency: a.currency ?? null, accountHolder: a.accountHolder ?? null, accountType: a.accountType ?? null, status: a.status,
      };
      if (a.id && (await tx.studentBankAccount.findFirst({ where: { id: a.id, studentId } }))) {
        await tx.studentBankAccount.update({ where: { id: a.id }, data });
      } else {
        await tx.studentBankAccount.create({ data: { studentId, ...data } });
      }
    }
  });
  const saved = await prisma.studentBankAccount.findMany({ where: { studentId }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
  const summary = summarizeAccounts(saved);
  const existing = await prisma.studentFinancialReadiness.findUnique({ where: { studentId } });
  const record = summary
    ? await saveFinancialReadiness(studentId, {
        evidenceRequired: existing?.evidenceRequired ?? true,
        holdingPeriodDays: existing?.holdingPeriodDays ?? null,
        maturityDate: existing?.maturityDate ?? null,
        ...summary,
      }, actor)
    : existing ? serialize(existing) : null;
  return { accounts: saved.map(serializeAccount), record };
}

module.exports = { serialize, serializeAccount, listBankAccounts, replaceBankAccounts, summarizeAccounts, ACCOUNT_STATUSES, saveFinancialReadiness, listFinancialReadinessHistory, TERMINAL_STATUSES };
