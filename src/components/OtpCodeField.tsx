import { useEffect, useState } from "react";

/** The 6-digit email code box with a "Resend" link that counts down — shared by signup, agent invite acceptance and
 * password change. `onResend` must request a new code and resolve once it has been sent. */
export function OtpCodeField({
  value, onChange, onResend, sentTo, initialCooldown = 45, inputClassName,
}: {
  value: string;
  onChange: (v: string) => void;
  onResend: () => Promise<unknown>;
  sentTo?: string;
  initialCooldown?: number;
  inputClassName: string;
}) {
  const [cooldown, setCooldown] = useState(initialCooldown);
  const [resending, setResending] = useState(false);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = window.setTimeout(() => setCooldown((c) => c - 1), 1000);
    return () => window.clearTimeout(t);
  }, [cooldown]);

  async function resend() {
    setResending(true);
    setNote("");
    try {
      await onResend();
      setCooldown(45);
      setNote("A new code is on its way.");
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Couldn't resend the code.");
    } finally {
      setResending(false);
    }
  }

  return (
    <div>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value.replace(/\D/g, "").slice(0, 6))}
        inputMode="numeric"
        autoComplete="one-time-code"
        autoFocus
        maxLength={6}
        placeholder="6-digit code"
        aria-label="6-digit verification code"
        className={`${inputClassName} text-center font-mono text-lg tracking-[0.5em]`}
      />
      <p className="mt-1.5 text-[12px] text-neutral-500">
        {sentTo ? `We emailed a code to ${sentTo}. ` : "We emailed you a code. "}It expires in 10 minutes.
      </p>
      <div className="mt-1 flex items-center gap-2 text-[12px]">
        <button type="button" onClick={resend} disabled={cooldown > 0 || resending} className="font-semibold text-neutral-900 disabled:text-neutral-400">
          {resending ? "Sending…" : cooldown > 0 ? `Resend code in ${cooldown}s` : "Resend code"}
        </button>
        {note && <span className="text-neutral-500">{note}</span>}
      </div>
    </div>
  );
}
