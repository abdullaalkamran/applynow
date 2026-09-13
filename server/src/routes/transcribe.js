const express = require("express");
const multer = require("multer");
const { getConfig } = require("../config");
const requireAuth = require("../middleware/requireAuth");

// Turn-based real voice input: the browser records a clip (MediaRecorder) and posts it here as
// multipart/form-data; we forward it to OpenAI's Whisper endpoint and hand back plain text, which
// then flows through the exact same runAssistantTurn/tool-calling loop as typed chat.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 15 * 1024 * 1024 } });
const router = express.Router();

// requireAuth runs before multer — reject an unauthenticated request before spending effort
// parsing its (potentially large) body, and before it can spend real Whisper API cost.
router.post("/", requireAuth, upload.single("audio"), async (req, res, next) => {
  try {
    const config = getConfig();
    if (!config.openai.apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not set — real voice needs an OpenAI key even if a different provider handles reasoning.",
      });
    }
    if (!req.file) {
      return res.status(400).json({ error: "No audio file provided (expected a multipart field named 'audio')." });
    }

    const form = new FormData();
    form.append("file", new Blob([req.file.buffer], { type: req.file.mimetype || "audio/webm" }), "audio.webm");
    form.append("model", config.openai.whisperModel);

    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: { authorization: `Bearer ${config.openai.apiKey}` },
      body: form,
    });

    if (!response.ok) {
      const detail = await response.text();
      throw Object.assign(new Error(`OpenAI transcription error: ${response.status} ${detail}`), { status: 502 });
    }

    const data = await response.json();
    res.json({ text: data.text || "" });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
