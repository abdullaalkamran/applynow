// Real user accounts for login — a local JSON file (same convention as settingsStore.js), seeded
// once with one account per role on first boot. Seeded accounts map to the existing per-role demo
// identities already baked into the frontend (CURRENT_STUDENT_ID "s1", CURRENT_AGENT_ID "a1",
// COUNSELLOR_ID "c1") via `roleUserId`, so logging in as "the student" surfaces the same Sarah Khan
// data every other part of the app already assumes, rather than introducing a second identity system.
const fs = require("fs");
const path = require("path");
const bcrypt = require("bcryptjs");

const FILE = path.join(__dirname, "..", "data", "users.json");

const SEED_PASSWORD = "password123";

const SEED_USERS = [
  { email: "student@studyone.dev", name: "Sarah Khan", role: "student", roleUserId: "s1" },
  { email: "agent@studyone.dev", name: "Rafiq Hossain", role: "agent", roleUserId: "a1" },
  { email: "counsellor@studyone.dev", name: "Maria Fernandez", role: "counsellor", roleUserId: "c1" },
  { email: "admission@studyone.dev", name: "Aisha Rahman", role: "admission", roleUserId: "admission" },
  { email: "compliance@studyone.dev", name: "R. Fernandez", role: "compliance", roleUserId: "compliance" },
  { email: "data@studyone.dev", name: "Data Management", role: "data", roleUserId: "data" },
  { email: "finance@studyone.dev", name: "Finance", role: "finance", roleUserId: "finance" },
  { email: "admin@studyone.dev", name: "Admin", role: "admin", roleUserId: "admin" },
];

function readUsers() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return null;
  }
}

function writeUsers(users) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(users, null, 2));
}

function seedIfMissing() {
  const existing = readUsers();
  if (existing) return existing;

  const passwordHash = bcrypt.hashSync(SEED_PASSWORD, 10);
  const users = SEED_USERS.map((u, index) => ({ id: `u${index + 1}`, passwordHash, ...u }));
  writeUsers(users);

  console.log("\n=== Seeded demo login accounts (server/data/users.json) ===");
  console.log(`Password for all: "${SEED_PASSWORD}"`);
  users.forEach((u) => console.log(`  ${u.email}  ->  ${u.role} (${u.name})`));
  console.log("Change these before any real deployment.\n");

  return users;
}

function findByEmail(email) {
  const users = seedIfMissing();
  return users.find((u) => u.email.toLowerCase() === String(email).toLowerCase());
}

function findById(id) {
  const users = seedIfMissing();
  return users.find((u) => u.id === id);
}

module.exports = { seedIfMissing, findByEmail, findById };
