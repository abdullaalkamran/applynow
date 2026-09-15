const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { sendStatusNotification } = require("../notifications/dispatch");

const router = express.Router();

// Any signed-in role can trigger this about an application they just updated — the actual
// send is gated by the admin's per-status rule, not by who's asking, since every trigger site in
// the app already only calls this from a real status-change action a real actor just made.
router.post("/send", requireAuth, async (req, res, next) => {
  try {
    const { status, recipients, variables } = req.body || {};
    if (typeof status !== "string" || !Array.isArray(recipients) || typeof variables !== "object") {
      return res.status(400).json({ error: "Request must include { status: string, recipients: array, variables: object }" });
    }
    res.json(await sendStatusNotification({ status, recipients, variables }));
  } catch (err) {
    next(err);
  }
});

module.exports = router;
