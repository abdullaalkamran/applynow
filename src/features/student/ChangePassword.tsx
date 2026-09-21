import { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { MobileHeader } from "../../components/ui/mobile";
import { changePassword } from "../../utils/authClient";

const INPUT_CLASS = "mt-1 w-full rounded-xl border border-slate-200 bg-[var(--sd-card)] px-3.5 py-2.5 text-sm text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--sd-ink)]";

export default function ChangePassword() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (newPassword.length < 8) {
      setError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("New password and confirmation don't match.");
      return;
    }
    setSaving(true);
    try {
      await changePassword(currentPassword, newPassword);
      setSaved(true);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change your password.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex min-h-full flex-col pb-6">
      <MobileHeader title="Security" />

      <div className="px-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
            <ShieldCheck size={16} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-slate-900">Change Password</p>
            <p className="text-[12px] text-slate-400">Update the password you use to sign in.</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3.5">
          <label className="block text-[12px] font-medium text-slate-500">
            Current password
            <input
              type="password"
              required
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>
          <label className="block text-[12px] font-medium text-slate-500">
            New password
            <input
              type="password"
              required
              minLength={8}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              placeholder="At least 8 characters"
              className={INPUT_CLASS}
            />
          </label>
          <label className="block text-[12px] font-medium text-slate-500">
            Confirm new password
            <input
              type="password"
              required
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className={INPUT_CLASS}
            />
          </label>

          {error && <p className="rounded-lg bg-rose-50 px-3 py-2 text-[12.5px] text-rose-700">{error}</p>}
          {saved && (
            <p className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--sd-teal)]">
              <Check size={14} /> Password updated
            </p>
          )}

          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-xl bg-[image:var(--sd-gradient)] py-3 text-[13px] font-semibold text-white disabled:opacity-60"
          >
            {saving ? "Updating…" : "Update Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
