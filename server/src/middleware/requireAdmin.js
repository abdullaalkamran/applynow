const crypto = require("crypto");
const { getConfig } = require("../config");

/** Constant-time string comparison — `!==` short-circuits on the first differing byte, which
 * lets an attacker with enough timing samples recover the token one character at a time. */
function safeEqual(a, b) {
  const left = Buffer.from(String(a));
  const right = Buffer.from(String(b));
  if (left.length !== right.length) return false;
  return crypto.timingSafeEqual(left, right);
}

// The admin token is env-only (see config.js) — nothing behind this gate can change the key that
// locks the gate itself. Fails closed: if no token is configured, the settings API is disabled
// entirely rather than silently open to anyone who loads the page.
function requireAdmin(req, res, next) {
  const { adminToken } = getConfig();
  if (!adminToken) {
    return res.status(503).json({ error: "Admin settings are disabled — set ADMIN_SETTINGS_TOKEN on the server to enable them." });
  }
  if (!safeEqual(req.header("x-admin-token") || "", adminToken)) {
    return res.status(401).json({ error: "Invalid admin token." });
  }
  next();
}

module.exports = requireAdmin;
