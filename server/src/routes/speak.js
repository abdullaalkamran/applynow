const express = require("express");
const { getConfig } = require("../config");

// The other half of turn-based real voice: takes the assistant's final text reply and returns
// spoken audio (mp3) from OpenAI's TTS endpoint, for the frontend to play instead of speechSynthesis.
const router = express.Router();

router.post("/", async (req, res, next) => {
  try {
    const config = getConfig();
    const { text } = req.body || {};

    if (!config.openai.apiKey) {
      return res.status(500).json({
        error: "OPENAI_API_KEY is not set — real voice needs an OpenAI key even if a different provider handles reasoning.",
      });
    }
    if (typeof text !== "string" || !text.trim()) {
      return res.status(400).json({ error: "Request must include { text: string }" });
    }

    const response = await fetch("https://api.openai.com/v1/audio/speech", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        authorization: `Bearer ${config.openai.apiKey}`,
      },
      body: JSON.stringify({
        model: config.openai.ttsModel,
        voice: config.openai.ttsVoice,
        input: text,
        response_format: "mp3",
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw Object.assign(new Error(`OpenAI speech error: ${response.status} ${detail}`), { status: 502 });
    }

    const audioBuffer = Buffer.from(await response.arrayBuffer());
    res.set("content-type", "audio/mpeg");
    res.send(audioBuffer);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
