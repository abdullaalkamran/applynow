const { resolveAuthUser, AuthError } = require("./resolveAuthUser");

// See resolveAuthUser.js for what "authenticated" means here (live status/role checks, not just
// a signature check) — it's shared with the Gemini Live WebSocket relay.
async function requireAuth(req, res, next) {
  const header = req.header("authorization") || "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : null;
  try {
    req.authUser = await resolveAuthUser(token);
    next();
  } catch (err) {
    if (err instanceof AuthError) {
      // Lets the client tell "your session is dead" apart from any other 401/403 a route may
      // return on purpose (e.g. a wrong current password), so only the former logs the user out.
      res.setHeader("X-Session-Invalid", "1");
      return res.status(err.status).json({ error: err.message });
    }
    next(err);
  }
}

module.exports = requireAuth;
