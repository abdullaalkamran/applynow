import { useState } from "react";
import { Check } from "lucide-react";
import { changePassword, requestPasswordOtp } from "../utils/authClient";
import { OtpCodeField } from "./OtpCodeField";

/** Change-password form for students and agents: current + new password, then a 6-digit code emailed to the account
 * (staff and admin do not use this form). Step 1 checks the entries and sends the code; step 2 confirms it. */
export function PasswordChangeForm({ inputClass, buttonClass, labelClass }: { inputClass: string; buttonClass: string; labelClass: string }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otp, setOtp] = useState("");
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [saved, setSaved] = useState(false);

  async function sendCode() {
    const res = await requestPasswordOtp();
    setSentTo(res.sentTo);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (sentTo === null) {
      if (newPassword.length < 8) return setError("New password must be at least 8 characters.");
      if (newPassword !== confirmPassword) return setError("New password and confirmation don't match.");
    } else if (otp.length !== 6) {
      return setError("Enter the 6-digit code from your email.");
    }
    setBusy(true);
    try {
      if (sentTo === null) {
        await sendCode();
        return;
      }
      await changePassword(currentPassword, newPassword, otp);
      setSaved(true);
      setSentTo(null);
      setOtp("");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      window.setTimeout(() => setSaved(false), 4000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change your password.");
    } finally {
      setBusy(false);
    }
  }

  const locked = sentTo !== null;
  return (
    <form onSubmit={handleSubmit} className="space-y-3.5">
      <label className={labelClass}>
        Current password
        <input type="password" required readOnly={locked} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} className={inputClass} />
      </label>
      <label className={labelClass}>
        New password
        <input type="password" required minLength={8} readOnly={locked} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="At least 8 characters" className={inputClass} />
      </label>
      <label className={labelClass}>
        Confirm new password
        <input type="password" required readOnly={locked} value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} className={inputClass} />
      </label>

      {locked && (
        <div>
          <p className={labelClass}>Verification code</p>
          <OtpCodeField value={otp} onChange={setOtp} sentTo={sentTo ?? undefined} onResend={sendCode} inputClassName={inputClass} />
          <button type="button" onClick={() => { setSentTo(null); setOtp(""); setError(""); }} className="mt-1.5 text-[12px] font-medium text-neutral-500 underline">
            Edit passwords
          </button>
        </div>
      )}

      {error && <p className="rounded-lg bg-[var(--sd-card)] px-3 py-2 text-[12.5px] text-red-700 shadow-neu-inset-sm">{error}</p>}
      {saved && (
        <p className="flex items-center gap-1.5 text-[13px] font-medium text-green-700">
          <Check size={14} /> Password updated
        </p>
      )}

      <button type="submit" disabled={busy} className={buttonClass}>
        {busy ? "Please wait…" : locked ? "Verify & update password" : "Send verification code"}
      </button>
    </form>
  );
}
