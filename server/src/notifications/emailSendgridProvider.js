const { getConfig } = require("../config");

// SendGrid's HTTP API — no SDK, one raw POST per message, same convention as every LLM provider
// in ../providers/.
async function send({ to, subject, message }) {
  const config = getConfig().email;
  if (!config.apiKey || !config.fromAddress) {
    throw Object.assign(new Error("Email (SendGrid) is not configured — missing API key or from-address."), { status: 500 });
  }

  const response = await fetch("https://api.sendgrid.com/v3/mail/send", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.apiKey}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      personalizations: [{ to: [{ email: to }] }],
      from: { email: config.fromAddress, name: config.fromName || "StudyOne" },
      subject: subject || "StudyOne update",
      content: [{ type: "text/plain", value: message }],
    }),
  });

  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = data.errors?.[0]?.message || `Email (SendGrid) send failed (${response.status})`;
    throw Object.assign(new Error(detail), { status: 502 });
  }
  // SendGrid returns 202 with no body and an X-Message-Id header on success.
  return { ok: true, id: response.headers.get("x-message-id") || undefined };
}

module.exports = { send };
