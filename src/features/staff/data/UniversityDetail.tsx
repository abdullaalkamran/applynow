import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Pencil, Trash2, MapPin, Trophy, Briefcase, Users, CheckCircle2, Plus, ChevronRight, Building2, CalendarDays, Languages,
} from "lucide-react";
import { SkylineArt, Pill } from "../../../components/ui/mobile";
import { Button } from "../../../components/ui";
import { getUniversityById, deleteUniversity } from "../../../data/universityCatalogStore";

const TABS = ["Overview", "Campuses", "Courses", "Requirements", "Fees"] as const;

export default function DataUniversityDetail() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const navState = location.state as { tab?: (typeof TABS)[number] } | null;
  const [tab, setTab] = useState<(typeof TABS)[number]>(navState?.tab ?? "Overview");

  const university = id ? getUniversityById(id) : undefined;

  if (!university) {
    return (
      <div>
        <button onClick={() => navigate("/staff/data")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
          <ArrowLeft size={14} /> Back to Countries
        </button>
        <p className="text-xs text-slate-400">University not found.</p>
      </div>
    );
  }

  function handleDelete() {
    if (!window.confirm(`Remove "${university!.name}" from the catalog? This can't be undone.`)) return;
    deleteUniversity(university!.id);
    navigate(`/staff/data/countries/${encodeURIComponent(university!.country)}`);
  }

  return (
    <div className="max-w-3xl">
      <button
        onClick={() => navigate(`/staff/data/countries/${encodeURIComponent(university.country)}`)}
        className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]"
      >
        <ArrowLeft size={14} /> Back to Universities
      </button>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <SkylineArt tone={university.tone} className="h-40 w-full" />
        <div className="p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-semibold text-slate-900">{university.name}</h1>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold text-slate-500">{university.id}</span>
              </div>
              <p className="mt-1 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13} /> {university.city}, {university.country}</p>
              {university.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {university.tags.map((t) => <Pill key={t} tone={university.tone}>{t}</Pill>)}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <Button variant="secondary" onClick={() => navigate(`/staff/data/universities/${university.id}/edit`)}>
                <Pencil size={14} /> Edit Details
              </Button>
              <button onClick={handleDelete} aria-label="Delete university" className="rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600">
                <Trash2 size={16} />
              </button>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-5 overflow-x-auto border-b border-slate-100">
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`relative shrink-0 whitespace-nowrap pb-3 text-xs font-medium transition ${tab === t ? "text-[var(--brand-700)]" : "text-slate-400"}`}
              >
                {t}
                {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-[var(--brand-600)]" />}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 pb-5">
          {tab === "Overview" && (
            <div className="space-y-4">
              <p className="text-xs leading-relaxed text-slate-600">{university.description || "No description yet."}</p>
              <div className="grid grid-cols-3 gap-3">
                <StatBlock icon={<Trophy size={15} />} label="World rank" value={university.worldRank} />
                <StatBlock icon={<Briefcase size={15} />} label="Employability" value={university.employability} />
                <StatBlock icon={<Users size={15} />} label="Students" value={university.studentCount} />
              </div>
              {university.highlights.length > 0 && (
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-2 text-xs font-semibold text-slate-700">Why study here?</p>
                  <ul className="space-y-1.5">
                    {university.highlights.map((h) => (
                      <li key={h} className="flex items-start gap-2 text-xs text-slate-600">
                        <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" /> {h}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              <div>
                <p className="mb-2 text-xs font-semibold text-slate-700">Subjects offered</p>
                {university.subjects.length === 0 ? (
                  <p className="text-xs text-slate-400">No subjects added yet — go to Edit Details to add some.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {university.subjects.map((s) => <Pill key={s}>{s}</Pill>)}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "Campuses" && (
            <div className="space-y-2">
              {(university.campuses ?? []).map((c) => (
                <div key={c.id} className="flex items-center justify-between gap-3 rounded-lg border border-slate-100 p-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-500">
                      <Building2 size={14} />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-slate-800">{c.name}</p>
                      <p className="truncate text-xs text-slate-400">{c.city}</p>
                    </div>
                  </div>
                  {c.feeUSD !== undefined && <span className="shrink-0 text-xs font-semibold text-slate-700">${c.feeUSD.toLocaleString()}/yr</span>}
                </div>
              ))}
              {(university.campuses ?? []).length === 0 && (
                <p className="text-xs text-slate-400">
                  No real campuses added yet — students see a generic "Main Campus" (using {university.city}) until you add real ones from Edit Details.
                </p>
              )}
            </div>
          )}

          {tab === "Courses" && (
            <div>
              <div className="mb-2 flex justify-end">
                <button
                  onClick={() => navigate(`/staff/data/universities/${university.id}/courses/new`)}
                  className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]"
                >
                  <Plus size={13} /> Add course
                </button>
              </div>
              <div className="space-y-2">
                {university.courses.map((c) => (
                  <button
                    key={c.id}
                    onClick={() => navigate(`/staff/data/universities/${university.id}/courses/${c.id}`)}
                    className="flex w-full items-center justify-between gap-3 rounded-lg border border-slate-100 p-3 text-left hover:border-slate-200 hover:bg-slate-50"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-xs font-medium text-slate-800">{c.name}</p>
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400">{c.id}</span>
                      </div>
                      <p className="truncate text-xs text-slate-400">{c.subject} · {c.level} · {c.duration}</p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-semibold text-slate-700">${c.feeUSD.toLocaleString()}/yr</span>
                      <ChevronRight size={15} className="text-slate-300" />
                    </div>
                  </button>
                ))}
                {university.courses.length === 0 && <p className="text-xs text-slate-400">No courses added yet.</p>}
              </div>
            </div>
          )}

          {tab === "Requirements" && (
            <div className="space-y-4">
              <div className="space-y-2">
                {university.requirements.map((r) => (
                  <div key={r} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
                    <CheckCircle2 size={14} className="shrink-0 text-emerald-500" /> {r}
                  </div>
                ))}
                {university.requirements.length === 0 && <p className="text-xs text-slate-400">No requirements added yet.</p>}
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <Languages size={13} /> Accepted English Tests
                </p>
                {(university.englishRequirements ?? []).length === 0 ? (
                  <p className="text-xs text-slate-400">Minimum IELTS {university.minIELTS} overall — no other tests listed.</p>
                ) : (
                  <div className="space-y-1.5">
                    {university.englishRequirements!.map((e, i) => (
                      <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="text-slate-700">{e.testName}</span>
                          <span className="text-right">
                            <span className="font-semibold text-slate-800">{e.minScore}</span>
                            {e.minBand && <span className="ml-2 text-xs text-slate-400">no band below {e.minBand}</span>}
                          </span>
                        </div>
                        {(e.skillScores ?? []).length > 0 && (
                          <div className="mt-1.5 flex flex-wrap gap-1.5">
                            {e.skillScores!.map((s, si) => (
                              <span key={si} className="rounded-md bg-white px-2 py-0.5 text-xs text-slate-500 ring-1 ring-slate-200">
                                {s.skill} <span className="font-semibold text-slate-700">{s.score}</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <CalendarDays size={13} /> Intakes
                </p>
                {university.intakes.length === 0 ? (
                  <p className="text-xs text-slate-400">No intakes added yet.</p>
                ) : (
                  <div className="flex flex-wrap gap-1.5">
                    {university.intakes.map((m) => {
                      const open = university.intakeStatus?.[m] ?? false;
                      return (
                        <span key={m} className={`rounded-full px-2.5 py-1 text-xs font-medium ${open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
                          {m} · {open ? "Open" : "Closed"}
                        </span>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "Fees" && (
            <div className="space-y-2">
              {university.fees.map((f) => (
                <div key={f.label} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
                  <span className="text-slate-600">{f.label}</span>
                  <span className="font-semibold text-slate-800">{university.currencySymbol}{f.amount.toLocaleString()}</span>
                </div>
              ))}
              {university.fees.length === 0 && <p className="text-xs text-slate-400">No fee line items added yet.</p>}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatBlock({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-xl bg-slate-50 p-3">
      <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-500 shadow-sm">{icon}</div>
      <p className="mt-1.5 text-xs font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
    </div>
  );
}
