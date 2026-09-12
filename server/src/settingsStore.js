// Persists admin-edited settings (provider choice, API keys, voice engine) to a local JSON file —
// no database in this app, and this follows the same "plain file, no infra" spirit as the rest of
// it. Read fresh on every request so an admin's save takes effect immediately, no restart needed.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "settings.json");

function readSettings() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return {};
  }
}

function writeSettings(patch) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  const next = { ...readSettings(), ...patch };
  fs.writeFileSync(FILE, JSON.stringify(next, null, 2));
  return next;
}

module.exports = { readSettings, writeSettings };
