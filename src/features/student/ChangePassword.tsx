import { ShieldCheck } from "lucide-react";
import { MobileHeader } from "../../components/ui/mobile";
import { PasswordChangeForm } from "../../components/PasswordChangeForm";

const INPUT_CLASS = "mt-1 w-full rounded-xl border border-neutral-200 bg-[var(--sd-card)] px-3.5 py-2.5 text-sm text-neutral-800 focus:outline-none focus:ring-1 focus:ring-[var(--sd-ink)]";

export default function ChangePassword() {
  return (
    <div className="profile-compact flex min-h-full flex-col pb-6">
      <MobileHeader title="Security" />

      <div className="px-5">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--sd-card)] shadow-neu-sm text-neutral-900">
            <ShieldCheck size={16} />
          </div>
          <div>
            <p className="text-[14px] font-semibold text-neutral-900">Change Password</p>
            <p className="text-[12px] text-neutral-400">We'll email you a 6-digit code to confirm it's you.</p>
          </div>
        </div>

        <PasswordChangeForm
          inputClass={INPUT_CLASS}
          labelClass="block text-[12px] font-medium text-neutral-500"
          buttonClass="w-full rounded-xl bg-[image:var(--sd-gradient)] py-3 text-[13px] font-semibold text-white disabled:opacity-60"
        />
      </div>
    </div>
  );
}
