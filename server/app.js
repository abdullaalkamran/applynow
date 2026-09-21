// Passenger entry point (cPanel "Setup Node.js App" expects this file at the app root).
// Loads .env for local dev only — in production, cPanel injects env vars directly.
require("dotenv").config({ path: require("path").resolve(__dirname, ".env") });

const http = require("http");
const { WebSocketServer } = require("ws");
const app = require("./src/app");
const { attachGeminiLiveRelay } = require("./src/gemini/liveRelay");

// Passenger assigns the port via process.env.PORT; the fallback is for local dev only.
const port = process.env.PORT || 8787;

// A plain http.Server wrapping the Express app, so the same server can also accept the Gemini
// Live relay's WebSocket upgrade on /api/assistant/gemini-live — Express itself only speaks HTTP.
const server = http.createServer(app);
// 1 MiB cap on a client frame — audio chunks are a few KB; without a cap ws accepts 100 MB frames.
const wss = new WebSocketServer({ server, path: "/api/assistant/gemini-live", maxPayload: 1024 * 1024 });
attachGeminiLiveRelay(wss);

server.listen(port, () => {
  console.log(`StudyOne assistant server listening on port ${port}`);
});
