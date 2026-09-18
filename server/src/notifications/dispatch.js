// Shared "render + send" core, extracted from routes/notifications.js so the applications route
// can fire a status-change notification directly (in-process) instead of the frontend making a
// second HTTP round trip to /api/notifications/send after the status update response comes back.
const { getConfig } = require("../config");
const { ruleFor } = require("../notificationRulesStore");
const { getWhatsAppProvider, getEmailProvider } = require("./index");

function renderTemplate(template, variables) {
  return (template || "").replace(/\{\{(\w+)\}\}/g, (match, key) => (key in variables ? String(variables[key]) : match));
}

/** recipients: {channel:"whatsapp"|"email", to:string}[]; variables: Record<string,string>.
 * Returns {sent:false, reason} if the admin's per-status rule is missing/disabled, otherwise
 * {sent:true, results}. Never throws for a single recipient's send failure — Promise.allSettled. */
async function sendStatusNotification({ status, recipients, variables }) {
  const rule = ruleFor(status);
  if (!rule || !rule.enabled) return { sent: false, reason: "disabled" };

  const config = getConfig();
  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      if (recipient.channel === "whatsapp") {
        const provider = getWhatsAppProvider(config.whatsappProvider);
        const message = renderTemplate(rule.whatsappTemplate, variables);
        return { ...(await provider.send({ to: recipient.to, message })), channel: "whatsapp", to: recipient.to };
      }
      if (recipient.channel === "email") {
        const provider = getEmailProvider(config.emailProvider);
        const message = renderTemplate(rule.emailTemplate, variables);
        return { ...(await provider.send({ to: recipient.to, subject: `StudyOne: ${status}`, message })), channel: "email", to: recipient.to };
      }
      throw Object.assign(new Error(`Unknown channel "${recipient.channel}"`), { status: 400 });
    })
  );

  return {
    sent: true,
    results: results.map((r) => (r.status === "fulfilled" ? r.value : { ok: false, error: r.reason?.message || "Send failed" })),
  };
}

/** Same recipients/channel fan-out as sendStatusNotification, but for document review events
 * (verified/rejected) — these aren't an AppStatus, so there's no admin-configurable per-status
 * rule to gate on here; the message is built by the caller and always sent. */
async function sendDocumentNotification({ subject, message, recipients }) {
  const config = getConfig();
  const results = await Promise.allSettled(
    recipients.map(async (recipient) => {
      if (recipient.channel === "whatsapp") {
        const provider = getWhatsAppProvider(config.whatsappProvider);
        return { ...(await provider.send({ to: recipient.to, message })), channel: "whatsapp", to: recipient.to };
      }
      if (recipient.channel === "email") {
        const provider = getEmailProvider(config.emailProvider);
        return { ...(await provider.send({ to: recipient.to, subject, message })), channel: "email", to: recipient.to };
      }
      throw Object.assign(new Error(`Unknown channel "${recipient.channel}"`), { status: 400 });
    })
  );

  return {
    sent: true,
    results: results.map((r) => (r.status === "fulfilled" ? r.value : { ok: false, error: r.reason?.message || "Send failed" })),
  };
}

module.exports = { sendStatusNotification, sendDocumentNotification, renderTemplate };
