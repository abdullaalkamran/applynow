const { getConfig } = require("../config");

// Twilio's WhatsApp API — a common alternative to Meta's own Cloud API (often an easier trial
// signup). No SDK: one raw POST per message, same convention as every LLM provider in ../providers/.
async function send({ to, message }) {
  const config = getConfig().whatsappTwilio;
  if (!config.accountSid || !config.authToken || !config.fromNumber) {
    throw Object.assign(new Error("WhatsApp (Twilio) is not configured — missing account SID, auth token, or WhatsApp number."), { status: 500 });
  }

  const url = `https://api.twilio.com/2010-04-01/Accounts/${config.accountSid}/Messages.json`;
  const basicAuth = Buffer.from(`${config.accountSid}:${config.authToken}`).toString("base64");
  const body = new URLSearchParams({
    From: `whatsapp:${config.fromNumber}`,
    To: `whatsapp:${to}`,
    Body: message,
  });

  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Basic ${basicAuth}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body,
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.message || `WhatsApp (Twilio) send failed (${response.status})`), { status: 502 });
  }
  return { ok: true, id: data.sid };
}

module.exports = { send };
