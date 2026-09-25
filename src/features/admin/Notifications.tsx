import { useEffect, useState } from "react";
import { ChevronDown, ChevronUp } from "lucide-react";
import { Button } from "../../components/ui";
import { Toggle } from "../../components/ui/mobile";
import { loadAdminToken, saveAdminToken, clearAdminToken } from "../../utils/adminSettingsClient";
import {
  fetchNotificationConfig, saveNotificationConfig,
  fetchNotificationRules, saveNotificationRules,
  type NotificationProviderSettings, type NotificationRule,
} from "../../utils/notificationSettingsClient";

const inputClass = "w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-[13px] text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--brand-600)]";
const labelClass = "mb-1 block text-[11.5px] font-medium text-slate-500";

const WHATSAPP_PROVIDERS: NotificationProviderSettings["whatsappProvider"][] = ["stub", "meta", "twilio"];
const EMAIL_PROVIDERS: NotificationProviderSettings["emailProvider"][] = ["stub", "sendgrid"];

const PROVIDER_LABEL: Record<string, string> = {
  stub: "Stub (log only)",
  meta: "Meta Cloud API",
  twilio: "Twilio",
  sendgrid: "SendGrid",
};

const TEMPLATE_VARS = ["studentName", "university", "course", "status", "nextAction"];

export default function AdminNotifications() {
  const [token, setToken] = useState(() => loadAdminToken());
  const [tokenInput, setTokenInput] = useState("");
  const [config, setConfig] = useState<NotificationProviderSettings | null>(null);
  const [rules, setRules] = useState<NotificationRule[] | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  // Draft secret inputs — kept separate from `config` so an untouched (masked) field never
  // overwrites a previously saved credential on save. Same pattern as AISettings.tsx.
  const [metaToken, setMetaToken] = useState("");
  const [twilioAuthToken, setTwilioAuthToken] = useState("");
  const [sendgridKey, setSendgridKey] = useState("");

  async function load(withToken: string) {
    setError("");
    setLoading(true);
    try {
      const [cfg, ruleList] = await Promise.all([fetchNotificationConfig(withToken), fetchNotificationRules(withToken)]);
      setConfig(cfg);
      setRules(ruleList);
    } catch (err) {
      clearAdminToken();
      setToken("");
      setError(err instanceof Error ? err.message : "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (token) load(token);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function unlock() {
    if (!tokenInput.trim()) return;
    saveAdminToken(tokenInput.trim());
    setToken(tokenInput.trim());
    load(tokenInput.trim());
  }

  function updateRule(targetStatus: string, patch: Partial<NotificationRule>) {
    setRules((prev) => (prev ? prev.map((r) => (r.status === targetStatus ? { ...r, ...patch } : r)) : prev));
  }

  async function save() {
    if (!config || !rules) return;
    setStatus("");
    setError("");
    try {
      await saveNotificationConfig(token, {
        whatsappProvider: config.whatsappProvider,
        emailProvider: config.emailProvider,
        whatsappMeta: { phoneNumberId: config.whatsappMeta.phoneNumberId, ...(metaToken ? { accessToken: metaToken } : {}) },
        whatsappTwilio: {
          accountSid: config.whatsappTwilio.accountSid,
          fromNumber: config.whatsappTwilio.fromNumber,
          ...(twilioAuthToken ? { authToken: twilioAuthToken } : {}),
        },
        email: { fromAddress: config.email.fromAddress, fromName: config.email.fromName, ...(sendgridKey ? { apiKey: sendgridKey } : {}) },
      });
      await saveNotificationRules(token, rules);
      setMetaToken("");
      setTwilioAuthToken("");
      setSendgridKey("");
      setStatus("Saved — changes are live immediately, no restart needed.");
      load(token);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save settings.");
    }
  }

  if (!token || !config || !rules) {
    return (
      <div className="mx-auto max-w-sm">
        <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
        <p className="mt-1 text-sm text-slate-500">Enter the admin passcode to manage WhatsApp/email API keys and status alerts.</p>
        <div className="mt-5 space-y-3 rounded-2xl border border-slate-100 bg-white p-5">
          <div>
            <label className={labelClass}>Admin passcode</label>
            <input
              type="password"
              value={tokenInput}
              onChange={(e) => setTokenInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              className={inputClass}
              placeholder="ADMIN_SETTINGS_TOKEN"
            />
          </div>
          {error && <p className="text-[12px] text-rose-600">{error}</p>}
          <Button onClick={unlock} className="w-full justify-center">{loading ? "Checking…" : "Unlock"}</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Notifications</h1>
          <p className="mt-1 text-sm text-slate-500">WhatsApp + email alerts sent to a student, their counsellor, and their agent whenever an application's status changes.</p>
        </div>
        <button
          onClick={() => { clearAdminToken(); setToken(""); setConfig(null); setRules(null); }}
          className="text-[12px] text-slate-400 hover:text-slate-600"
        >
          Lock
        </button>
      </div>

      {error && <p className="rounded-xl bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
      {status && <p className="rounded-xl bg-emerald-50 px-3 py-2 text-[12.5px] text-emerald-700">{status}</p>}

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-[13px] font-semibold text-slate-800">WhatsApp API</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">Stub just logs what would have been sent — pick a real provider once you have credentials.</p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {WHATSAPP_PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => setConfig({ ...config, whatsappProvider: p })}
              className={`rounded-lg border px-2.5 py-2 text-[12.5px] ${config.whatsappProvider === p ? "border-[var(--brand-600)] bg-[var(--brand-50,#eef2ff)] text-[var(--brand-700,#4338ca)]" : "border-slate-200 text-slate-600"}`}
            >
              {PROVIDER_LABEL[p]}
            </button>
          ))}
        </div>

        {config.whatsappProvider === "meta" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Phone number ID</label>
              <input className={inputClass} value={config.whatsappMeta.phoneNumberId} onChange={(e) => setConfig({ ...config, whatsappMeta: { ...config.whatsappMeta, phoneNumberId: e.target.value } })} />
            </div>
            <div>
              <label className={labelClass}>Access token {config.whatsappMeta.accessTokenSet && <span className="text-slate-400">(saved: {config.whatsappMeta.accessTokenMasked})</span>}</label>
              <input type="password" className={inputClass} value={metaToken} onChange={(e) => setMetaToken(e.target.value)} placeholder={config.whatsappMeta.accessTokenSet ? "Leave blank to keep current token" : "EAAG…"} />
            </div>
          </div>
        )}

        {config.whatsappProvider === "twilio" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>Account SID</label>
              <input className={inputClass} value={config.whatsappTwilio.accountSid} onChange={(e) => setConfig({ ...config, whatsappTwilio: { ...config.whatsappTwilio, accountSid: e.target.value } })} />
            </div>
            <div>
              <label className={labelClass}>Auth token {config.whatsappTwilio.authTokenSet && <span className="text-slate-400">(saved: {config.whatsappTwilio.authTokenMasked})</span>}</label>
              <input type="password" className={inputClass} value={twilioAuthToken} onChange={(e) => setTwilioAuthToken(e.target.value)} placeholder={config.whatsappTwilio.authTokenSet ? "Leave blank to keep current token" : "…"} />
            </div>
            <div>
              <label className={labelClass}>WhatsApp sender number</label>
              <input className={inputClass} value={config.whatsappTwilio.fromNumber} onChange={(e) => setConfig({ ...config, whatsappTwilio: { ...config.whatsappTwilio, fromNumber: e.target.value } })} placeholder="+14155238886" />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-[13px] font-semibold text-slate-800">Email API</h2>
        <div className="mt-3 grid grid-cols-2 gap-2 sm:w-1/2">
          {EMAIL_PROVIDERS.map((p) => (
            <button
              key={p}
              onClick={() => setConfig({ ...config, emailProvider: p })}
              className={`rounded-lg border px-2.5 py-2 text-[12.5px] ${config.emailProvider === p ? "border-[var(--brand-600)] bg-[var(--brand-50,#eef2ff)] text-[var(--brand-700,#4338ca)]" : "border-slate-200 text-slate-600"}`}
            >
              {PROVIDER_LABEL[p]}
            </button>
          ))}
        </div>

        {config.emailProvider === "sendgrid" && (
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className={labelClass}>From address</label>
              <input className={inputClass} value={config.email.fromAddress} onChange={(e) => setConfig({ ...config, email: { ...config.email, fromAddress: e.target.value } })} placeholder="updates@unifinderai.com" />
            </div>
            <div>
              <label className={labelClass}>From name</label>
              <input className={inputClass} value={config.email.fromName} onChange={(e) => setConfig({ ...config, email: { ...config.email, fromName: e.target.value } })} />
            </div>
            <div className="sm:col-span-2">
              <label className={labelClass}>API key {config.email.apiKeySet && <span className="text-slate-400">(saved: {config.email.apiKeyMasked})</span>}</label>
              <input type="password" className={inputClass} value={sendgridKey} onChange={(e) => setSendgridKey(e.target.value)} placeholder={config.email.apiKeySet ? "Leave blank to keep current key" : "SG…"} />
            </div>
          </div>
        )}
      </section>

      <section className="rounded-2xl border border-slate-100 bg-white p-5">
        <h2 className="text-[13px] font-semibold text-slate-800">Status notifications</h2>
        <p className="mt-0.5 text-[12px] text-slate-500">Toggle which status changes send a message, and customize the text. Available placeholders: {TEMPLATE_VARS.map((v) => `{{${v}}}`).join(", ")}.</p>
        <div className="mt-3 divide-y divide-slate-100">
          {rules.map((rule) => {
            const isOpen = expanded === rule.status;
            return (
              <div key={rule.status} className="py-2.5">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setExpanded(isOpen ? null : rule.status)}
                    aria-label={isOpen ? `Collapse ${rule.status}` : `Expand ${rule.status}`}
                    className="shrink-0 text-slate-400 hover:text-slate-700"
                  >
                    {isOpen ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <Toggle checked={rule.enabled} onChange={(v) => updateRule(rule.status, { enabled: v })} label={rule.status} />
                  </div>
                </div>
                {isOpen && (
                  <div className="mt-2 space-y-2 pl-5">
                    <div>
                      <label className={labelClass}>WhatsApp message</label>
                      <textarea
                        className={`${inputClass} resize-none`}
                        rows={2}
                        value={rule.whatsappTemplate}
                        onChange={(e) => updateRule(rule.status, { whatsappTemplate: e.target.value })}
                      />
                    </div>
                    <div>
                      <label className={labelClass}>Email message</label>
                      <textarea
                        className={`${inputClass} resize-none`}
                        rows={2}
                        value={rule.emailTemplate}
                        onChange={(e) => updateRule(rule.status, { emailTemplate: e.target.value })}
                      />
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      <Button onClick={save} className="w-full justify-center sm:w-auto">Save changes</Button>
    </div>
  );
}
