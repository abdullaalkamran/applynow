import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Heart, Share2, CheckCircle2, GraduationCap } from "lucide-react";
import { SkylineArt, Pill } from "../../components/ui/mobile";
import { UNIVERSITIES } from "../../data/mockData";

const TABS = ["Overview", "Courses", "Requirements", "Fees"] as const;

export default function UniversityDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Overview");
  const [favorite, setFavorite] = useState(false);
  const university = UNIVERSITIES.find((u) => u.id === id) ?? UNIVERSITIES[0];

  return (
    <div className="flex min-h-full flex-col">
      <div className="relative h-56 shrink-0">
        <SkylineArt tone={university.tone} className="h-full w-full" />
        <div className="absolute inset-x-0 top-0 flex items-center justify-between p-4">
          <button
            onClick={() => navigate(-1)}
            className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow"
          >
            <ArrowLeft size={17} />
          </button>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setFavorite((v) => !v)}
              className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow"
            >
              <Heart size={16} className={favorite ? "fill-rose-500 text-rose-500" : ""} />
            </button>
            <button className="flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow">
              <Share2 size={16} />
            </button>
          </div>
        </div>
        <span className="absolute bottom-3 right-4 rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white">
          1/10
        </span>
      </div>

      <div className="relative -mt-6 rounded-t-[1.75rem] bg-[var(--sd-bg)] px-5 pt-5">
        <div className="rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.04]">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#F1EAFB] text-[#6D3FBF]">
              <GraduationCap size={22} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-[16px] font-bold text-slate-900">{university.name}</h1>
              <p className="text-xs text-slate-400">{university.city}, {university.country}</p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            <Pill tone="blue">{university.tags[0]}</Pill>
            <Pill tone="navy">Russell Group</Pill>
            <Pill tone="green">{university.tags[1]}</Pill>
          </div>
        </div>

        <div className="mt-4 flex items-center gap-5 border-b border-black/5">
          {TABS.map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative pb-3 text-[13px] font-medium transition ${tab === t ? "text-[var(--sd-ink)]" : "text-slate-400"}`}
            >
              {t}
              {tab === t && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[var(--sd-ink)]" />}
            </button>
          ))}
        </div>

        <div className="py-4">
          {tab === "Overview" && (
            <>
              <p className="text-[13px] leading-relaxed text-slate-500">{university.description}</p>

              <div className="mt-4 grid grid-cols-3 gap-3 rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.03]">
                <Stat value={university.worldRank} label="in the World" />
                <Stat value={university.employability} label="Employability" />
                <Stat value={university.studentCount} label="Students" />
              </div>

              <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.03]">
                <p className="text-sm font-semibold text-slate-900">Why study here?</p>
                <ul className="mt-3 space-y-2.5">
                  {university.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2 text-[13px] text-slate-600">
                      <CheckCircle2 size={16} className="shrink-0 text-[var(--sd-teal)]" />
                      {h}
                    </li>
                  ))}
                </ul>
              </div>
            </>
          )}

          {tab === "Courses" && (
            <div className="space-y-2.5">
              {university.courses.map((c) => (
                <div key={c.name} className="rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.03]">
                  <p className="text-sm font-semibold text-slate-900">{c.name}</p>
                  <p className="mt-1 text-xs text-slate-400">{c.level} · {c.duration}</p>
                </div>
              ))}
            </div>
          )}

          {tab === "Requirements" && (
            <div className="rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.03]">
              <ul className="space-y-2.5">
                {university.requirements.map((r) => (
                  <li key={r} className="flex items-start gap-2 text-[13px] text-slate-600">
                    <CheckCircle2 size={16} className="mt-0.5 shrink-0 text-[var(--sd-teal)]" />
                    {r}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {tab === "Fees" && (
            <div className="rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.03]">
              {university.fees.map((f) => (
                <div key={f.label} className="flex items-center justify-between border-b border-slate-50 py-2.5 last:border-0">
                  <span className="text-[13px] text-slate-500">{f.label}</span>
                  <span className="text-[13px] font-medium text-slate-800">{university.currencySymbol}{f.amount.toLocaleString()}</span>
                </div>
              ))}
              <button
                onClick={() => navigate("/student/cost-planner")}
                className="mt-3 w-full rounded-xl bg-slate-50 py-2.5 text-center text-[13px] font-medium text-[var(--sd-ink)]"
              >
                Open full Cost Planner
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center gap-3 bg-[var(--sd-bg)] px-5 py-4">
        <button className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white py-3 text-[13px] font-semibold text-slate-700">
          Shortlist
        </button>
        <button
          onClick={() => navigate("/student/applications")}
          className="flex flex-[1.4] items-center justify-center gap-2 rounded-xl bg-[var(--sd-ink)] py-3 text-[13px] font-semibold text-white"
        >
          Apply Now <ArrowLeft size={14} className="rotate-180" />
        </button>
      </div>
    </div>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  return (
    <div className="text-center">
      <p className="text-[15px] font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-400">{label}</p>
    </div>
  );
}
