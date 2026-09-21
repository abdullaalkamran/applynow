import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, LogOut } from "lucide-react";
import { Toggle } from "../../../components/ui/mobile";
import { BackButton } from "../../../components/ui";
import { staffContact } from "../../../utils/currentStaff";
import { COUNSELLOR_ID } from "../../../utils/counsellorData";
import { loadCounsellorSettings, saveCounsellorSettings } from "../../../data/counsellorSettingsStore";

export default function CounsellorSettings() {
  const navigate = useNavigate();
  const counsellor = staffContact(COUNSELLOR_ID, "counsellor");
  const [settings, setSettings] = useState(() => loadCounsellorSettings());
  const [saved, setSaved] = useState(false);

  function update(patch: Partial<typeof settings>) {
    const next = { ...settings, ...patch };
    setSettings(next);
    saveCounsellorSettings(next);
    setSaved(true);
    window.setTimeout(() => setSaved(false), 2000);
  }

  return (
    <div className="max-w-2xl">
      <BackButton fallback="/staff/counsellor" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Settings</h1>
        <p className="mt-1 text-sm text-slate-500">Your account and notification preferences.</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-[image:var(--sd-gradient)] text-sm font-semibold text-white">
            {counsellor.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">{counsellor.name}</p>
            <p className="text-xs text-slate-400">{counsellor.role}</p>
          </div>
        </div>
      </div>

      <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="mb-3 flex items-center justify-between">
          <p className="text-sm font-semibold text-slate-800">Notifications</p>
          {saved && (
            <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
              <Check size={13} /> Saved
            </span>
          )}
        </div>
        <div className="space-y-3">
          <Toggle
            checked={settings.emailNotifications}
            onChange={(v) => update({ emailNotifications: v })}
            label="Email notifications"
            description="Get emailed when a student uploads a document or replies."
          />
          <Toggle
            checked={settings.taskReminders}
            onChange={(v) => update({ taskReminders: v })}
            label="Task reminders"
            description="Reminders shortly before a scheduled session."
          />
          <Toggle
            checked={settings.weeklyDigest}
            onChange={(v) => update({ weeklyDigest: v })}
            label="Weekly digest"
            description="A weekly summary of your caseload's progress."
          />
        </div>
      </div>

      <button
        onClick={() => navigate("/student/onboarding")}
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
