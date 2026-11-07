// Edit the public About page (Data Management and admin). The public page reads it through GET /api/public/about.
const express = require("express");
const requireAuth = require("../middleware/requireAuth");
const { requireDataRole } = require("../middleware/access");
const { invalidateSeoCache } = require("../seo");
const { loadAbout, saveAbout, resetAbout } = require("../aboutPage");

const router = express.Router();
const shape = (a) => ({ ...a.content, isDefault: a.isDefault, updatedAt: a.updatedAt ? new Date(a.updatedAt).toISOString() : null });

router.get("/", requireAuth, requireDataRole, async (_req, res, next) => {
  try { res.json(shape(await loadAbout())); } catch (err) { next(err); }
});

router.put("/", requireAuth, requireDataRole, async (req, res, next) => {
  try {
    await saveAbout(req.body, req.authUser.name || req.authUser.roleUserId || null);
    invalidateSeoCache();
    res.json(shape(await loadAbout()));
  } catch (err) {
    if (err.status === 400) return res.status(400).json({ error: err.message });
    next(err);
  }
});

// Back to the built-in text.
router.delete("/", requireAuth, requireDataRole, async (_req, res, next) => {
  try {
    await resetAbout();
    invalidateSeoCache();
    res.json(shape(await loadAbout()));
  } catch (err) { next(err); }
});

module.exports = router;
