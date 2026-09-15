import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, Pencil, Trash2, Globe2, GraduationCap, ChevronRight } from "lucide-react";
import { PageHeader, Button, StatTile } from "../../../components/ui";
import { getAllUniversities } from "../../../data/universityCatalogStore";
import { getAllCountries, getCountryId, deleteCountry } from "../../../data/countryRegistry";

export default function DataCountries() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [, forceTick] = useState(0);

  const universities = getAllUniversities();
  const totalCourses = universities.reduce((sum, u) => sum + u.courses.length, 0);

  const byCountry = new Map<string, typeof universities>();
  universities.forEach((u) => {
    const list = byCountry.get(u.country) ?? [];
    list.push(u);
    byCountry.set(u.country, list);
  });

  // Every registered country shows up here, even ones with zero universities yet (added directly
  // via "Add Country" below) — not just ones inferred from an existing university's `.country`.
  getAllCountries().forEach((c) => {
    if (!byCountry.has(c.name)) byCountry.set(c.name, []);
  });

  const countries = Array.from(byCountry.entries())
    .map(([country, list]) => ({
      country,
      universities: list,
      courseCount: list.reduce((sum, u) => sum + u.courses.length, 0),
    }))
    .filter((c) => !query.trim() || c.country.toLowerCase().includes(query.trim().toLowerCase()))
    .sort((a, b) => b.universities.length - a.universities.length);

  function handleDeleteCountry(country: string, universityCount: number) {
    if (universityCount > 0) {
      window.alert(`Can't delete "${country}" — it still has ${universityCount} universit${universityCount === 1 ? "y" : "ies"} in the catalog. Remove those first.`);
      return;
    }
    if (!window.confirm(`Delete "${country}"? This can't be undone.`)) return;
    deleteCountry(getCountryId(country));
    forceTick((t) => t + 1);
  }

  return (
    <div>
      <PageHeader
        title="Data Management — Countries"
        subtitle="Every country your catalog covers, with the universities and courses underneath it. Add a university in a new country to make it appear here automatically."
        action={
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => navigate("/staff/data/countries/new")}><Plus size={15} /> Add Country</Button>
            <Button onClick={() => navigate("/staff/data/universities/new")}><Plus size={15} /> Add University</Button>
          </div>
        }
      />

      <div className="mb-6 flex flex-wrap gap-4">
        <StatTile label="Countries" value={String(byCountry.size)} />
        <StatTile label="Universities" value={String(universities.length)} />
        <StatTile label="Courses" value={String(totalCourses)} />
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 max-w-sm">
        <Search size={15} className="shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search countries…"
          className="w-full bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {countries.map((c) => (
          <div
            key={c.country}
            onClick={() => navigate(`/staff/data/countries/${encodeURIComponent(c.country)}`)}
            className="flex cursor-pointer items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left hover:border-slate-300"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--brand-50)] text-[var(--brand-700)]">
                <Globe2 size={18} />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-slate-800">{c.country}</p>
                <p className="flex items-center gap-1 text-xs text-slate-400">
                  <GraduationCap size={11} /> {c.universities.length} universit{c.universities.length === 1 ? "y" : "ies"} · {c.courseCount} courses
                </p>
                <span className="mt-1 inline-block max-w-full truncate rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-400">{getCountryId(c.country)}</span>
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <button
                onClick={(e) => { e.stopPropagation(); navigate(`/staff/data/countries/${encodeURIComponent(c.country)}/edit`); }}
                aria-label={`Edit ${c.country}`}
                className="rounded-lg p-2 text-slate-300 hover:bg-slate-50 hover:text-slate-600"
              >
                <Pencil size={15} />
              </button>
              <button
                onClick={(e) => { e.stopPropagation(); handleDeleteCountry(c.country, c.universities.length); }}
                aria-label={`Delete ${c.country}`}
                className="rounded-lg p-2 text-slate-300 hover:bg-rose-50 hover:text-rose-600"
              >
                <Trash2 size={15} />
              </button>
              <ChevronRight size={16} className="shrink-0 text-slate-300" />
            </div>
          </div>
        ))}
        {countries.length === 0 && (
          <p className="col-span-full rounded-xl border border-dashed border-slate-200 bg-white p-10 text-center text-xs text-slate-400">
            No countries match this search.
          </p>
        )}
      </div>
    </div>
  );
}
