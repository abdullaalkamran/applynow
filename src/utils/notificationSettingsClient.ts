// Same admin-token gate as adminSettingsClient.ts (same sessionStorage token, same backend) —
// split into its own file because it covers two different backend resources (provider config
// living on the shared /api/admin/settings, and per-status rules on their own endpoint) that
// don't belong in AdminSettings' own typed shape.
import { BACKEND_BASE } from "./backendBase";

const SETTINGS_URL = `${BACKEND_BASE}/api/admin/settings`;
const RULES_URL = `${BACKEND_BASE}/api/admin/notification-rules`;

export interface NotificationProviderSettings {
  whatsappProvider: "meta" | "twilio" | "stub";
  emailProvider: "sendgrid" | "stub";
  whatsappMeta: { phoneNumberId: string; accessTokenSet: boolean; accessTokenMasked: string };
  whatsappTwilio: { accountSid: string; fromNumber: string; authTokenSet: boolean; authTokenMasked: string };
  email: { fromAddress: string; fromName: string; apiKeySet: boolean; apiKeyMasked: string };
}

export interface NotificationRule {
  status: string;
  enabled: boolean;
  whatsappTemplate: string;
  emailTemplate: string;
}

async function handle<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.json().catch(() => ({}));
    throw new Error(detail.error || `Request failed (${response.status})`);
  }
  return response.json();
}

// Reads only the notification-related fields off the same /api/admin/settings resource AISettings
// already uses — the response includes the AI provider fields too, callers here just ignore them.
export async function fetchNotificationConfig(token: string): Promise<NotificationProviderSettings> {
  const response = await fetch(SETTINGS_URL, { headers: { "x-admin-token": token } });
  return handle<NotificationProviderSettings>(response);
}

export async function saveNotificationConfig(token: string, patch: Record<string, unknown>): Promise<void> {
  const response = await fetch(SETTINGS_URL, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-admin-token": token },
    body: JSON.stringify(patch),
  });
  await handle(response);
}

export async function fetchNotificationRules(token: string): Promise<NotificationRule[]> {
  const response = await fetch(RULES_URL, { headers: { "x-admin-token": token } });
  const data = await handle<{ rules: NotificationRule[] }>(response);
  return data.rules;
}

export async function saveNotificationRules(token: string, rules: NotificationRule[]): Promise<void> {
  const response = await fetch(RULES_URL, {
    method: "PUT",
    headers: { "content-type": "application/json", "x-admin-token": token },
    body: JSON.stringify({ rules }),
  });
  await handle(response);
}
