import { useState } from "react";
import { Search, GraduationCap, Award } from "lucide-react";
import { LogoBadge } from "../../../components/ui/mobile";
import { BackButton } from "../../../components/ui";
import { getAllUniversities } from "../../../data/universityCatalogStore";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { activeApplicationsFor } from "../../../utils/counsellorData";

export default function CounsellorUniversityPartners() {
  const [query, setQuery] = useState("");
  const UNIVERSITIES = getAllUniversities();
  const assigned = loadAssignedStudents();
  const allActiveApps = assigned.flatMap((s) => activeApplicationsFor(s.id));

  const filtered = UNIVERSITIES.filter((u) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.country.toLowerCase().includes(q);
  });

  return (
    <div>
      <BackButton fallback="/staff/counsellor" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">University Partners</h1>
        <p className="mt-1 text-sm text-slate-500">{UNIVERSITIES.length} partner universities on the platform.</p>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 max-w-sm">
        <Search size={14} className="text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search universities or countries…"
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {filtered.map((u) => {
          const activeFromMyStudents = allActiveApps.filter((a) => a.university === u.name).length;
          return (
            <div key={u.id} className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
              <div className="flex items-start gap-3">
                <LogoBadge name={u.name} tone={u.tone} className="h-11 w-11 shrink-0" />
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
    </div>
  );
}
