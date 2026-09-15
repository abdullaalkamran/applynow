const { getConfig } = require("../config");

// Meta WhatsApp Cloud API — the official Meta Business integration. No SDK: one raw POST per
// message, same convention as every LLM provider in ../providers/.
async function send({ to, message }) {
  const config = getConfig().whatsappMeta;
  if (!config.accessToken || !config.phoneNumberId) {
    throw Object.assign(new Error("WhatsApp (Meta) is not configured — missing access token or phone number ID."), { status: 500 });
  }

  const url = `https://graph.facebook.com/v19.0/${config.phoneNumberId}/messages`;
  const response = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.accessToken}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      messaging_product: "whatsapp",
      to,
      type: "text",
      text: { body: message },
    }),
  });

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw Object.assign(new Error(data.error?.message || `WhatsApp (Meta) send failed (${response.status})`), { status: 502 });
  }
  return { ok: true, id: data.messages?.[0]?.id };
}

module.exports = { send };
