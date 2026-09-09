import { useNavigate } from "react-router-dom";
import { ArrowRight, GraduationCap } from "lucide-react";
import { SkylineArt } from "../../components/ui/mobile";

export default function Onboarding() {
  const navigate = useNavigate();

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
          className="absolute bottom-24 left-6 flex h-14 w-14 items-center justify-center rounded-full bg-white text-[var(--sd-ink)] shadow-xl"
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
