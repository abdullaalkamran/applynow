// Service authentication for the portal worker (portal-worker/), which runs as a separate process with no user
// session. A shared secret in WORKER_API_TOKEN, compared in constant time; unset = worker routes are disabled.
const crypto = require("crypto");

function workerAuth(req, res, next) {
  const expected = process.env.WORKER_API_TOKEN || "";
  if (expected.length < 24) return res.status(503).json({ error: "Portal worker access isn't configured." });
  const header = req.header("authorization") || "";
  const given = header.startsWith("Bearer ") ? header.slice(7) : "";
  const a = crypto.createHash("sha256").update(given).digest();
  const b = crypto.createHash("sha256").update(expected).digest();
  if (!crypto.timingSafeEqual(a, b)) return res.status(401).json({ error: "Invalid worker token." });
  next();
}

module.exports = workerAuth;
