const { getConfig } = require("../config");

// The admin token is env-only (see config.js) — nothing behind this gate can change the key that
// locks the gate itself. Fails closed: if no token is configured, the settings API is disabled
// entirely rather than silently open to anyone who loads the page.
function requireAdmin(req, res, next) {
  const { adminToken } = getConfig();
  if (!adminToken) {
    return res.status(503).json({ error: "Admin settings are disabled — set ADMIN_SETTINGS_TOKEN on the server to enable them." });
  }
  if (req.header("x-admin-token") !== adminToken) {
    return res.status(401).json({ error: "Invalid admin token." });
  }
  next();
}

module.exports = requireAdmin;
