const jwt = require("jsonwebtoken");
const { getConfig } = require("../config");

function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Missing bearer token." });

  try {
    req.authUser = jwt.verify(token, getConfig().jwtSecret);
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired session — please log in again." });
  }
}

module.exports = requireAuth;
