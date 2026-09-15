const express = require("express");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const AVATAR_COLORS = ["bg-sky-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-indigo-500", "bg-teal-500"];

// Staff directory management is an admin-role feature, gated by the caller's own JWT role — not
// the separate ADMIN_SETTINGS_TOKEN gate (that one locks AI/notification provider config, a
// different concern with its own passcode-entry UI).
function requireAdminRole(req, res, next) {
  if (req.authUser?.role !== "admin") return res.status(403).json({ error: "Admin role required." });
  next();
}

router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { role } = req.query;
    const where = role ? { role: String(role) } : undefined;
    const staff = await prisma.staff.findMany({ where, orderBy: { createdAt: "asc" } });
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const staff = await prisma.staff.findUnique({ where: { id: req.params.id } });
    if (!staff) return res.status(404).json({ error: "Staff member not found." });
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

router.post("/", requireAuth, requireAdminRole, async (req, res, next) => {
  try {
    const { name, email, role, organization, phone } = req.body || {};
    if (!name || !email || !role) {
      return res.status(400).json({ error: "name, email and role are required." });
    }
    const count = await prisma.staff.count();
    const staff = await prisma.staff.create({
      data: {
        id: `u-${Date.now().toString(36)}`,
        name, email, role, organization, phone,
        status: "Invited",
        avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length],
      },
    });
    res.status(201).json(staff);
  } catch (err) {
    next(err);
  }
});

router.patch("/:id", requireAuth, requireAdminRole, async (req, res, next) => {
  try {
    const { role, status, name, email, phone, organization } = req.body || {};
    const staff = await prisma.staff.update({
      where: { id: req.params.id },
      data: { role, status, name, email, phone, organization },
    });
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

router.delete("/:id", requireAuth, requireAdminRole, async (req, res, next) => {
  try {
    await prisma.staff.delete({ where: { id: req.params.id } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
});

module.exports = router;
