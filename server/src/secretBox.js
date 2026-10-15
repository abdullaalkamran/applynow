// AES-256-GCM encryption for third-party portal credentials. The key comes from PORTAL_CRED_KEY (any string of
// 16+ chars; it's hashed to 32 bytes) — if it's unset the portal features refuse to store anything rather than
// falling back to plaintext. Format: "v1:<iv>:<tag>:<ciphertext>" (base64).
const crypto = require("crypto");

function key() {
  const secret = process.env.PORTAL_CRED_KEY || "";
  if (secret.length < 16) {
    throw Object.assign(new Error("Portal credential storage isn't configured (set PORTAL_CRED_KEY on the server, 16+ characters)."), { status: 503 });
  }
  return crypto.createHash("sha256").update(secret).digest();
}

function isConfigured() {
  return (process.env.PORTAL_CRED_KEY || "").length >= 16;
}

function encrypt(plain) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([cipher.update(String(plain), "utf8"), cipher.final()]);
  return ["v1", iv.toString("base64"), cipher.getAuthTag().toString("base64"), enc.toString("base64")].join(":");
}

function decrypt(payload) {
  const [version, iv, tag, data] = String(payload).split(":");
  if (version !== "v1" || !iv || !tag || !data) throw new Error("Unrecognised secret format.");
  const decipher = crypto.createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}

module.exports = { encrypt, decrypt, isConfigured };
