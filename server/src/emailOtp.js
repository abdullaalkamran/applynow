// Email one-time codes for students and agents: verifying an email when an account is created, and confirming a
// password change. Staff and admin accounts never go through this.
const crypto = require("crypto");
const prisma = require("./prismaClient");
const { getConfig } = require("./config");
const { getEmailProvider } = require("./notifications");

const CODE_TTL_MS = 10 * 60 * 1000;
const RESEND_COOLDOWN_MS = 45 * 1000;
const MAX_ATTEMPTS = 5;
const MAX_SENDS_PER_HOUR = 6;

const PURPOSES = new Set(["signup", "agent_signup", "password_change"]);
const PURPOSE_LABEL = {
  signup: "create your UnifinderAi account",
  agent_signup: "create your UnifinderAi agent account",
  password_change: "change your UnifinderAi password",
};

function fail(status, message) {
  return Object.assign(new Error(message), { status });
}

function hashCode(email, purpose, code) {
  return crypto.createHmac("sha256", getConfig().jwtSecret).update(`${email}:${purpose}:${code}`).digest("hex");
}

/** Creates a fresh 6-digit code for (email, purpose), emails it, and invalidates any earlier unused one. */
async function issueOtp(rawEmail, purpose) {
  if (!PURPOSES.has(purpose)) throw fail(400, "Unknown verification purpose.");
  const email = String(rawEmail).trim().toLowerCase();
  const now = Date.now();

  const recent = await prisma.emailOtp.findMany({
    where: { email, purpose, createdAt: { gt: new Date(now - 60 * 60 * 1000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent[0] && now - recent[0].createdAt.getTime() < RESEND_COOLDOWN_MS) {
    const wait = Math.ceil((RESEND_COOLDOWN_MS - (now - recent[0].createdAt.getTime())) / 1000);
    throw fail(429, `Please wait ${wait}s before asking for another code.`);
  }
  if (recent.length >= MAX_SENDS_PER_HOUR) throw fail(429, "Too many codes requested — try again in a little while.");

  const config = getConfig();
  const production = process.env.NODE_ENV === "production";
  if (config.emailProvider === "stub" && production) {
    // Never silently accept an account (or a password change) that nobody could ever have verified.
    throw fail(503, "Email delivery isn't set up on the server yet, so verification codes can't be sent. Please contact support.");
  }

  const code = String(crypto.randomInt(0, 1_000_000)).padStart(6, "0");
  await prisma.emailOtp.updateMany({ where: { email, purpose, consumedAt: null }, data: { consumedAt: new Date() } });
  const row = await prisma.emailOtp.create({
    data: { email, purpose, codeHash: hashCode(email, purpose, code), expiresAt: new Date(now + CODE_TTL_MS) },
  });

  try {
    const provider = getEmailProvider(config.emailProvider);
    await provider.send({
      to: email,
      subject: "Your UnifinderAi verification code",
      message: `Your UnifinderAi verification code is ${code}.\n\nUse it to ${PURPOSE_LABEL[purpose]}. It expires in 10 minutes. If you didn't ask for this, you can ignore this email — nothing will change.`,
    });
  } catch (err) {
    await prisma.emailOtp.delete({ where: { id: row.id } }).catch(() => {});
    console.error("OTP email failed to send:", err);
    throw fail(502, "We couldn't send the verification email. Please try again in a moment.");
  }
  if (config.emailProvider === "stub") console.log(`[otp:stub] ${purpose} code for ${email}: ${code}`);
  return { expiresInSeconds: CODE_TTL_MS / 1000, resendAfterSeconds: RESEND_COOLDOWN_MS / 1000 };
}

/** Checks a code without using it up; returns the row to pass to consumeOtp(). Throws a 400 with a clear message. */
async function checkOtp(rawEmail, purpose, rawCode) {
  const email = String(rawEmail).trim().toLowerCase();
  const code = String(rawCode || "").trim();
  if (!/^\d{6}$/.test(code)) throw fail(400, "Enter the 6-digit code from your email.");

  const row = await prisma.emailOtp.findFirst({
    where: { email, purpose, consumedAt: null },
    orderBy: { createdAt: "desc" },
  });
  if (!row || row.expiresAt.getTime() < Date.now()) throw fail(400, "That code has expired — request a new one.");
  if (row.attempts >= MAX_ATTEMPTS) throw fail(400, "Too many wrong attempts — request a new code.");

  const expected = Buffer.from(row.codeHash, "hex");
  const given = Buffer.from(hashCode(email, purpose, code), "hex");
  const ok = expected.length === given.length && crypto.timingSafeEqual(expected, given);
  if (!ok) {
    await prisma.emailOtp.update({ where: { id: row.id }, data: { attempts: { increment: 1 } } });
    throw fail(400, "That code isn't right.");
  }
  return row;
}

async function consumeOtp(row) {
  await prisma.emailOtp.update({ where: { id: row.id }, data: { consumedAt: new Date() } });
}

module.exports = { issueOtp, checkOtp, consumeOtp };
