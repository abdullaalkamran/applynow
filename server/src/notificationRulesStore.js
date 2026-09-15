// Per-status WhatsApp/email notification rules, admin-editable — same plain-JSON-file convention
// as settingsStore.js. Seeded once with every flat AppStatus value (see src/types/index.ts on the
// frontend) so the admin sees a complete, ready-to-toggle list on first load rather than an empty
// page they have to populate by hand.
const fs = require("fs");
const path = require("path");

const FILE = path.join(__dirname, "..", "data", "notification-rules.json");

// Meaningful milestones default on; routine/internal-feeling statuses default off — the admin can
// flip any of them either way, this is just a sane starting point so the feature isn't silent
// (or spammy) out of the box.
const DEFAULT_ENABLED = new Set([
  "Submitted",
  "Offer Received",
  "Additional Documents Requested",
  "Deposit Paid",
  "CAS/COE Issued",
  "Visa Decision",
  "Enrolled",
  "Withdrawn",
  "Rejected",
  "Compliance Hold",
]);

const ALL_STATUSES = [
  "Draft",
  "Profile Incomplete",
  "Documents Pending",
  "Ready for Review",
  "Eligibility Review",
  "Application Preparing",
  "Ready to Submit",
  "Submitted",
  "University Review",
  "Additional Documents Requested",
  "Offer Received",
  "Offer Conditions Pending",
  "Deposit Pending",
  "Deposit Paid",
  "CAS/COE Pending",
  "CAS/COE Issued",
  "Visa Preparation",
  "Visa Submitted",
  "Visa Decision",
  "Enrolled",
  "Deferred",
  "Withdrawn",
  "Rejected",
  "Compliance Hold",
];

function defaultTemplate(status) {
  return `Hi {{studentName}}, an update on your application to {{university}} ({{course}}): your status is now "${status}". {{nextAction}}`;
}

function seedRules() {
  return ALL_STATUSES.map((status) => ({
    status,
    enabled: DEFAULT_ENABLED.has(status),
    whatsappTemplate: defaultTemplate(status),
    emailTemplate: defaultTemplate(status),
  }));
}

function readRules() {
  try {
    return JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch {
    return seedRules();
  }
}

function writeRules(rules) {
  const dir = path.dirname(FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(FILE, JSON.stringify(rules, null, 2));
  return rules;
}

/** Merges a partial update for one or more statuses onto the stored (or freshly seeded) rule set,
 * so the admin can save just the rows they touched without resending everything. */
function updateRules(patchByStatus) {
  const current = readRules();
  const byStatus = new Map(current.map((r) => [r.status, r]));
  for (const patch of patchByStatus) {
    if (!patch.status) continue;
    const existing = byStatus.get(patch.status) || { status: patch.status, enabled: false, whatsappTemplate: defaultTemplate(patch.status), emailTemplate: defaultTemplate(patch.status) };
    byStatus.set(patch.status, { ...existing, ...patch });
  }
  const next = ALL_STATUSES.map((status) => byStatus.get(status)).filter(Boolean);
  return writeRules(next);
}

function ruleFor(status) {
  return readRules().find((r) => r.status === status) || null;
}

module.exports = { readRules, writeRules, updateRules, ruleFor, ALL_STATUSES };
