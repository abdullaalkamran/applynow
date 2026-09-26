const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { getConfig } = require("../config");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");
const { requireAdminRole } = require("../middleware/access");
const { sendDocumentNotification } = require("../notifications/dispatch");

const router = express.Router();

// Agent is the one role with no admin-direct account creation (see staff.js's STAFF_ROLES, which
// deliberately excludes it) — this is its own self-service signup-by-invite flow instead.
const AVATAR_COLORS = ["bg-sky-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-indigo-500", "bg-teal-500"];
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, roleUserId: user.roleUserId },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );
}

function toPublicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, roleUserId: user.roleUserId };
}

async function emailAlreadyRegistered(email) {
  const [staff, user] = await Promise.all([
    prisma.staff.findUnique({ where: { email } }),
    prisma.user.findUnique({ where: { email } }),
  ]);
  return Boolean(staff || user);
}

/** An invite that's missing, expired, or already accepted all read the same to a caller — none of
 * them are usable — so every route below shares this one lookup+classification. */
async function findUsableInvite(token) {
  const invite = await prisma.agentInvite.findUnique({ where: { token } });
  if (!invite) return { invite: null, reason: "not_found" };
  if (invite.acceptedAt) return { invite, reason: "accepted" };
  if (invite.expiresAt < new Date()) return { invite, reason: "expired" };
  return { invite, reason: null };
}

// Admin creates an invite — sends a real email (via whichever EMAIL_PROVIDER is configured; a
// stub provider just logs instead of sending, same trade-off as every other notification in this
// app) and also returns the accept link directly, so the admin can copy/share it themselves
// regardless of whether email delivery is actually configured yet.
router.post("/", requireAuth, requireAdminRole, async (req, res, next) => {
  try {
    const { name, email: rawEmail, organization } = req.body || {};
    const email = typeof rawEmail === "string" ? rawEmail.trim().toLowerCase() : "";
    if (!name || !email || !EMAIL_RE.test(email)) {
      return res.status(400).json({ error: "A name and a valid email are required." });
    }
    if (await emailAlreadyRegistered(email)) {
      return res.status(409).json({ error: "That email is already registered." });
    }

    // Re-inviting the same not-yet-accepted email just refreshes it with a fresh token/expiry —
    // acts as a "resend" without leaving stale duplicate invites behind.
    await prisma.agentInvite.deleteMany({ where: { email, acceptedAt: null } });

    const token = crypto.randomBytes(32).toString("hex");
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);
    const invite = await prisma.agentInvite.create({
      data: { token, name: String(name).trim(), email, organization: organization || null, invitedBy: req.authUser.sub, expiresAt },
    });

    const acceptUrl = `${getConfig().frontendOrigins[0]}/accept-invite/${token}`;
    sendDocumentNotification({
      subject: "You're invited to join UnifinderAi as an agent",
      message: `Hi ${invite.name}, you've been invited to create an agent account on UnifinderAi. Set up your account here: ${acceptUrl}\n\nThis link expires in 7 days.`,
      recipients: [{ channel: "email", to: invite.email }],
    }).catch((err) => console.warn("Agent invite email failed to send:", err));

    res.status(201).json({ name: invite.name, email: invite.email, organization: invite.organization, expiresAt: invite.expiresAt, acceptUrl });
  } catch (err) {
    next(err);
  }
});

// Public — the accept page uses this to show who's being invited before asking for a password.
router.get("/:token", async (req, res, next) => {
  try {
    const { invite, reason } = await findUsableInvite(req.params.token);
    if (reason === "not_found") return res.status(404).json({ error: "Invite not found." });
    if (reason === "accepted") return res.status(410).json({ error: "This invite has already been used." });
    if (reason === "expired") return res.status(410).json({ error: "This invite has expired." });
    res.json({ name: invite.name, email: invite.email, organization: invite.organization });
  } catch (err) {
    next(err);
  }
});

// Public — the invitee sets their own password here, which creates their real Staff+User rows and
// logs them straight in (same response shape as POST /api/auth/login, for the frontend to reuse).
router.post("/:token/accept", async (req, res, next) => {
  try {
    const { password } = req.body || {};
    if (typeof password !== "string" || password.length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    const { invite, reason } = await findUsableInvite(req.params.token);
    if (reason === "not_found") return res.status(404).json({ error: "Invite not found." });
    if (reason === "accepted") return res.status(410).json({ error: "This invite has already been used." });
    if (reason === "expired") return res.status(410).json({ error: "This invite has expired." });
    if (await emailAlreadyRegistered(invite.email)) {
      return res.status(409).json({ error: "That email is already registered." });
    }

    const count = await prisma.staff.count();
    const staffId = `agent-${Date.now().toString(36)}`;
    const passwordHash = await bcrypt.hash(password, 10);

    const user = await prisma.$transaction(async (tx) => {
      await tx.staff.create({
        data: {
          id: staffId,
          name: invite.name,
          email: invite.email,
          role: "agent",
          status: "Active",
          organization: invite.organization,
          avatarColor: AVATAR_COLORS[count % AVATAR_COLORS.length],
        },
      });
      const created = await tx.user.create({
        data: { email: invite.email, passwordHash, name: invite.name, role: "agent", roleUserId: staffId },
      });
      await tx.agentInvite.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
      return created;
    });

    res.json({ token: issueToken(user), user: toPublicUser(user) });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That email is already registered." });
    next(err);
  }
});

module.exports = router;
