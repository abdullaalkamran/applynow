import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowRight, GraduationCap, X } from "lucide-react";
import { SkylineArt } from "../../components/ui/mobile";
import { useRole } from "../../context/RoleContext";
import { ROLES } from "../../data/mockData";
import { ROLE_HOME } from "../../layouts/nav";
import type { Role } from "../../types";

const ROLE_GROUPS = ["Student", "Agent", "Staff", "Admin"] as const;

export default function Onboarding() {
  const navigate = useNavigate();
  const { role, setRole } = useRole();
  const [pickerOpen, setPickerOpen] = useState(false);

  function continueAs(next: Role) {
    setRole(next);
    setPickerOpen(false);
    navigate(ROLE_HOME[next]);
  }

  return (
    <div className="flex min-h-full flex-col bg-[var(--sd-bg)]">
      <div className="flex items-center justify-between px-6 pt-6">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--sd-ink)] text-white">
            <GraduationCap size={15} />
          </div>
          <span className="text-[15px] font-semibold text-[var(--sd-ink)]">StudyOne</span>
        </div>
        <button onClick={() => navigate("/student")} className="text-sm font-medium text-slate-400">
          Skip
        </button>
      </div>

      <div className="px-6 pt-6">
        <h1 className="text-[34px] font-bold leading-[1.08] text-slate-900">
          A Brighter
          <br />
          You.
          <br />
          A Bigger
          <br />
          Tomorrow.
        </h1>
        <p className="mt-4 max-w-[260px] text-sm leading-relaxed text-slate-500">
          Global education. Real guidance. From application to arrival.
        </p>
      </div>

      <div className="relative mt-6 h-[420px] overflow-hidden">
        <SkylineArt tone="violet" className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-t from-[var(--sd-bg)] via-transparent to-transparent" />

        <button
          onClick={() => navigate("/student")}
          aria-label="Let's Get Started"
          className="absolute bottom-24 left-6 flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sd-card)] text-[var(--sd-ink)] shadow-xl"
        >
          <ArrowRight size={22} />
        </button>
        <span className="absolute bottom-[7.4rem] left-24 text-sm font-medium text-white drop-shadow">
          Let's Get Started
        </span>

        <div className="absolute inset-x-0 bottom-0 grid grid-cols-3 gap-2 px-6 pb-6 text-white">
          <Stat value="50+" label="Countries" />
          <Stat value="1,000+" label="Universities" />
          <Stat value="100K+" label="Students" />
        </div>
      </div>

      <button onClick={() => setPickerOpen(true)} className="pb-6 pt-4 text-center text-[12.5px] font-medium text-slate-400">
        Not a student? Continue as agent or staff (demo)
      </button>

      {pickerOpen && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 sm:items-center" onClick={() => setPickerOpen(false)}>
          <div onClick={(e) => e.stopPropagation()} className="w-full max-w-sm rounded-t-3xl bg-[var(--sd-bg)] p-5 sm:rounded-3xl">
            <div className="flex items-center justify-between">
              <p className="text-[15px] font-semibold text-slate-900">Continue as…</p>
              <button onClick={() => setPickerOpen(false)} aria-label="Close" className="text-slate-400">
                <X size={18} />
              </button>
            </div>
            <p className="mt-1 text-[12px] text-slate-400">No auth backend — this is a demo role switcher to preview each workspace.</p>

            <div className="mt-4 max-h-[55vh] space-y-4 overflow-y-auto">
              {ROLE_GROUPS.map((group) => (
                <div key={group}>
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                  <div className="mt-1.5 space-y-1.5">
                    {ROLES.filter((r) => r.group === group).map((r) => (
                      <button
                        key={r.id}
                        onClick={() => continueAs(r.id)}
                        className={`flex w-full flex-col rounded-xl px-3.5 py-2.5 text-left ${
                          r.id === role ? "bg-[var(--sd-ink)] text-white" : "bg-[var(--sd-card)] text-slate-700 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
                        }`}
                      >
                        <span className="text-[13.5px] font-medium">{r.label}</span>
                        <span className={`text-[11px] ${r.id === role ? "text-white/70" : "text-slate-400"}`}>{r.description}</span>
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div>
      <p className="text-lg font-bold drop-shadow">{value}</p>
      <p className="text-[11px] text-white/80 drop-shadow">{label}</p>
    </div>
  );
}
