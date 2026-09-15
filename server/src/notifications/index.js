const whatsappMetaProvider = require("./whatsappMetaProvider");
const whatsappTwilioProvider = require("./whatsappTwilioProvider");
const emailSendgridProvider = require("./emailSendgridProvider");
const stubProvider = require("./stubProvider");

const WHATSAPP_PROVIDERS = {
  meta: whatsappMetaProvider,
  twilio: whatsappTwilioProvider,
  stub: stubProvider,
};

const EMAIL_PROVIDERS = {
  sendgrid: emailSendgridProvider,
  stub: stubProvider,
};

function getWhatsAppProvider(name) {
  const provider = WHATSAPP_PROVIDERS[name];
  if (!provider) {
    throw Object.assign(
      new Error(`Unknown WHATSAPP_PROVIDER "${name}" — expected one of: ${Object.keys(WHATSAPP_PROVIDERS).join(", ")}`),
      { status: 500 }
    );
  }
  return provider;
}

function getEmailProvider(name) {
  const provider = EMAIL_PROVIDERS[name];
  if (!provider) {
    throw Object.assign(
      new Error(`Unknown EMAIL_PROVIDER "${name}" — expected one of: ${Object.keys(EMAIL_PROVIDERS).join(", ")}`),
      { status: 500 }
    );
  }
  return provider;
}

module.exports = { getWhatsAppProvider, getEmailProvider };
