const express = require("express");
const multer = require("multer");
const requireAuth = require("../middleware/requireAuth");
const { requireStaff } = require("../middleware/access");
const { extractProfile } = require("../profileExtraction");

const router = express.Router();
// Held in memory for this request only, handed to the AI provider, then discarded — the counsellor decides what
// (if anything) gets saved after reviewing the proposal.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024, files: 8 } });

router.post("/", requireAuth, requireStaff, (req, res, next) => {
  upload.array("files", 8)(req, res, async (uploadErr) => {
    if (uploadErr) return res.status(400).json({ error: uploadErr.code === "LIMIT_FILE_SIZE" ? "A file is too large (max 15 MB)." : "Upload failed (max 8 files)." });
    try {
      if (!req.files || req.files.length === 0) return res.status(400).json({ error: "No files uploaded." });
      res.json(await extractProfile(req.files));
    } catch (err) {
      next(err);
    }
  });
});

module.exports = router;
