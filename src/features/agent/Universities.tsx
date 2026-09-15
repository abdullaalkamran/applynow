import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, MapPin } from "lucide-react";
import { PillSelect, LogoBadge } from "../../components/ui/mobile";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import {
  allPrograms, destinationOptions, subjectOptions, intakeOptions, FEE_BANDS, feeBandMax, countryStats,
} from "../../utils/universityFilter";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { ProgramRow } from "./ProgramRow";
import { CreateApplicationModal } from "./CreateApplicationModal";
import type { University } from "../../types";

type Course = University["courses"][number];
const TABS = ["Programs", "Universities", "Countries"] as const;

export default function AgentUniversities() {
  const navigate = useNavigate();
  const students = loadAgentStudents();
  const [tab, setTab] = useState<(typeof TABS)[number]>("Programs");

  // Programs tab — compact pill filters over the full course catalogue.
  const [subject, setSubject] = useState("");
  const [destination, setDestination] = useState("");
  const [intake, setIntake] = useState("");
  const [feeBand, setFeeBand] = useState("");

  // Universities tab — search + country.
  const [query, setQuery] = useState("");
  const [country, setCountry] = useState("All");

  const [applyTarget, setApplyTarget] = useState<{ university: University; course: Course } | null>(null);

  const UNIVERSITIES = getAllUniversities();
  const filteredPrograms = allPrograms().filter(({ university, course }) => {
    if (subject && course.subject !== subject) return false;
    if (destination && university.country !== destination) return false;
    if (intake && !university.intakes.includes(intake)) return false;
    if (feeBand && course.feeUSD > feeBandMax(feeBand)) return false;
    return true;
  });

  const filteredUniversities = UNIVERSITIES.filter((u) => {
    if (country !== "All" && u.country !== country) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return u.name.toLowerCase().includes(q) || u.city.toLowerCase().includes(q) || u.subjects.some((s) => s.toLowerCase().includes(q));
  });

  const hasProgramFilters = !!(subject || destination || intake || feeBand);

  return (
    <div>
      <div className="mb-4">
        <h1 className="text-base font-semibold text-slate-900">Explore Universities</h1>
        <p className="mt-1 text-xs text-slate-500">Browse {UNIVERSITIES.length} partner universities and {allPrograms().length} programs to shortlist or apply for your students.</p>
      </div>

      <div className="mb-4 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              tab === t ? "bg-slate-900 text-white" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === "Programs" && (
        <div>
          <div className="mb-3 flex items-center justify-between gap-2">
            <p className="text-xs text-slate-500">{filteredPrograms.length} program{filteredPrograms.length === 1 ? "" : "s"}</p>
            {hasProgramFilters && (
              <button
                onClick={() => { setSubject(""); setDestination(""); setIntake(""); setFeeBand(""); }}
                className="text-[11px] font-medium text-blue-600"
              >
                Clear filters
              </button>
            )}
          </div>

          <div className="mb-4 -mx-1 flex items-center gap-2 overflow-x-auto px-1 pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <PillSelect label="Subject" value={subject} onChange={setSubject} options={subjectOptions()} />
            <PillSelect label="Destination" value={destination} onChange={setDestination} options={destinationOptions()} />
            <PillSelect label="Intake" value={intake} onChange={setIntake} options={intakeOptions()} />
            <PillSelect label="Fees" value={feeBand} onChange={setFeeBand} options={[...FEE_BANDS]} />
          </div>

          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {filteredPrograms.map(({ university, course }) => (
              <ProgramRow
                key={`${university.id}-${course.name}`}
                university={university}
                course={course}
                students={students}
                onApply={(u, c) => setApplyTarget({ university: u, course: c })}
              />
            ))}
          </div>
          {filteredPrograms.length === 0 && (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
              <p className="text-xs text-slate-400">No programs match these filters.</p>
              <button onClick={() => { setSubject(""); setDestination(""); setIntake(""); setFeeBand(""); }} className="mt-2 text-[11px] font-medium text-blue-600">
                Reset filters
              </button>
            </div>
          )}
        </div>
      )}

      {tab === "Universities" && (
        <div>
          <div className="mb-4 flex flex-wrap items-center gap-2">
            <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:max-w-sm">
              <Search size={14} className="shrink-0 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search university, city, or subject…"
                className="w-full min-w-0 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
            </div>
            <select
              value={country}
              onChange={(e) => setCountry(e.target.value)}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600"
            >
              <option value="All">All countries</option>
              {destinationOptions().map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredUniversities.map((u) => (
              <button
                key={u.id}
                onClick={() => navigate(`/agent/universities/${u.id}`)}
                className="flex flex-col gap-3 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.05)] transition hover:border-slate-200 hover:shadow-[0_2px_14px_rgba(0,0,0,0.08)]"
              >
                <div className="flex items-center gap-3">
                  <LogoBadge name={u.name} tone={u.tone} className="h-10 w-10 shrink-0 text-xs" />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-semibold text-slate-800">{u.name}</p>
                    <p className="flex items-center gap-1 truncate text-[11px] text-slate-400"><MapPin size={10} /> {u.city}, {u.country}</p>
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {u.subjects.slice(0, 3).map((s) => (
                    <span key={s} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10.5px] text-slate-600">{s}</span>
                  ))}
                </div>
                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span>{u.worldRank} world rank</span>
                  <span>{u.employability} employability</span>
                </div>
              </button>
            ))}
            {filteredUniversities.length === 0 && (
              <p className="col-span-full py-10 text-center text-xs text-slate-400">No universities match this search.</p>
            )}
          </div>
        </div>
      )}

      {tab === "Countries" && (
        <div>
          <p className="mb-3 text-xs text-slate-500">{countryStats().length} destination{countryStats().length === 1 ? "" : "s"} across your partner universities.</p>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {countryStats().map((c) => (
              <button
                key={c.name}
                onClick={() => navigate(`/agent/countries/${encodeURIComponent(c.name)}`)}
                className="flex flex-col items-start gap-1 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.05)] transition hover:border-slate-200 hover:shadow-[0_2px_14px_rgba(0,0,0,0.08)]"
              >
                <p className="text-xs font-semibold text-slate-800">{c.name}</p>
                <p className="text-[11px] text-slate-500">{c.universityCount} universit{c.universityCount === 1 ? "y" : "ies"} · {c.courseCount} course{c.courseCount === 1 ? "" : "s"}</p>
              </button>
            ))}
            {countryStats().length === 0 && (
              <p className="col-span-full py-10 text-center text-xs text-slate-400">No destinations yet.</p>
            )}
          </div>
        </div>
      )}

      {applyTarget && (
        <CreateApplicationModal
          students={students}
          initialUniversityId={applyTarget.university.id}
          initialCourseName={applyTarget.course.name}
          onClose={() => setApplyTarget(null)}
          onCreated={() => setApplyTarget(null)}
        />
      )}
    </div>
  );
}
