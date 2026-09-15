const express = require("express");
const requireAdmin = require("../middleware/requireAdmin");
const { readRules, updateRules } = require("../notificationRulesStore");

const router = express.Router();

router.get("/", requireAdmin, (_req, res) => {
  res.json({ rules: readRules() });
});

// Body: { rules: [{ status, enabled?, whatsappTemplate?, emailTemplate? }] } — merged per-status
// onto what's stored, so the admin can save just the rows they touched.
router.put("/", requireAdmin, (req, res) => {
  const rules = req.body?.rules;
  if (!Array.isArray(rules)) {
    return res.status(400).json({ error: "Request must include { rules: array }" });
  }
  const next = updateRules(rules);
  res.json({ ok: true, rules: next });
});

module.exports = router;
