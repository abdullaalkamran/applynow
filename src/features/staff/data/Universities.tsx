import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Search, Plus, Pencil, Trash2, Globe2, GraduationCap, BookOpen, Users, Briefcase, FileText } from "lucide-react";
import { PageHeader, Button, StatTile } from "../../../components/ui";
import { LogoBadge } from "../../../components/ui/mobile";
import { getAllUniversities, deleteUniversity, isCustomUniversity } from "../../../data/universityCatalogStore";
import { getAllApplications } from "../../../data/applicationsStore";
import { getAllStudents } from "../../../data/allStudentsStore";
import { loadStaff } from "../../../data/staffStore";
import { getCountryByName } from "../../../data/countryRegistry";

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

  // Students with an application to this destination country, and the agents representing them —
  // shown on the country's own page so Data Management can see who a catalog change actually affects.
  const allStudents = getAllStudents();
  const studentIdsInCountry = scopedCountry
    ? new Set(getAllApplications().filter((a) => a.country.toLowerCase() === scopedCountry.toLowerCase()).map((a) => a.studentId))
    : new Set<string>();
  const studentsInCountry = allStudents.filter((s) => studentIdsInCountry.has(s.id));
  const agentIdsInCountry = new Set(studentsInCountry.map((s) => s.agentId).filter((id): id is string => !!id));
  const agentsInCountry = loadStaff().filter((s) => s.role === "agent" && agentIdsInCountry.has(s.id));

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
  const countryDetails = scopedCountry ? getCountryByName(scopedCountry) : undefined;
  const hasGuideContent = !!countryDetails && !!(countryDetails.whyThisCountry || countryDetails.applicationProcedure || countryDetails.visaProcedure || countryDetails.requiredDocuments?.length);

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

      {scopedCountry && <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">Country Overview</p>}
      <div className="mb-6 flex flex-wrap gap-4">
        <StatTile label="Universities" value={String(filtered.length)} />
        <StatTile label="Courses" value={String(scopedCountry ? filtered.reduce((s, u) => s + u.courses.length, 0) : totalCourses)} />
        {!scopedCountry && <StatTile label="Countries" value={String(countries.length)} />}
        {scopedCountry && <StatTile label="Students" value={String(studentsInCountry.length)} />}
        {scopedCountry && <StatTile label="Agents" value={String(agentsInCountry.length)} />}
      </div>

      {scopedCountry && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-800"><FileText size={13} /> Country Guide</p>
            <button
              onClick={() => navigate(`/staff/data/countries/${encodeURIComponent(scopedCountry)}/edit`)}
              className="flex items-center gap-1 text-xs font-medium text-[var(--brand-600)]"
            >
              <Pencil size={12} /> {hasGuideContent ? "Edit" : "Add"} Country Details
            </button>
          </div>
          {!hasGuideContent ? (
            <p className="text-xs text-slate-400">
              No guide content yet — add "Why This Country", required documents, and application/visa procedure so students, agents, and counsellors see it on every university in {scopedCountry}.
            </p>
          ) : (
            <div className="space-y-3">
              {countryDetails?.whyThisCountry && (
                <div>
                  <p className="text-xs font-semibold text-slate-700">Why This Country</p>
                  <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{countryDetails.whyThisCountry}</p>
                </div>
              )}
              {!!countryDetails?.requiredDocuments?.length && (
                <div>
                  <p className="text-xs font-semibold text-slate-700">Required Documents</p>
                  <div className="mt-1 flex flex-wrap gap-1.5">
                    {countryDetails.requiredDocuments.map((d) => (
                      <span key={d.id} className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">{d.name}</span>
                    ))}
                  </div>
                </div>
              )}
              {countryDetails?.applicationProcedure && (
                <div>
                  <p className="text-xs font-semibold text-slate-700">Application Procedure</p>
                  <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{countryDetails.applicationProcedure}</p>
                </div>
              )}
              {countryDetails?.visaProcedure && (
                <div>
                  <p className="text-xs font-semibold text-slate-700">Visa Procedure</p>
                  <p className="mt-1 whitespace-pre-line text-xs text-slate-500">{countryDetails.visaProcedure}</p>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {scopedCountry && (studentsInCountry.length > 0 || agentsInCountry.length > 0) && (
        <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-800"><Users size={13} /> Students applying here</p>
            {studentsInCountry.length === 0 ? (
              <p className="text-xs text-slate-400">No students yet.</p>
            ) : (
              <ul className="space-y-2">
                {studentsInCountry.map((s) => (
                  <li key={s.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${s.avatarColor}`}>
                      {s.name.slice(0, 1)}
                    </span>
                    {s.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-800"><Briefcase size={13} /> Agents active here</p>
            {agentsInCountry.length === 0 ? (
              <p className="text-xs text-slate-400">No agents yet.</p>
            ) : (
              <ul className="space-y-2">
                {agentsInCountry.map((a) => (
                  <li key={a.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${a.avatarColor}`}>
                      {a.name.slice(0, 1)}
                    </span>
                    {a.name}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

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
            <LogoBadge name={u.name} tone={u.tone} logoUrl={u.logoUrl} className="h-11 w-11 shrink-0 text-xs" />
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
