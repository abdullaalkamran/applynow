import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, GraduationCap, Award, Globe2, ChevronRight } from "lucide-react";
import { LogoBadge } from "../../../components/ui/mobile";
import { BackButton } from "../../../components/ui";
import { getAllUniversities } from "../../../data/universityCatalogStore";
import { getAllCountries, getCountryByName } from "../../../data/countryRegistry";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { activeApplicationsFor } from "../../../utils/counsellorData";

const VIEWS = ["Universities", "Countries"] as const;

export default function CounsellorUniversityPartners() {
  const navigate = useNavigate();
  const [view, setView] = useState<(typeof VIEWS)[number]>("Universities");
  const [query, setQuery] = useState("");
  const UNIVERSITIES = getAllUniversities();
  const assigned = loadAssignedStudents();
  const allActiveApps = assigned.flatMap((s) => activeApplicationsFor(s.id));

  const filtered = UNIVERSITIES.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q);
  });

  const byCountry = new Map<string, typeof UNIVERSITIES>();
  UNIVERSITIES.forEach((u) => {
    const list = byCountry.get(u.country) ?? [];
    list.push(u);
    byCountry.set(u.country, list);
  });
  // Every registered country shows up here, even ones with zero universities yet — a country whose
  // Overview page Data Management has already filled in shouldn't be invisible to counsellors just
  // because no partner university has been added under it yet (mirrors staff Countries.tsx).
  getAllCountries().forEach((c) => {
    if (!byCountry.has(c.name)) byCountry.set(c.name, []);
  });
  const countries = Array.from(byCountry.entries())
    .map(([country, list]) => ({ country, universities: list, courseCount: list.reduce((s, u) => s + u.courses.length, 0) }))
    .filter((c) => !query.trim() || c.country.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.universities.length - a.universities.length);

  return (
    <div>
      <BackButton fallback="/staff/counsellor" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">University Partners</h1>
        <p className="mt-1 text-sm text-slate-500">
          {UNIVERSITIES.length} partner universities across {byCountry.size} countries.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 max-w-sm flex-1 min-w-0">
          <Search size={14} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search universities or countries…"
            className="w-full min-w-0 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <div className="flex shrink-0 gap-1 rounded-xl border border-slate-200 bg-white p-1">
          {VIEWS.map((v) => (
            <button
              key={v}
              onClick={() => setView(v)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition ${
                view === v ? "bg-[var(--brand-600)] text-white" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {v}
            </button>
          ))}
        </div>
      </div>

      {view === "Countries" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {countries.map((c) => (
            <div
              key={c.country}
              onClick={() => navigate(`/staff/counsellor/partners/${encodeURIComponent(c.country)}`)}
              className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 hover:border-slate-300"
            >
              <div className="flex min-w-0 items-center gap-3">
                <div className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-[var(--brand-50)] text-[var(--brand-700)]">
                  {getCountryByName(c.country)?.logoUrl ? (
                    <img src={getCountryByName(c.country)!.logoUrl} alt={`${c.country} logo`} className="h-full w-full object-cover" />
                  ) : (
                    <Globe2 size={18} />
                  )}
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{c.country}</p>
                  <p className="flex items-center gap-1 text-xs text-slate-400">
                    <GraduationCap size={11} /> {c.universities.length} universit{c.universities.length === 1 ? "y" : "ies"} · {c.courseCount} courses
                  </p>
                </div>
              </div>
              <ChevronRight size={16} className="shrink-0 text-slate-300" />
            </div>
          ))}
          {countries.length === 0 && (
            <p className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
              No countries match this search.
            </p>
          )}
        </div>
      ) : (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((u) => {
          const activeFromMyStudents = allActiveApps.filter((a) => a.university === u.name).length;
          return (
            <div
              key={u.id}
              onClick={() => navigate(`/staff/counsellor/partners/universities/${u.id}`)}
              className="cursor-pointer rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.06)] hover:border-slate-200"
            >
              <div className="flex items-start gap-3">
                <LogoBadge name={u.name} tone={u.tone} logoUrl={u.logoUrl} className="h-11 w-11 shrink-0" />
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-800">{u.name}</p>
                  <p className="truncate text-xs text-slate-400">{u.city}, {u.country}</p>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                <span className="inline-flex items-center gap-1"><GraduationCap size={11} /> {u.worldRank} world rank</span>
                <span>{u.employability} employability</span>
                {u.scholarshipsAvailable && (
                  <span className="inline-flex items-center gap-1 text-amber-600"><Award size={11} /> Scholarships</span>
                )}
              </div>
              <div className="mt-3 border-t border-slate-50 pt-3">
                <p className="text-xs text-slate-500">
                  {activeFromMyStudents > 0
                    ? `${activeFromMyStudents} of your student${activeFromMyStudents === 1 ? "" : "s"} applying here`
                    : "None of your students applying here yet"}
                </p>
              </div>
            </div>
          );
        })}
      </div>
      )}
    </div>
  );
}
