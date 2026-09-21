const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const MODES = ["percent", "fixed"];

// Rates are a platform-level agreement per university: every signed-in user (agents most of
// all, for their Finance page) can read them; only an admin can change them — same JWT-role gate
// staff.js/students.js use.
function requireAdminRole(req, res, next) {
  if (req.authUser?.role !== "admin") return res.status(403).json({ error: "Admin role required." });
  next();
}

function serialize(r) {
  return {
    universityId: r.universityId,
    mode: r.mode,
    ratePercent: r.ratePercent,
    fixedAmountUSD: r.fixedAmountUSD,
    bonusPercent: r.bonusPercent,
    bonusLabel: r.bonusLabel,
    updatedAt: r.updatedAt.toISOString(),
  };
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const rows = await prisma.commissionRate.findMany({ orderBy: { universityId: "asc" } });
    res.json(rows.map(serialize));
  } catch (err) {
    next(err);
  }
});

function number(v, name, { min = 0, max = Infinity } = {}) {
  if (v === undefined || v === null || v === "") return 0;
  const n = Number(v);
  if (!Number.isFinite(n) || n < min || n > max) {
    throw Object.assign(new Error(`${name} must be a number between ${min} and ${max === Infinity ? "∞" : max}.`), { status: 400 });
  }
  return n;
}

// Upsert — one row per university, created on first save.
router.put("/:universityId", requireAuth, requireAdminRole, async (req, res, next) => {
  try {
    const { mode = "percent", ratePercent, fixedAmountUSD, bonusPercent, bonusLabel } = req.body || {};
    if (!MODES.includes(mode)) return res.status(400).json({ error: `mode must be one of: ${MODES.join(", ")}` });
    const data = {
      mode,
      ratePercent: number(ratePercent, "ratePercent", { max: 100 }),
      fixedAmountUSD: number(fixedAmountUSD, "fixedAmountUSD"),
      bonusPercent: number(bonusPercent, "bonusPercent", { max: 100 }),
      bonusLabel: typeof bonusLabel === "string" ? bonusLabel.trim() : "",
    };
    const row = await prisma.commissionRate.upsert({
      where: { universityId: req.params.universityId },
      update: data,
      create: { universityId: req.params.universityId, ...data },
    });
    res.json(serialize(row));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// Clearing a university's rate means "no agreement yet" — agents see it as unset, not 0%.
router.delete("/:universityId", requireAuth, requireAdminRole, async (req, res, next) => {
  try {
    await prisma.commissionRate.deleteMany({ where: { universityId: req.params.universityId } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
