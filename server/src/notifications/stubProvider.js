// No API key, no network call — for exercising the full notification pipeline (toggle checks,
// template rendering, route wiring) locally before any real WhatsApp/email credentials exist.
// Shared by both channels since neither needs channel-specific faking, just a visible log line.
async function send({ to, subject, message }) {
  console.log(`[notifications:stub] would send ${subject ? `"${subject}" ` : ""}to ${to}: ${message}`);
  return { ok: true, stub: true };
}

module.exports = { send };
