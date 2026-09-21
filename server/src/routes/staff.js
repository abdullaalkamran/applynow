const express = require("express");
const bcrypt = require("bcryptjs");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { requireStaff, isInternal, publicStaff } = require("../middleware/access");

const router = express.Router();

const STAFF_STATUSES = ["Active", "Invited", "Inactive"];

const AVATAR_COLORS = ["bg-sky-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-indigo-500", "bg-teal-500"];

// Staff roles this router can ever create/manage (excludes "student" and "agent" — students
// self-register, agents come from their own referral-based flow, not an admin invite).
const STAFF_ROLES = ["counsellor", "admission", "compliance", "data", "finance", "admin"];

/** Whether a directory row actually has a working login yet — an "Invited" member added without a
 * password has a Staff record but no User row at all, so Active/Inactive status meant nothing for
 * them either way (see the PATCH /:id and login-time checks below, which now make status real). */
async function attachHasLogin(rows) {
  const list = Array.isArray(rows) ? rows : [rows];
  const users = await prisma.user.findMany({
    where: { roleUserId: { in: list.map((s) => s.id) } },
    select: { roleUserId: true, role: true },
  });
  const withLogin = new Set(users.map((u) => `${u.roleUserId}:${u.role}`));
  const out = list.map((s) => ({ ...s, hasLogin: withLogin.has(`${s.id}:${s.role}`) }));
  return Array.isArray(rows) ? out : out[0];
}

// Excludes visually-confusable characters (0/O, 1/I/L) since the code is meant to be read off a
// screen and retyped, not just scanned from the QR.
const REFERRAL_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

function randomReferralCode() {
  let code = "";
  for (let i = 0; i < 8; i++) code += REFERRAL_CODE_CHARS[Math.floor(Math.random() * REFERRAL_CODE_CHARS.length)];
  return code;
}

/** Assigns a fresh, unique referral code — collisions are astronomically unlikely at 8 chars from
 * a 32-char alphabet, but this keeps retrying rather than ever risking a duplicate. */
async function assignReferralCode(staffId) {
  for (let attempt = 0; attempt < 5; attempt++) {
    const referralCode = randomReferralCode();
    try {
      return await prisma.staff.update({ where: { id: staffId }, data: { referralCode } });
    } catch (err) {
      if (err.code !== "P2002") throw err;
    }
  }
  throw new Error("Failed to generate a unique referral code.");
}

// Staff directory management is an admin-role feature, gated by the caller's own JWT role — not
// the separate ADMIN_SETTINGS_TOKEN gate (that one locks AI/notification provider config, a
// different concern with its own passcode-entry UI).
function requireAdminRole(req, res, next) {
  if (req.authUser?.role !== "admin") return res.status(403).json({ error: "Admin role required." });
  next();
}

// Internal staff get the full directory; a student or agent only what they'd see next to a name
// in the UI (never emails, phones or referral codes — with those any student could enumerate
// every agent's code and re-attach themselves to whichever agent they liked).
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const { role } = req.query;
    if (role && !STAFF_ROLES.concat("agent").includes(String(role))) return res.json([]);
    const where = role ? { role: String(role) } : undefined;
    const staff = await prisma.staff.findMany({ where, orderBy: { createdAt: "asc" } });
    if (!isInternal(req.authUser)) return res.json(staff.map(publicStaff));
    res.json(await attachHasLogin(staff));
  } catch (err) {
    next(err);
  }
});

// Self-service — any authenticated staff member (agent, counsellor, etc.) can read/edit their own
// directory record without the admin role PATCH /:id below requires. Defined ahead of GET/PATCH
// /:id so the literal path "me" is never swallowed by the :id param route.
router.get("/me", requireAuth, async (req, res, next) => {
  try {
    let staff = await prisma.staff.findUnique({ where: { id: req.authUser.roleUserId } });
    if (!staff) return res.status(404).json({ error: "Staff record not found." });
    // Every agent needs a referral code to share, but nothing backfills it for existing rows — the
    // first time an agent opens their own profile, generate and persist one so it's always ready.
    if (staff.role === "agent" && !staff.referralCode) {
      staff = await assignReferralCode(staff.id);
    }
    res.json(staff);
  } catch (err) {
    next(err);
  }
});

// Public — a prospective student's signup page needs to show "you'll be connected with {agent}"
// before they have an account of their own, so this deliberately isn't behind requireAuth. Only
// exposes what's already meant to be shared alongside the code itself (name/organization), never
// contact details.
router.get("/referral/:code", async (req, res, next) => {
  try {
    const staff = await prisma.staff.findFirst({
      where: { referralCode: req.params.code.toUpperCase(), role: "agent" },
    });
    if (!staff) return res.status(404).json({ error: "Referral code not recognized." });
    res.json({ id: staff.id, name: staff.name, organization: staff.organization });
  } catch (err) {
    next(err);
  }
});

// Only name/email/phone/organization — role and status govern access and stay admin-only (see
// PATCH /:id). Only `name` is synced to the linked User row (the JWT/session and every "performed
// by" attribution elsewhere in the app displays it, so a stale one would look wrong). `email` is
// deliberately NOT synced: Staff.email is a directory/contact address, distinct from User.email
// (the actual login credential) — they're allowed to differ (and do, for every seeded demo
// account), so copying one into the other on every save would silently change someone's login
// email as a side effect of editing their contact details. Changing a login email is a separate,
// more sensitive action this endpoint doesn't attempt.
router.patch("/me", requireAuth, requireStaff, async (req, res, next) => {
  try {
    const { name, email, phone, organization } = req.body || {};
    const id = req.authUser.roleUserId;
    for (const [key, value] of Object.entries({ phone, organization })) {
      if (value !== undefined && value !== null && typeof value !== "string") {
        return res.status(400).json({ error: `${key} must be a string.` });
      }
    }
    if (!(await prisma.staff.findUnique({ where: { id } }))) return res.status(404).json({ error: "Staff record not found." });
    const trimmedName = typeof name === "string" && name.trim() ? name.trim() : undefined;

    const staff = await prisma.$transaction(async (tx) => {
      const updated = await tx.staff.update({
        where: { id },
        data: {
          name: trimmedName,
          email: typeof email === "string" && email.trim() ? email.trim().toLowerCase() : undefined,
          phone: phone !== undefined ? phone || null : undefined,
          organization: organization !== undefined ? organization || null : undefined,
        },
      });
      if (trimmedName) {
        await tx.user.updateMany({ where: { roleUserId: id, role: req.authUser.role }, data: { name: trimmedName } });
      }
      return updated;
    });

    res.json(staff);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That email is already in use." });
    next(err);
  }
});

router.get("/:id", requireAuth, async (req, res, next) => {
  try {
    const staff = await prisma.staff.findUnique({ where: { id: req.params.id } });
    if (!staff) return res.status(404).json({ error: "Staff member not found." });
    if (!isInternal(req.authUser)) return res.json(publicStaff(staff));
    res.json(await attachHasLogin(staff));
  } catch (err) {
    next(err);
  }
});

// `password` is optional, same trade-off as students.js's POST / — without one this member has a
// Staff directory row but no User row at all, so "Invited" genuinely means "can't log in yet" now
// (see the login-time status check in routes/auth.js), not just a cosmetic label. Passing one
// creates a working login in the same transaction and the member starts "Active" immediately.
router.post("/", requireAuth, requireAdminRole, async (req, res, next) => {
  try {
    const { name, email, role, organization, phone, password } = req.body || {};
    if (!name || !email || !role) {
      return res.status(400).json({ error: "name, email and role are required." });
    }
    if (!STAFF_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${STAFF_ROLES.join(", ")}` });
    }
    if (password && String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const count = await prisma.staff.count();
    const staffData = {
      id: `u-${Date.now().toString(36)}`,
      name, email, role, organization, phone,
      status: password ? "Active" : "Invited",
      avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length],
    };

    const staff = password
      ? await prisma.$transaction(async (tx) => {
          const created = await tx.staff.create({ data: staffData });
          const passwordHash = await bcrypt.hash(password, 10);
          await tx.user.create({
            data: { email: String(email).trim().toLowerCase(), passwordHash, name, role, roleUserId: created.id },
          });
          return created;
        })
      : await prisma.staff.create({ data: staffData });

    res.status(201).json({ ...staff, hasLogin: !!password });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That email is already registered." });
    next(err);
  }
});

// Role/status changes now actually reach the linked login, not just the directory row:
// - Changing `role` updates the linked User's role too (looked up by the member's *current* role,
//   before it changes), so a fresh login after the change reflects the new permissions instead of
//   silently keeping the old ones forever. An already-issued JWT still carries the old role until
//   it expires or they log in again — there's no session-revocation list in this app to force that
//   sooner.
// - `password` creates a login for a member who never had one ("Invited" → given a working
//   account for the first time) or resets an existing one — the one and only way to fix "invited
//   but no way to ever log in" after the fact, alongside inviting them fresh with a password.
// - `status: "Inactive"` is enforced at login time (routes/auth.js), not just displayed here.
router.patch("/:id", requireAuth, requireAdminRole, async (req, res, next) => {
  try {
    const { role, status, name, email, phone, organization, password } = req.body || {};
    if (role && !STAFF_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of: ${STAFF_ROLES.join(", ")}` });
    }
    if (password !== undefined && password !== null && (typeof password !== "string" || password.length < 8)) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }
    if (status !== undefined && !STAFF_STATUSES.includes(status)) {
      return res.status(400).json({ error: `status must be one of: ${STAFF_STATUSES.join(", ")}` });
    }
    for (const [key, value] of Object.entries({ name, email, phone, organization })) {
      if (value !== undefined && value !== null && typeof value !== "string") {
        return res.status(400).json({ error: `${key} must be a string.` });
      }
    }

    const existing = await prisma.staff.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Staff member not found." });

    // Setting a password for the first time is what actually makes an "Invited" member usable —
    // move them to Active alongside it unless the caller explicitly asked for a different status
    // in the same request.
    const effectiveStatus = status || (password && existing.status === "Invited" ? "Active" : undefined);

    const staff = await prisma.$transaction(async (tx) => {
      const updated = await tx.staff.update({
        where: { id: req.params.id },
        data: { role, status: effectiveStatus, name, email, phone, organization },
      });

      if (role && role !== existing.role) {
        await tx.user.updateMany({ where: { roleUserId: existing.id, role: existing.role }, data: { role } });
      }

      if (password) {
        const passwordHash = await bcrypt.hash(password, 10);
        const effectiveRole = role || existing.role;
        const currentUser = await tx.user.findFirst({ where: { roleUserId: existing.id, role: effectiveRole } });
        if (currentUser) {
          await tx.user.update({ where: { id: currentUser.id }, data: { passwordHash } });
        } else {
          await tx.user.create({
            data: { email: (email || existing.email).trim().toLowerCase(), passwordHash, name: name || existing.name, role: effectiveRole, roleUserId: existing.id },
          });
        }
      }

      return updated;
    });

    res.json(await attachHasLogin(staff));
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That email is already registered." });
    next(err);
  }
});

// Removing a member also removes their login — otherwise they'd keep signing in with their old
// role (login and requireAuth only ever consulted the Staff row for *status*, and a missing row
// looked exactly like a demo login that never had one). Students/applications they were
// responsible for are unassigned; commission/invoice history stays and blocks the delete (409).
router.delete("/:id", requireAuth, requireAdminRole, async (req, res, next) => {
  try {
    const existing = await prisma.staff.findUnique({ where: { id: req.params.id } });
    if (!existing) return res.status(404).json({ error: "Staff member not found." });
    if (existing.id === req.authUser.roleUserId) {
      return res.status(409).json({ error: "You can't remove your own account." });
    }
    const id = existing.id;
    await prisma.$transaction(async (tx) => {
      await tx.student.updateMany({ where: { agentId: id }, data: { agentId: null } });
      await tx.student.updateMany({ where: { counsellorId: id }, data: { counsellorId: null } });
      await tx.application.updateMany({ where: { responsibleCounsellorId: id }, data: { responsibleCounsellorId: null } });
      await tx.application.updateMany({ where: { responsibleAdmissionOfficerId: id }, data: { responsibleAdmissionOfficerId: null } });
      await tx.teamLead.deleteMany({ where: { staffId: id } });
      await tx.counsellorSettings.deleteMany({ where: { staffId: id } });
      await tx.meeting.deleteMany({ where: { staffId: id } });
      await tx.user.deleteMany({ where: { roleUserId: id, role: existing.role } });
      await tx.staff.delete({ where: { id } });
    });
    res.status(204).end();
  } catch (err) {
    if (err.code === "P2003") {
      return res.status(409).json({ error: "This member still has commission or invoice records — deactivate them instead of removing." });
    }
    next(err);
  }
});

module.exports = router;
