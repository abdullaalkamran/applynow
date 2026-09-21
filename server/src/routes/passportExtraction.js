const express = require("express");
const multer = require("multer");
const requireAuth = require("../middleware/requireAuth");
const { extractPassport } = require("../passportExtraction");

const router = express.Router();

// The image is only ever held in memory for the length of this request, then handed to the AI
// provider and discarded — unlike routes/documents.js's uploads, a passport scanned here for
// auto-fill isn't itself a document the student is submitting, so there's nothing to keep on disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });

// Every call here spends real money against a real AI provider (once one is configured) and
// handles a passport image — behind a logged-in student session only, same bar as /api/assistant.
router.post("/", requireAuth, upload.single("file"), async (req, res, next) => {
  try {
    if (req.authUser.role !== "student") {
      return res.status(403).json({ error: "Only a student can scan their own passport." });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No image uploaded." });
    }
    if (!req.file.mimetype.startsWith("image/")) {
      return res.status(400).json({ error: "Upload an image of the passport's data page." });
    }
    const result = await extractPassport({ imageBuffer: req.file.buffer, mimeType: req.file.mimetype });
    res.json(result);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
