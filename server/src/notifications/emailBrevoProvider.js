const { getConfig } = require("../config");

const UPSTREAM_TIMEOUT_MS = 30_000;

// Brevo's transactional email HTTP API — no SDK, one raw POST per message, same convention as
// emailSendgridProvider.js. Uses HTTPS (port 443), so no outgoing SMTP port needs to be opened.
// Key: BREVO_API_KEY env var, or the email API key saved in Admin → Settings.
async function send({ to, subject, message }) {
  const config = getConfig().email;
  const apiKey = process.env.BREVO_API_KEY || config.apiKey;
  if (!apiKey || !config.fromAddress) {
    throw Object.assign(new Error("Email (Brevo) is not configured — missing API key or from-address."), { status: 500 });
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    // Bounded so a hung upstream can never pin a request worker indefinitely.
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    headers: {
      "api-key": apiKey,
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify({
      sender: { email: config.fromAddress, name: config.fromName || "UnifinderAi" },
      to: [{ email: to }],
      subject: subject || "UnifinderAi update",
      textContent: message,
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const detail = data.message || `Email (Brevo) send failed (${response.status})`;
    throw Object.assign(new Error(detail), { status: 502 });
  }
  // Brevo returns 201 with { messageId } on success.
  return { ok: true, id: data.messageId || undefined };
}

module.exports = { send };
