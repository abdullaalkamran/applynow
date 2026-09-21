const jwt = require("jsonwebtoken");
const { getConfig } = require("../config");
const prisma = require("../prismaClient");

async function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token." });

  let authUser;
  try {
    authUser = jwt.verify(token, getConfig().jwtSecret);
  } catch {
    return res.status(401).json({ error: "Invalid or expired session — please log in again." });
  }

  // A JWT is valid for 7 days regardless of what happens to the account after it's issued. Without
  // this, an admin deactivating someone in Teams & Roles (routes/staff.js) would only block their
  // *next* login, leaving an already-open session fully working for up to a week — checked on
  // every request instead, so it takes effect immediately. The same staleness applied to a role
  // change: the token's `role` claim is a snapshot from whenever it was issued, so a promotion/
  // demotion is re-applied here from the current Staff row on every request too, rather than
  // silently keeping someone on their old permissions until they happen to log in again.
  //
  // Not every non-student login has a matching Staff directory row — the seeded per-role demo
  // logins (admission@studyone.dev, compliance@studyone.dev, etc.) use roleUserId values ("admin",
  // "admission", ...) that were never added as real Teams & Roles members, so there's nothing to
  // look up. Treated as "not directory-managed" and left alone, exactly like before this check
  // existed, rather than locked out for a data gap that isn't theirs.
  if (authUser.role !== "student") {
    try {
      const staff = await prisma.staff.findUnique({ where: { id: authUser.roleUserId } });
      if (staff) {
        if (staff.status === "Inactive") {
          return res.status(403).json({ error: "This account has been deactivated. Contact an administrator." });
        }
        if (staff.role !== authUser.role) authUser.role = staff.role;
      }
    } catch (err) {
      return next(err);
    }
  }

  req.authUser = authUser;
  next();
}

module.exports = requireAuth;
