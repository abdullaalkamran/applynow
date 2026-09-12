import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, Plus, Trash2, Globe2, GraduationCap, BookOpen } from "lucide-react";
import { PageHeader, Button, StatTile } from "../../../components/ui";
import { LogoBadge } from "../../../components/ui/mobile";
import { getAllUniversities, deleteUniversity, isCustomUniversity } from "../../../data/universityCatalogStore";

export default function DataUniversities() {
  const navigate = useNavigate();
  const { country: countryParam } = useParams();
  const scopedCountry = countryParam ? decodeURIComponent(countryParam) : null;
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState(scopedCountry ?? "All");
  const [, forceTick] = useState(0);

  const universities = getAllUniversities();
  const countries = Array.from(new Set(universities.map((u) => u.country))).sort();
  const totalCourses = universities.reduce((sum, u) => sum + u.courses.length, 0);
  const effectiveCountry = scopedCountry ?? country;

  const filtered = universities.filter((u) => {
    if (effectiveCountry !== "All" && u.country !== effectiveCountry) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q) || u.country.toLowerCase().includes(q);
  });

  function handleDelete(id: string, name: string) {
    if (!window.confirm(`Remove "${name}" from the catalog? This can't be undone, and any existing applications referencing it will keep showing its name as plain text.`)) return;
    deleteUniversity(id);
    forceTick((t) => t + 1);
  }

  const addUniversityHref = scopedCountry ? `/staff/data/universities/new?country=${encodeURIComponent(scopedCountry)}` : "/staff/data/universities/new";

  return (
    <div>
      {scopedCountry && (
        <button onClick={() => navigate("/staff/data")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-[var(--brand-600)]">
          <ArrowLeft size={14} /> Back to Countries
        </button>
      )}

      <PageHeader
        title={scopedCountry ? `Universities in ${scopedCountry}` : "Data Management — Universities"}
        subtitle={
          scopedCountry
            ? `Every partner university your catalog has in ${scopedCountry}.`
            : "The catalog agents, students, and counsellors browse and apply against. Add a university in a new country to make that country available as a destination everywhere."
        }
        action={<Button onClick={() => navigate(addUniversityHref)}><Plus size={15} /> Add University</Button>}
      />

      <div className="mb-6 flex flex-wrap gap-4">
        <StatTile label="Universities" value={String(filtered.length)} />
        <StatTile label="Courses" value={String(scopedCountry ? filtered.reduce((s, u) => s + u.courses.length, 0) : totalCourses)} />
        {!scopedCountry && <StatTile label="Countries" value={String(countries.length)} />}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 sm:max-w-sm">
          <Search size={15} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search university, city, or country…"
            className="w-full min-w-0 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        {!scopedCountry && (
          <select
            value={country}
            onChange={(e) => setCountry(e.target.value)}
            className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs text-slate-600"
          >
            <option value="All">All countries</option>
            {countries.map((c) => (
              <option key={c} value={c}>{c}</option>
            ))}
          </select>
        )}
      </div>

      <div className="space-y-2.5">
        {filtered.map((u) => (
          <div
            key={u.id}
            className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 cursor-pointer hover:border-slate-300"
            onClick={() => navigate(`/staff/data/universities/${u.id}`)}
          >
            <LogoBadge name={u.name} tone={u.tone} className="h-11 w-11 shrink-0 text-xs" />
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <p className="truncate text-xs font-semibold text-slate-800">{u.name}</p>
                <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400">{u.id}</span>
                {isCustomUniversity(u.id) && (
                  <span className="shrink-0 rounded-full bg-blue-50 px-2 py-0.5 text-[10.5px] font-semibold text-blue-700">Custom</span>
                )}
              </div>
              <p className="flex items-center gap-1 truncate text-xs text-slate-400"><Globe2 size={11} /> {u.city}, {u.country}</p>
            </div>
            <div className="flex shrink-0 items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><BookOpen size={12} /> {u.courses.length} course{u.courses.length === 1 ? "" : "s"}</span>
              <span className="flex items-center gap-1"><GraduationCap size={12} /> {u.worldRank}</span>
            </div>
            <button
              onClick={(e) => { e.stopPropagation(); handleDelete(u.id, u.name); }}
              aria-label={`Delete ${u.name}`}
              className="shrink-0 rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
            >
              <Trash2 size={15} />
            </button>
          </div>
        ))}
        {filtered.length === 0 && (
          <p className="rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
            No universities match this search.
          </p>
        )}
      </div>
    </div>
  );
}
