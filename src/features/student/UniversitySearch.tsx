import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  Search, SlidersHorizontal, Heart, MapPin, X, CalendarClock, Award,
  Wallet, CalendarDays, GraduationCap, Building2, ChevronRight, Bookmark, ArrowUpRight,
} from "lucide-react";
import { BackButton, SkylineArt, Pill, Chip, LogoBadge, PillSelect } from "../../components/ui/mobile";
import { STUDENTS, CURRENT_STUDENT_ID } from "../../data/mockData";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { countryByName } from "../../data/countries";
import {
  emptyFilters, applyFilters, countActiveFilters, courseFeeForSubject, matchingCourse,
  allPrograms, FEE_BANDS, feeBandMax, scholarshipAmountUSD, subjectOptions, destinationOptions,
  countryStats, type UniversityFilterState,
} from "../../utils/universityFilter";
import { ApplyModal } from "./ApplyModal";
import { isShortlisted, toggleShortlisted } from "../../data/shortlistStore";
import type { University } from "../../types";

type Tab = "universities" | "subjects" | "countries";

type SortBy = "best" | "rank" | "employability" | "name";
const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "best", label: "Best Match" },
  { value: "rank", label: "World Ranking" },
  { value: "employability", label: "Employability" },
  { value: "name", label: "Name (A–Z)" },
];

function rankNumber(rank: string) {
  return parseInt(rank.replace(/\D/g, ""), 10) || Infinity;
}
function employabilityNumber(emp: string) {
  return parseInt(emp.replace(/\D/g, ""), 10) || 0;
}

const student = STUDENTS.find((s) => s.id === CURRENT_STUDENT_ID)!;
const defaultResidenceCountry = countryByName(student.country)?.iso2 ?? "";

export interface FiltersOutletContext {
  filters: UniversityFilterState;
  setFilters: Dispatch<SetStateAction<UniversityFilterState>>;
  resultCount: number;
}

export default function UniversitySearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [, setShortlistTick] = useState(0);

  function toggleProgramShortlist(programKey: string) {
    toggleShortlisted(programKey);
    setShortlistTick((t) => t + 1);
  }
  const [applyTarget, setApplyTarget] = useState<{ university: University; course: University["courses"][number] } | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("best");
  const [filters, setFilters] = useState<UniversityFilterState>(() => emptyFilters(defaultResidenceCountry));
  const [tab, setTab] = useState<Tab>("subjects");

  // Independent, compact filters for the flat "all programs" list on the Subjects tab.
  const [programSubject, setProgramSubject] = useState("");
  const [programDestination, setProgramDestination] = useState("");
  const [programIntake, setProgramIntake] = useState("");
  const [programFeeBand, setProgramFeeBand] = useState("");
  const [programScholarship, setProgramScholarship] = useState("");

  const showingFilters = location.pathname === "/student/search/filters";

  const results = useMemo(() => {
    const filtered = applyFilters(getAllUniversities(), filters, query);
    const sorted = [...filtered];
    if (sortBy === "rank") sorted.sort((a, b) => rankNumber(a.worldRank) - rankNumber(b.worldRank));
    else if (sortBy === "employability") sorted.sort((a, b) => employabilityNumber(b.employability) - employabilityNumber(a.employability));
    else if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [query, filters, sortBy]);

  const programIntakeOptions = useMemo(() => Array.from(new Set(allPrograms().map((p) => p.university.openIntake))).sort(), []);

  const programs = useMemo(
    () =>
      allPrograms().filter(({ university: u, course: c }) => {
        if (programSubject && c.subject !== programSubject) return false;
        if (programDestination && u.country !== programDestination) return false;
        if (programIntake && u.openIntake !== programIntake) return false;
        if (programFeeBand && c.feeUSD > feeBandMax(programFeeBand)) return false;
        if (programScholarship === "Available" && !u.scholarshipsAvailable) return false;
        return true;
      }),
    [programSubject, programDestination, programIntake, programFeeBand, programScholarship]
  );

  if (showingFilters) {
    return <Outlet context={{ filters, setFilters, resultCount: results.length } satisfies FiltersOutletContext} />;
  }

  const activeFilterCount = countActiveFilters(filters);

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function resetProgramFilters() {
    setProgramSubject("");
    setProgramDestination("");
    setProgramIntake("");
    setProgramFeeBand("");
    setProgramScholarship("");
  }

  function openProgram(universityId: string, courseName: string, subject: string) {
    navigate(`/student/universities/${universityId}`, { state: { selectedCourseName: courseName, subject } });
  }

  function openUniversityProfile(universityId: string) {
    navigate(`/student/universities/${universityId}`);
  }

  const subjectQueryText = filters.subjectQuery.trim() || filters.courseQuery.trim() || query.trim();

  return (
    <div className="px-5 pb-6 pt-6 lg:px-10 lg:pb-10 lg:pt-8">
      <div className="lg:mx-auto lg:max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <BackButton />
          </div>
          <h1 className="text-xl font-bold text-slate-900 lg:text-2xl">Explore Universities</h1>
        </div>

        <div className="mt-4 flex items-center gap-1 rounded-xl bg-[var(--sd-card)] p-1 shadow-[0_0_10px_rgba(0,0,0,0.11)] lg:w-fit">
          <button
            onClick={() => setTab("universities")}
            className={`rounded-lg px-6 py-2 text-[13px] font-medium transition-colors lg:flex-none ${
              tab === "universities" ? "bg-[image:var(--sd-gradient)] text-white" : "text-slate-500"
            } flex-1`}
          >
            Universities
          </button>
          <button
            onClick={() => setTab("subjects")}
            className={`rounded-lg px-6 py-2 text-[13px] font-medium transition-colors lg:flex-none ${
              tab === "subjects" ? "bg-[image:var(--sd-gradient)] text-white" : "text-slate-500"
            } flex-1`}
          >
            Subjects
          </button>
          <button
            onClick={() => setTab("countries")}
            className={`rounded-lg px-6 py-2 text-[13px] font-medium transition-colors lg:flex-none ${
              tab === "countries" ? "bg-[image:var(--sd-gradient)] text-white" : "text-slate-500"
            } flex-1`}
          >
            Countries
          </button>
        </div>

        {tab === "countries" ? (
          <div className="mt-4">
            <p className="text-[13px] text-slate-500">{countryStats().length} destination{countryStats().length === 1 ? "" : "s"} to explore.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
              {countryStats().map((c) => (
                <button
                  key={c.name}
                  onClick={() => navigate(`/student/countries/${encodeURIComponent(c.name)}`)}
                  className="flex flex-col items-start gap-1 rounded-2xl bg-[var(--sd-card)] p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)]"
                >
                  <p className="text-[14px] font-semibold text-slate-900">{c.name}</p>
                  <p className="text-[11.5px] text-slate-500">{c.universityCount} universit{c.universityCount === 1 ? "y" : "ies"}</p>
                  <p className="text-[11.5px] text-slate-500">{c.courseCount} course{c.courseCount === 1 ? "" : "s"}</p>
                </button>
              ))}
              {countryStats().length === 0 && (
                <div className="col-span-full rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-[0_0_10px_rgba(0,0,0,0.11)]">
                  <p className="text-sm font-medium text-slate-700">No destinations yet</p>
                </div>
              )}
            </div>
          </div>
        ) : tab === "subjects" ? (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-slate-500">
                {programs.length} {programs.length === 1 ? "program" : "programs"} from top universities worldwide.
              </p>
              {(programSubject || programDestination || programIntake || programFeeBand || programScholarship) && (
                <button onClick={resetProgramFilters} className="flex items-center gap-0.5 text-[12px] font-medium text-rose-500">
                  <X size={11} /> Clear
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2 overflow-x-auto pb-1">
              <PillSelect label="Subject" value={programSubject} options={subjectOptions()} onChange={setProgramSubject} placeholder="All subjects" />
              <PillSelect label="Destination" value={programDestination} options={destinationOptions()} onChange={setProgramDestination} placeholder="All destinations" />
              <PillSelect label="Intake" value={programIntake} options={programIntakeOptions} onChange={setProgramIntake} placeholder="Any intake" />
              <PillSelect label="Fees" value={programFeeBand} options={FEE_BANDS} onChange={setProgramFeeBand} placeholder="Any fee" />
              <PillSelect label="Scholarship" value={programScholarship} options={["Available"]} onChange={setProgramScholarship} placeholder="Any" />
            </div>

            <div className="mt-4 overflow-hidden rounded-2xl bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.11)] lg:grid lg:grid-cols-2 lg:gap-x-6 lg:rounded-none lg:bg-transparent lg:shadow-none">
              {programs.map(({ university: u, course: c }, i) => {
                const scholarshipUSD = scholarshipAmountUSD(u, c.feeUSD);
                const programKey = `${u.id}::${c.name}`;
                const shortlisted = isShortlisted(programKey);
                return (
                  <div
                    key={programKey}
                    onClick={() => openProgram(u.id, c.name, c.subject)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") openProgram(u.id, c.name, c.subject); }}
                    className={`flex w-full cursor-pointer items-center gap-3 px-4 py-3.5 text-left lg:rounded-2xl lg:bg-[var(--sd-card)] lg:px-4 lg:shadow-[0_0_10px_rgba(0,0,0,0.11)] ${
                      i !== programs.length - 1 ? "border-b border-slate-100 lg:border-b-0 lg:mb-3" : "lg:mb-3"
                    }`}
                  >
                    <LogoBadge name={u.name} tone={u.tone} className="h-12 w-12" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[13px] text-slate-400">{u.name}</p>
                      <p className="truncate text-[14.5px] font-semibold text-slate-900">{c.name}</p>
                      <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <Wallet size={11} className="text-slate-400" /> {u.currencySymbol}
                          {Math.round(c.feeUSD).toLocaleString()}
                        </span>
                        <span className="inline-flex items-center gap-1">
                          <CalendarDays size={11} className="text-slate-400" /> {u.openIntake}
                        </span>
                        {scholarshipUSD && (
                          <span className="inline-flex items-center gap-1">
                            <GraduationCap size={11} className="text-slate-400" /> Up to ${scholarshipUSD.toLocaleString()}
                          </span>
                        )}
                        <span className="inline-flex items-center gap-1">
                          <Building2 size={11} className="text-slate-400" /> Main Campus
                        </span>
                      </div>
                      <div className="mt-1.5 flex items-center justify-between gap-2">
                        <span
                          onClick={(e) => { e.stopPropagation(); openUniversityProfile(u.id); }}
                          className="inline-flex items-center gap-1 text-[11.5px] font-semibold text-[var(--sd-ink)]"
                        >
                          University Profile <ArrowUpRight size={11} />
                        </span>
                        <button
                          onClick={(e) => { e.stopPropagation(); setApplyTarget({ university: u, course: c }); }}
                          className="shrink-0 rounded-lg bg-[image:var(--sd-gradient)] px-3.5 py-1.5 text-[11.5px] font-semibold text-white"
                        >
                          Apply Now
                        </button>
                      </div>
                    </div>
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleProgramShortlist(programKey); }}
                      aria-label={shortlisted ? "Remove from shortlist" : "Shortlist"}
                      className={`shrink-0 ${shortlisted ? "text-[var(--sd-ink)]" : "text-slate-300"}`}
                    >
                      <Bookmark size={16} className={shortlisted ? "fill-[var(--sd-ink)]" : ""} />
                    </span>
                    <ChevronRight size={16} className="shrink-0 text-slate-300" />
                  </div>
                );
              })}

              {programs.length === 0 && (
                <div className="p-6 text-center lg:col-span-full lg:rounded-2xl lg:bg-[var(--sd-card)] lg:shadow-[0_0_10px_rgba(0,0,0,0.11)]">
                  <p className="text-sm font-medium text-slate-700">No programs match these filters</p>
                  <button onClick={resetProgramFilters} className="mt-2 text-[12.5px] font-medium text-[var(--sd-ink)]">
                    Reset filters
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <>
            <div className="mt-4 flex flex-col gap-2 lg:flex-row lg:items-center">
              <div className="flex items-center gap-2 rounded-xl bg-[var(--sd-card)] px-3.5 py-3 shadow-[0_0_10px_rgba(0,0,0,0.11)] lg:flex-1">
                <Search size={17} className="text-slate-400" />
                <input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search university, course or city"
                  className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
                />
              </div>

              <div className="flex items-center gap-2">
                <button
                  onClick={() => navigate("/student/search/filters")}
                  className={`relative flex flex-1 items-center justify-center gap-1.5 rounded-xl px-5 py-2.5 text-[13px] font-medium lg:flex-none ${
                    activeFilterCount > 0 ? "bg-[image:var(--sd-gradient)] text-white" : "border border-slate-200 bg-[var(--sd-card)] text-slate-600"
                  }`}
                >
                  <SlidersHorizontal size={14} /> Filters
                  {activeFilterCount > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--sd-card)]/20 px-1 text-[10px] font-semibold">
                      {activeFilterCount}
                    </span>
                  )}
                </button>
                <button
                  onClick={() => setSortOpen((v) => !v)}
                  className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl shadow-[0_0_10px_rgba(0,0,0,0.11)] ${
                    sortOpen ? "bg-[image:var(--sd-gradient)] text-white" : "bg-[var(--sd-card)] text-slate-500"
                  }`}
                  aria-label="Sort"
                >
                  <SlidersHorizontal size={15} className="rotate-90" />
                </button>
              </div>
            </div>

            {sortOpen && (
              <div className="mt-2 flex flex-wrap gap-2 rounded-2xl bg-[var(--sd-card)] p-3 shadow-[0_0_10px_rgba(0,0,0,0.11)] lg:w-fit">
                {SORT_OPTIONS.map((s) => (
                  <Chip key={s.value} label={s.label} selected={sortBy === s.value} onClick={() => { setSortBy(s.value); setSortOpen(false); }} />
                ))}
              </div>
            )}

            <div className="mt-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <p className="text-[13px] text-slate-500">{results.length} {results.length === 1 ? "university" : "universities"} found</p>
                {activeFilterCount > 0 && (
                  <button onClick={() => setFilters(emptyFilters(defaultResidenceCountry))} className="flex items-center gap-0.5 text-[12px] font-medium text-rose-500">
                    <X size={11} /> Clear
                  </button>
                )}
              </div>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {results.length === 0 && (
                <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-[0_0_10px_rgba(0,0,0,0.11)] lg:col-span-full">
                  <p className="text-sm font-medium text-slate-700">No universities match your filters</p>
                  <p className="mt-1 text-xs text-slate-400">Try clearing a filter or searching a different term.</p>
                </div>
              )}
              {results.map((u) => {
                const fav = favorites.has(u.id);
                const feeUSD = courseFeeForSubject(u, subjectQueryText);
                const matchedCourse = matchingCourse(u, subjectQueryText);
                return (
                  <button
                    key={u.id}
                    onClick={() => navigate(`/student/universities/${u.id}`)}
                    className="flex w-full items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-3 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)]"
                  >
                    <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                      <SkylineArt tone={u.tone} className="h-full w-full" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[14px] font-semibold text-slate-900">{u.name}</p>
                        <span
                          onClick={(e) => { e.stopPropagation(); toggleFavorite(u.id); }}
                          className="shrink-0 text-slate-300"
                        >
                          <Heart size={16} className={fav ? "fill-rose-500 text-rose-500" : ""} />
                        </span>
                      </div>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-slate-400">
                        <MapPin size={11} /> {u.city}, {u.country}
                      </p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
                        <Pill tone="blue">{u.tags[0]}</Pill>
                        <Pill tone="green">{u.tags[1]}</Pill>
                      </div>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2.5 text-[11px] text-slate-500">
                        <span className="inline-flex items-center gap-1">
                          <CalendarClock size={11} className="text-slate-400" /> Open: {u.openIntake}
                        </span>
                        {u.scholarshipsAvailable && (
                          <span className="inline-flex items-center gap-1 text-[#12805A]">
                            <Award size={11} /> Scholarships
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-[11px] font-medium text-slate-700">
                        ≈${Math.round(feeUSD).toLocaleString()}/yr{matchedCourse ? ` · ${matchedCourse.name}` : ""}
                      </p>
                    </div>
                  </button>
                );
              })}
            </div>
          </>
        )}
      </div>

      {applyTarget && (
        <ApplyModal university={applyTarget.university} course={applyTarget.course} onClose={() => setApplyTarget(null)} />
      )}
    </div>
  );
}
