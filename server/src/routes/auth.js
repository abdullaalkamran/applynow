const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const crypto = require("crypto");
const { OAuth2Client } = require("google-auth-library");
const { getConfig } = require("../config");
const prisma = require("../prismaClient");
const requireAuth = require("../middleware/requireAuth");

const router = express.Router();

const AVATAR_COLORS = ["bg-sky-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-indigo-500", "bg-teal-500"];

function toPublicUser(user) {
  return { id: user.id, email: user.email, name: user.name, role: user.role, roleUserId: user.roleUserId };
}

// Every non-student role is backed by a Staff directory row admin's Teams & Roles page can set to
// "Inactive" — without this check that status was purely cosmetic, since login only ever looked at
// the User row, never the linked Staff record (see routes/staff.js's PATCH /:id, which now also
// syncs a role change to the login instead of leaving it stale).
async function isDeactivatedStaff(user) {
  if (user.role === "student") return false;
  const staff = await prisma.staff.findUnique({ where: { id: user.roleUserId } });
  return staff?.status === "Inactive";
}

function issueToken(user) {
  return jwt.sign(
    { sub: user.id, role: user.role, name: user.name, roleUserId: user.roleUserId },
    getConfig().jwtSecret,
    { expiresIn: "7d" }
  );
}

router.post("/login", async (req, res, next) => {
  try {
    const { email, password } = req.body || {};
    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required." });
    }

    const user = await prisma.user.findUnique({ where: { email: String(email).toLowerCase() } });
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) {
      return res.status(401).json({ error: "Incorrect email or password." });
    }
    if (await isDeactivatedStaff(user)) {
      return res.status(403).json({ error: "This account has been deactivated. Contact an administrator." });
    }

    res.json({ token: issueToken(user), user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// Public self-service signup — students only. Staff/agent accounts stay admin-invite-only (see
// staff.js's POST /), but a prospective student needs a way to create their own account, optionally
// arriving via an agent's referral link/QR/code, which auto-connects them to that agent instead of
// leaving them unassigned until a counsellor manually links them up later.
router.post("/register", async (req, res, next) => {
  try {
    const { name, email, password, country, referralCode } = req.body || {};
    if (!name || !email || !password || !country) {
      return res.status(400).json({ error: "Name, email, password and country are required." });
    }
    if (String(password).length < 8) {
      return res.status(400).json({ error: "Password must be at least 8 characters." });
    }

    let agent = null;
    if (referralCode) {
      agent = await prisma.staff.findFirst({ where: { referralCode: String(referralCode).toUpperCase(), role: "agent" } });
      if (!agent) return res.status(400).json({ error: "Referral code not recognized." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const passwordHash = await bcrypt.hash(password, 10);
    const studentCount = await prisma.student.count();
    const studentId = `st-${Date.now().toString(36)}`;

    const user = await prisma.$transaction(async (tx) => {
      await tx.student.create({
        data: {
          id: studentId,
          name: String(name).trim(),
          email: normalizedEmail,
          country: String(country).trim(),
          agentId: agent?.id,
          avatarColor: AVATAR_COLORS[studentCount % AVATAR_COLORS.length],
          riskFlag: "none",
        },
      });
      return tx.user.create({
        data: { email: normalizedEmail, passwordHash, name: String(name).trim(), role: "student", roleUserId: studentId },
      });
    });

    res.status(201).json({ token: issueToken(user), user: toPublicUser(user), agentName: agent?.name });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That email is already registered." });
    next(err);
  }
});

// Sign in with Google, one endpoint for both cases: an existing account (any role) logs straight
// in, and an email Google has never been seen with before gets a brand-new student account —
// mirroring /register's referral-code handling, since a Google-signup can arrive via the same
// agent link/QR just as a password one can. `credential` is the ID token Google Identity Services
// hands the frontend button; it's verified here, server-side, never trusted as-is from the client.
router.post("/google", async (req, res, next) => {
  try {
    const { googleClientId } = getConfig();
    if (!googleClientId) {
      return res.status(503).json({ error: "Google sign-in isn't configured yet." });
    }
    const { credential, referralCode } = req.body || {};
    if (!credential) {
      return res.status(400).json({ error: "Missing Google credential." });
    }

    const client = new OAuth2Client(googleClientId);
    let payload;
    try {
      const ticket = await client.verifyIdToken({ idToken: credential, audience: googleClientId });
      payload = ticket.getPayload();
    } catch {
      return res.status(401).json({ error: "Invalid or expired Google credential." });
    }
    if (!payload?.email || !payload.email_verified) {
      return res.status(401).json({ error: "Your Google account has no verified email." });
    }
    const normalizedEmail = payload.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });
    if (existing) {
      if (await isDeactivatedStaff(existing)) {
        return res.status(403).json({ error: "This account has been deactivated. Contact an administrator." });
      }
      return res.json({ token: issueToken(existing), user: toPublicUser(existing) });
    }

    let agent = null;
    if (referralCode) {
      agent = await prisma.staff.findFirst({ where: { referralCode: String(referralCode).toUpperCase(), role: "agent" } });
      if (!agent) return res.status(400).json({ error: "Referral code not recognized." });
    }

    const name = payload.name || normalizedEmail.split("@")[0];
    const studentCount = await prisma.student.count();
    const studentId = `st-${Date.now().toString(36)}`;
    // Never actually used to log in (that path is /login, which this account has no password
    // for) — just satisfies the column's NOT NULL constraint with something unguessable.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 10);

    const user = await prisma.$transaction(async (tx) => {
      await tx.student.create({
        data: {
          id: studentId,
          name,
          email: normalizedEmail,
          // Left blank — collected later via Personal Information, same as every other
          // profile field that isn't safe to assume from a Google account.
          country: "",
          agentId: agent?.id,
          avatarColor: AVATAR_COLORS[studentCount % AVATAR_COLORS.length],
          riskFlag: "none",
        },
      });
      return tx.user.create({
        data: { email: normalizedEmail, passwordHash, name, role: "student", roleUserId: studentId },
      });
    });

    res.status(201).json({ token: issueToken(user), user: toPublicUser(user), agentName: agent?.name });
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ error: "That email is already registered." });
    next(err);
  }
});

router.get("/me", requireAuth, async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.authUser.sub } });
    if (!user) return res.status(401).json({ error: "Account no longer exists." });
    res.json({ user: toPublicUser(user) });
  } catch (err) {
    next(err);
  }
});

// Self-service — any authenticated role (student, agent, staff) can change their own login
// password, given the current one. Google-only accounts (a random, never-shared hash — see POST
// /google) can never supply a correct current password here; there's no password-reset flow in
// this app yet, so those accounts have no path to add one. Out of scope for now.
router.post("/change-password", requireAuth, async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body || {};
    if (!currentPassword || !newPassword) {
      return res.status(400).json({ error: "Current and new password are required." });
    }
    if (String(newPassword).length < 8) {
      return res.status(400).json({ error: "New password must be at least 8 characters." });
    }
    const user = await prisma.user.findUnique({ where: { id: req.authUser.sub } });
    if (!user || !(await bcrypt.compare(currentPassword, user.passwordHash))) {
      return res.status(401).json({ error: "Current password is incorrect." });
    }
    const passwordHash = await bcrypt.hash(newPassword, 10);
    await prisma.user.update({ where: { id: user.id }, data: { passwordHash } });
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
