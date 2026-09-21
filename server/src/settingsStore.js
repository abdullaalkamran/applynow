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
  // Write-then-rename so a crash mid-write can never leave a truncated file (which readSettings
  // would silently read back as {} — wiping every admin-saved key and API secret).
  const tmp = `${FILE}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, JSON.stringify(next, null, 2), { mode: 0o600 });
  fs.renameSync(tmp, FILE);
  return next;
}

module.exports = { readSettings, writeSettings };
