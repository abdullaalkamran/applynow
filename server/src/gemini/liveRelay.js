const WebSocket = require("ws");
const jwt = require("jsonwebtoken");
const { getConfig } = require("../config");
const { toGeminiTools, toGeminiFunctionResponse } = require("../providers/geminiProvider");

const googleLiveUrl = (apiKey) =>
  `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`;

/**
 * Relays a browser <-> our server <-> Google Gemini Live realtime voice session.
 *
 * Audio passes straight through both directions. Tool calls are the one thing this relay can't
 * just forward blindly: Gemini's tool calls need to run against the browser's own localStorage
 * (this server has no access to it), so a `toolCall` from Google is forwarded to the browser as a
 * `tool_call` message, and the browser's `tool_result` reply is relayed back to Google as a
 * `toolResponse` — the same tool definitions used by the text-based assistant, just executed over
 * a different transport.
 *
 * The Gemini Live API is a newer, still-evolving protocol — the message shapes here follow
 * Google's Multimodal/Gemini Live API docs as of this writing; if Google changes field names,
 * this is the one file that needs to track it.
 */
function attachGeminiLiveRelay(wss) {
  wss.on("connection", (clientSocket) => {
    let googleSocket = null;
    let closed = false;

    const sendToClient = (payload) => {
      if (clientSocket.readyState === WebSocket.OPEN) clientSocket.send(JSON.stringify(payload));
    };

    const closeAll = (errorMessage) => {
      if (closed) return;
      closed = true;
      if (errorMessage) sendToClient({ type: "error", message: errorMessage });
      try { googleSocket?.close(); } catch { /* already closing */ }
      try { clientSocket.close(); } catch { /* already closing */ }
    };

    function handleGoogleMessage(raw) {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (message.setupComplete) {
        sendToClient({ type: "ready" });
        return;
      }

      const serverContent = message.serverContent;
      if (serverContent) {
        const parts = serverContent.modelTurn?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) sendToClient({ type: "audio", data: part.inlineData.data });
        }
        if (serverContent.outputTranscription?.text) {
          sendToClient({ type: "text", text: serverContent.outputTranscription.text });
        }
        if (serverContent.inputTranscription?.text) {
          sendToClient({ type: "input_text", text: serverContent.inputTranscription.text });
        }
        if (serverContent.turnComplete) sendToClient({ type: "turn_complete" });
      }

      const functionCalls = message.toolCall?.functionCalls;
      if (functionCalls?.length) {
        for (const call of functionCalls) {
          sendToClient({ type: "tool_call", id: call.id, name: call.name, arguments: call.args || {} });
        }
      }
    }

    function startGoogleSession(init) {
      const config = getConfig();

      // Opening this session spends real Gemini API cost — same gate as the REST assistant
      // endpoints (requireAuth), just applied to a WebSocket's first message instead of a header,
      // since a browser WebSocket can't set a custom Authorization header on the handshake.
      try {
        jwt.verify(init.token || "", config.jwtSecret);
      } catch {
        closeAll("Not authenticated — please log in again.");
        return;
      }

      if (!config.gemini.apiKey) {
        closeAll("GEMINI_API_KEY is not set on the server.");
        return;
      }

      googleSocket = new WebSocket(googleLiveUrl(config.gemini.apiKey));

      googleSocket.on("open", () => {
        googleSocket.send(
          JSON.stringify({
            setup: {
              model: `models/${config.gemini.liveModel}`,
              // Native-audio models "think" before speaking by default, which is a real source of
              // response latency in a live voice conversation — thinkingBudget: 0 disables that
              // for the fastest turnaround (see thinkingConfig docs for gemini-2.5-* models).
              generationConfig: { responseModalities: ["AUDIO"], thinkingConfig: { thinkingBudget: 0 } },
              systemInstruction: { parts: [{ text: init.systemPrompt || "" }] },
              tools: toGeminiTools(init.tools || []),
              outputAudioTranscription: {},
              // Lets us see exactly what Gemini heard the user say — essential for telling apart
              // "the tool call didn't happen" from "the transcription was wrong so it never asked".
              inputAudioTranscription: {},
            },
          })
        );
      });

      googleSocket.on("message", handleGoogleMessage);
      googleSocket.on("error", (err) => {
        console.error("Gemini Live upstream error:", err.message);
        closeAll(`Gemini Live connection error: ${err.message}`);
      });
      googleSocket.on("close", (code, reason) => {
        const reasonText = reason?.toString();
        console.error("Gemini Live upstream closed:", code, reasonText);
        if (code !== 1000) {
          closeAll(`Gemini Live closed the connection (code ${code}${reasonText ? `: ${reasonText}` : ""}).`);
        } else {
          closeAll();
        }
      });
    }

    clientSocket.on("message", (raw) => {
      let message;
      try {
        message = JSON.parse(raw.toString());
      } catch {
        return;
      }

      if (message.type === "init") {
        startGoogleSession(message);
        return;
      }

      if (!googleSocket || googleSocket.readyState !== WebSocket.OPEN) return;

      if (message.type === "audio" && message.data) {
        googleSocket.send(
          JSON.stringify({ realtimeInput: { audio: { mimeType: "audio/pcm;rate=16000", data: message.data } } })
        );
        return;
      }

      if (message.type === "greet" && typeof message.text === "string") {
        googleSocket.send(
          JSON.stringify({ clientContent: { turns: [{ role: "user", parts: [{ text: message.text }] }], turnComplete: true } })
        );
        return;
      }

      if (message.type === "tool_result") {
        googleSocket.send(
          JSON.stringify({
            toolResponse: { functionResponses: [{ id: message.id, name: message.name, response: toGeminiFunctionResponse(message.result) }] },
          })
        );
        return;
      }

      if (message.type === "stop") closeAll();
    });

    clientSocket.on("close", () => closeAll());
    clientSocket.on("error", () => closeAll());
  });
}

module.exports = { attachGeminiLiveRelay };
