// Agent's own profile — previously agents had no way to edit their own name/email/phone/
// organization at all (only an admin could, via the staff directory). Self-service via
// /api/staff/me, which also keeps the linked User row in sync so the header/greeting reflect a
// saved change immediately.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, LogOut, Copy, Share2 } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "../../components/ui";
import { apiGet, apiPatch } from "../../utils/apiClient";
import { useAuth } from "../../context/AuthContext";
import type { StaffMember } from "../../data/staffStore";

const BASE_INPUT_CLASS = "w-full rounded-lg border border-slate-200 px-3.5 py-2.5 text-sm text-slate-800 focus:border-slate-300 focus:outline-none";

export default function AgentProfile() {
  const navigate = useNavigate();
  const { logout, refreshUser } = useAuth();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [organization, setOrganization] = useState("");
  const [avatarColor, setAvatarColor] = useState("bg-sky-500");
  const [referralCode, setReferralCode] = useState<string | null>(null);
  const [copied, setCopied] = useState<"code" | "link" | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    apiGet<StaffMember & { phone?: string; organization?: string; referralCode?: string }>("/api/staff/me")
      .then((staff) => {
        setName(staff.name);
        setEmail(staff.email);
        setPhone(staff.phone ?? "");
        setOrganization(staff.organization ?? "");
        setAvatarColor(staff.avatarColor);
        setReferralCode(staff.referralCode ?? null);
      })
      .catch((err) => setLoadError(err instanceof Error ? err.message : "Failed to load your profile."))
      .finally(() => setLoading(false));
  }, []);

  const referralLink = referralCode ? `${window.location.origin}/signup?ref=${referralCode}` : null;

  function copyToClipboard(text: string, which: "code" | "link") {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(which);
      window.setTimeout(() => setCopied(null), 2000);
    });
  }

  async function handleSave() {
    setSaving(true);
    setSaveError(null);
    try {
      await apiPatch("/api/staff/me", { name: name.trim(), email: email.trim(), phone: phone.trim(), organization: organization.trim() });
      await refreshUser();
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : "Failed to save your profile.");
    } finally {
      setSaving(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (loading) {
    return <p className="text-sm text-slate-400">Loading your profile…</p>;
  }

  return (
    <div className="max-w-xl">
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">My Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Your own account details — visible to students and staff you work with.</p>
      </div>

      {loadError && <p className="mb-4 rounded-xl bg-rose-50 p-3 text-sm text-rose-600">{loadError}</p>}

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3">
          <div className={`flex h-14 w-14 items-center justify-center rounded-full text-base font-semibold text-white ${avatarColor}`}>
            {name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{name}</p>
            <p className="text-xs text-slate-400">Agent</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Overview</p>
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check size={13} /> Saved
            </span>
          )}
        </div>

        <div className="space-y-3">
          <label className="block text-xs font-medium text-slate-500">
            Full name
            <input value={name} onChange={(e) => setName(e.target.value)} className={`mt-1 ${BASE_INPUT_CLASS}`} />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Contact email <span className="font-normal normal-case text-slate-400">— shown to students/staff, not your login email</span>
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={`mt-1 ${BASE_INPUT_CLASS}`} />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Phone
            <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="e.g. +880 1XXX-XXXXXX" className={`mt-1 ${BASE_INPUT_CLASS}`} />
          </label>
          <label className="block text-xs font-medium text-slate-500">
            Agency / Organization
            <input value={organization} onChange={(e) => setOrganization(e.target.value)} placeholder="e.g. Bright Futures Consultancy" className={`mt-1 ${BASE_INPUT_CLASS}`} />
          </label>
        </div>

        {saveError && <p className="mt-3 text-xs text-rose-600">{saveError}</p>}
        <Button onClick={handleSave} disabled={saving || !name.trim() || !email.trim()} className="mt-4">
          {saving ? "Saving…" : "Save Changes"}
        </Button>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="mb-3 flex items-center gap-1.5">
          <Share2 size={14} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-800">Refer a student</p>
        </div>
        <p className="text-xs text-slate-500">
          Share your link, QR code, or referral code — anyone who signs up through them is automatically connected to you as their agent.
        </p>

        {!referralCode ? (
          <p className="mt-4 text-xs text-slate-400">Generating your referral code…</p>
        ) : (
          <div className="mt-4 flex flex-col items-center gap-4 sm:flex-row sm:items-start">
            <div className="flex shrink-0 items-center justify-center rounded-xl border border-slate-100 bg-white p-3">
              <QRCodeSVG value={referralLink!} size={128} />
            </div>
            <div className="w-full min-w-0 space-y-3">
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Referral code</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="flex-1 rounded-lg bg-slate-50 px-3 py-2 font-mono text-sm font-semibold tracking-wider text-slate-800">
                    {referralCode}
                  </span>
                  <button
                    onClick={() => copyToClipboard(referralCode, "code")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                    aria-label="Copy referral code"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-slate-400">Shareable link</p>
                <div className="mt-1 flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate rounded-lg bg-slate-50 px-3 py-2 text-[12.5px] text-slate-600">
                    {referralLink}
                  </span>
                  <button
                    onClick={() => copyToClipboard(referralLink!, "link")}
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50"
                    aria-label="Copy referral link"
                  >
                    <Copy size={14} />
                  </button>
                </div>
              </div>
              {copied && (
                <p className="flex items-center gap-1 text-[11.5px] font-medium text-emerald-600">
                  <Check size={12} /> {copied === "code" ? "Code" : "Link"} copied to clipboard
                </p>
              )}
            </div>
          </div>
        )}
      </div>

      <button
        onClick={handleLogout}
        className="mt-4 flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-white px-5 py-3.5 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)]"
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
          <LogOut size={16} />
        </div>
        <span className="text-sm font-medium text-rose-500">Log Out</span>
      </button>
    </div>
  );
}
