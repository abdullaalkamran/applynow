const jwt = require("jsonwebtoken");
const { getConfig } = require("../config");
const prisma = require("../prismaClient");

class AuthError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

/**
 * Turns a bearer token into the live `authUser` every route (and the Gemini Live relay) trusts.
 * Shared so a WebSocket session can't be opened with a token the HTTP API would reject.
 *
 * A JWT is valid for 7 days regardless of what happens to the account after it's issued. Without
 * the checks here, an admin deactivating someone in Teams & Roles (routes/staff.js) would only
 * block their *next* login, leaving an already-open session fully working for up to a week —
 * checked on every request instead, so it takes effect immediately. The same staleness applied to
 * a role change: the token's `role` claim is a snapshot from whenever it was issued, so a
 * promotion/demotion is re-applied here from the current Staff row on every request too. A
 * student whose account was deleted (routes/students.js DELETE) is likewise cut off at once.
 *
 * Not every non-student login has a matching Staff directory row — the seeded per-role demo
 * logins (admission@studyone.dev, compliance@studyone.dev, etc.) use roleUserId values ("admin",
 * "admission", ...) that were never added as real Teams & Roles members, so there's nothing to
 * look up. Treated as "not directory-managed" and left alone rather than locked out for a data
 * gap that isn't theirs.
 */
async function resolveAuthUser(token) {
  if (!token) throw new AuthError(401, "Missing bearer token.");

  let authUser;
  try {
    authUser = jwt.verify(token, getConfig().jwtSecret, { algorithms: ["HS256"] });
  } catch {
    throw new AuthError(401, "Invalid or expired session — please log in again.");
  }
  if (!authUser || typeof authUser !== "object" || typeof authUser.roleUserId !== "string" || typeof authUser.role !== "string") {
    throw new AuthError(401, "Invalid or expired session — please log in again.");
  }

  if (authUser.role === "student") {
    const student = await prisma.student.findUnique({ where: { id: authUser.roleUserId }, select: { id: true } });
    if (!student) throw new AuthError(401, "This account no longer exists — please log in again.");
    return authUser;
  }

  const staff = await prisma.staff.findUnique({ where: { id: authUser.roleUserId } });
  if (staff) {
    if (staff.status === "Inactive") {
      throw new AuthError(403, "This account has been deactivated. Contact an administrator.");
    }
    if (staff.role !== authUser.role) authUser.role = staff.role;
    return authUser;
  }
  // No directory row: either a seeded demo login (still has its User row) or a member an admin
  // has since removed (routes/staff.js DELETE takes the User row with it) — only the former may
  // continue.
  const user = typeof authUser.sub === "string" ? await prisma.user.findUnique({ where: { id: authUser.sub }, select: { id: true } }) : null;
  if (!user) throw new AuthError(401, "This account no longer exists — please log in again.");
  return authUser;
}

module.exports = { resolveAuthUser, AuthError };
