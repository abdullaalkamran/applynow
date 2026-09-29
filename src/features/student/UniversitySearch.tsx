import { useMemo, useState, type Dispatch, type SetStateAction } from "react";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  Search, SlidersHorizontal, Heart, MapPin, X, CalendarClock,
  Wallet, CalendarDays, GraduationCap, Building2, ChevronDown, Bookmark, Landmark, Send, AlertCircle,
} from "lucide-react";
import { BackButton, Chip, DropdownChips, SubLabel, Pagination } from "../../components/ui/mobile";
import { usePagedList } from "../../utils/usePagedList";
import { CURRENT_STUDENT_ID } from "../../data/mockData";
import { getAllStudents } from "../../data/allStudentsStore";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { COUNTRIES, countryByName } from "../../data/countries";
import { getProfileCompletion } from "../../data/profileCompletion";
import {
  emptyFilters, applyFilters, countActiveFilters,
  allPrograms, scholarshipLabel, depositLabel, courseHasOpenIntake,
  countryStats, intakeOptions, yearOptions, type UniversityFilterState,
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

// Matches LogoBadge's own initials logic exactly — this card renders its own flat-color badge
// (rather than LogoBadge's gradient one) only for this specific design, so the fallback letter(s)
// shown must still be identical to what LogoBadge would have picked for the same name.
function universityInitials(name: string) {
  return name.replace(/^University of /, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

function rankNumber(rank: string) {
  return parseInt(rank.replace(/\D/g, ""), 10) || Infinity;
}
function employabilityNumber(emp: string) {
  return parseInt(emp.replace(/\D/g, ""), 10) || 0;
}

export interface FiltersOutletContext {
  filters: UniversityFilterState;
  setFilters: Dispatch<SetStateAction<UniversityFilterState>>;
  resultCount: number;
}

export default function UniversitySearch() {
  const navigate = useNavigate();
  const location = useLocation();
  const student = getAllStudents().find((s) => s.id === CURRENT_STUDENT_ID);
  const defaultResidenceCountry = countryByName(student?.country ?? "")?.iso2 ?? "";
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  // Bumped on every bookmark toggle so the memoised program list re-evaluates — matters when the
  // "Shortlisted" chip is on and un-bookmarking a program should drop it from the list immediately.
  const [shortlistTick, setShortlistTick] = useState(0);

  function toggleProgramShortlist(programKey: string) {
    toggleShortlisted(programKey);
    setShortlistTick((t) => t + 1);
  }
  const [applyTarget, setApplyTarget] = useState<{ university: University; course: University["courses"][number] } | null>(null);
  const [sortOpen, setSortOpen] = useState(false);
  const [intakeDropdownOpen, setIntakeDropdownOpen] = useState(false);
  // On mobile the full filter grid (Intake/Year/Nationality/State) takes up too much vertical
  // space above the results — collapsed by default there, tap to expand; always shown on lg:+
  // where there's room for the whole row at once (see the "contents" wrapper below).
  const [filtersExpanded, setFiltersExpanded] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("best");
  const [filters, setFilters] = useState<UniversityFilterState>(() => emptyFilters(defaultResidenceCountry));
  // `/student/search?shortlisted=1` (the Dashboard's "Saved Programs" tile) lands straight on the
  // Subjects tab with only the student's bookmarked programs showing.
  const openOnShortlist = new URLSearchParams(location.search).get("shortlisted") === "1";
  const [tab, setTab] = useState<Tab>("subjects");

  // The flat "all programs" list on the Subjects tab also honours the one shared search bar/filter
  // panel above (see advancedFilteredUniversityIds below) — this is only its own quick toggle for
  // narrowing that list down to what's already bookmarked.
  const [programShortlistedOnly, setProgramShortlistedOnly] = useState(openOnShortlist);

  const showingFilters = location.pathname === "/student/search/filters";

  const results = useMemo(() => {
    const filtered = applyFilters(getAllUniversities(), filters, query);
    const sorted = [...filtered];
    if (sortBy === "rank") sorted.sort((a, b) => rankNumber(a.worldRank) - rankNumber(b.worldRank));
    else if (sortBy === "employability") sorted.sort((a, b) => employabilityNumber(b.employability) - employabilityNumber(a.employability));
    else if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [query, filters, sortBy]);

  // Universities that pass the shared top search bar + Advanced Search filters — reused to gate the
  // Subjects tab's flat program list too, so the one search bar shown on every tab actually filters
  // every tab rather than just being visually present on the ones that didn't build it.
  const advancedFilteredUniversityIds = useMemo(() => new Set(results.map((u) => u.id)), [results]);

  // Countries tab only meaningfully honours the shared bar's free-text search (matching by country
  // name) — the other advanced fields don't map onto a plain destination list, and countryStats()
  // deliberately keeps zero-university countries visible (real Country Guide content can exist
  // before any partner university does), which a full applyFilters() pass would hide.
  const countryStatsFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? countryStats().filter((c) => c.name.toLowerCase().includes(q)) : countryStats();
  }, [query]);

  const programs = useMemo(
    () =>
      allPrograms().filter(({ university: u, course: c }) => {
        if (!advancedFilteredUniversityIds.has(u.id)) return false;
        if (programShortlistedOnly && !isShortlisted(`${u.id}::${c.name}`)) return false;
        return true;
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps -- shortlistTick re-reads localStorage-backed bookmarks
    [advancedFilteredUniversityIds, programShortlistedOnly, shortlistTick]
  );
  const programFiltersActive = programShortlistedOnly;
  const programsPage = usePagedList(programs, 30, `${query}:${JSON.stringify(filters)}:${programShortlistedOnly}`);
  const resultsPage = usePagedList(results, 30, `${query}:${JSON.stringify(filters)}:${sortBy}`);

  // Explore/apply is gated on having filled in the required parts of the profile — a counsellor or
  // admission officer needs that information to actually process an application, so letting someone
  // browse into applying without it just produces applications no one can act on. Only checked once
  // the student record has actually loaded (see the `!student` trade-off noted above).
  const profileCompletion = student ? getProfileCompletion(student.id) : null;
  if (profileCompletion && profileCompletion.requiredRemaining > 0) {
    const nextStep = profileCompletion.pendingSteps.find((s) => s.required) ?? profileCompletion.pendingSteps[0];
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-8 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
          <AlertCircle size={26} />
        </div>
        <h1 className="mt-4 text-[17px] font-bold text-slate-900">Complete your profile first</h1>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-slate-500">
          We need a few more details before you can explore and apply to programs — it only takes a couple of minutes.
        </p>
        <button
          onClick={() => navigate(nextStep.path)}
          className="mt-5 rounded-xl bg-[image:var(--sd-gradient)] px-6 py-3 text-[13px] font-semibold text-white"
        >
          Complete Profile
        </button>
      </div>
    );
  }

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
    setProgramShortlistedOnly(false);
  }

  function toggleFilterIntake(month: string) {
    setFilters((f) => {
      const next = new Set(f.intakes);
      if (next.has(month)) next.delete(month); else next.add(month);
      return { ...f, intakes: next };
    });
  }

  function openProgram(universityId: string, courseName: string, subject: string) {
    navigate(`/student/universities/${universityId}`, { state: { selectedCourseName: courseName, subject } });
  }

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

        <div className="mt-4 rounded-2xl bg-[var(--sd-card)] p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <div className="lg:col-span-1">
              <SubLabel>Search Programs</SubLabel>
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 px-3 py-2.5">
                  <Search size={15} className="shrink-0 text-slate-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search Program / University"
                    className="w-full min-w-0 bg-transparent text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setFiltersExpanded((v) => !v)}
                  aria-label={filtersExpanded ? "Hide filters" : "Show more filters"}
                  aria-expanded={filtersExpanded}
                  className={`flex h-[38px] w-[38px] shrink-0 items-center justify-center rounded-xl sm:hidden ${
                    filtersExpanded || activeFilterCount > 0 ? "bg-[image:var(--sd-gradient)] text-white" : "bg-slate-100 text-slate-500"
                  }`}
                >
                  <ChevronDown size={16} className={`transition-transform ${filtersExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>
            <div className={filtersExpanded ? "contents" : "hidden sm:contents"}>
              <div>
                <DropdownChips
                  label="Intake"
                  options={intakeOptions()}
                  selected={filters.intakes}
                  onToggle={toggleFilterIntake}
                  open={intakeDropdownOpen}
                  onToggleOpen={() => setIntakeDropdownOpen((v) => !v)}
                  placeholder="All intakes"
                />
              </div>
              <div>
                <SubLabel>Year</SubLabel>
                <select
                  value={filters.year}
                  onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] text-slate-700"
                >
                  <option value="">Any year</option>
                  {yearOptions().map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
              <div>
                <SubLabel>Student's Nationality</SubLabel>
                <select
                  value={filters.residenceCountry}
                  onChange={(e) => setFilters((f) => ({ ...f, residenceCountry: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] text-slate-700"
                >
                  <option value="">Any nationality</option>
                  {COUNTRIES.map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <SubLabel>Student's State</SubLabel>
                  <input
                    value={filters.studentState}
                    onChange={(e) => setFilters((f) => ({ ...f, studentState: e.target.value }))}
                    placeholder="Student's State"
                    className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-[13px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setIntakeDropdownOpen(false)}
                  aria-label="Search"
                  className="flex h-[38px] w-[46px] shrink-0 items-center justify-center rounded-xl bg-[image:var(--sd-gradient)] text-white"
                >
                  <Search size={16} />
                </button>
              </div>
            </div>
          </div>

          <div className="mt-3 flex items-center justify-between">
            <button
              onClick={() => navigate("/student/search/filters")}
              className="flex items-center gap-1 text-[13px] font-medium text-[#2955C4]"
            >
              Advanced Search {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters(emptyFilters(defaultResidenceCountry))} className="flex items-center gap-0.5 text-[12px] font-medium text-rose-500">
                  <X size={11} /> Clear All
                </button>
              )}
              {tab === "universities" && (
                <button
                  onClick={() => setSortOpen((v) => !v)}
                  className={`flex h-[30px] w-[30px] shrink-0 items-center justify-center rounded-lg ${
                    sortOpen ? "bg-[image:var(--sd-gradient)] text-white" : "bg-slate-100 text-slate-500"
                  }`}
                  aria-label="Sort"
                >
                  <SlidersHorizontal size={14} className="rotate-90" />
                </button>
              )}
            </div>
          </div>
        </div>

        {tab === "universities" && sortOpen && (
          <div className="mt-2 flex flex-wrap gap-2 rounded-2xl bg-[var(--sd-card)] p-3 shadow-[0_0_10px_rgba(0,0,0,0.11)] lg:w-fit">
            {SORT_OPTIONS.map((s) => (
              <Chip key={s.value} label={s.label} selected={sortBy === s.value} onClick={() => { setSortBy(s.value); setSortOpen(false); }} />
            ))}
          </div>
        )}

        {tab === "countries" ? (
          <div className="mt-4">
            <p className="text-[13px] text-slate-500">{countryStatsFiltered.length} destination{countryStatsFiltered.length === 1 ? "" : "s"} to explore.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3">
              {countryStatsFiltered.map((c) => (
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
              {countryStatsFiltered.length === 0 && (
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
                {programShortlistedOnly
                  ? `${programs.length} shortlisted ${programs.length === 1 ? "program" : "programs"}.`
                  : `${programs.length} ${programs.length === 1 ? "program" : "programs"} from top universities worldwide.`}
              </p>
              {programFiltersActive && (
                <button onClick={resetProgramFilters} className="flex items-center gap-0.5 text-[12px] font-medium text-rose-500">
                  <X size={11} /> Clear
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center gap-2">
              <Chip
                label="Shortlisted"
                selected={programShortlistedOnly}
                onClick={() => setProgramShortlistedOnly((v) => !v)}
                icon={<Bookmark size={12} className={programShortlistedOnly ? "fill-white" : ""} />}
              />
            </div>

            {/* Same card shape as the Universities tab below (big logo tile, title, location line,
                divider, detail row) so both tabs read as one consistent catalog. */}
            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {programsPage.pageItems.map(({ university: u, course: c }) => {
                const scholarship = scholarshipLabel(u);
                const programKey = `${u.id}::${c.name}`;
                const shortlisted = isShortlisted(programKey);
                const open = courseHasOpenIntake(u, c);
                return (
                  <div
                    key={programKey}
                    onClick={() => openProgram(u.id, c.name, c.subject)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter") openProgram(u.id, c.name, c.subject); }}
                    className="relative flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-3.5 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)] sm:gap-4 sm:rounded-3xl sm:p-5"
                  >
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleProgramShortlist(programKey); }}
                      aria-label={shortlisted ? "Remove from shortlist" : "Shortlist"}
                      className={`absolute right-3 top-3 shrink-0 sm:right-4 sm:top-4 ${shortlisted ? "text-[var(--sd-ink)]" : "text-slate-300"}`}
                    >
                      <Bookmark size={18} className={shortlisted ? "fill-[var(--sd-ink)]" : ""} />
                    </span>

                    {u.logoUrl ? (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white sm:h-24 sm:w-24 sm:rounded-2xl">
                        <img src={u.logoUrl} alt={`${u.name} logo`} className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F1EEFB] text-lg font-semibold text-slate-500 sm:h-24 sm:w-24 sm:rounded-2xl sm:text-3xl">
                        {universityInitials(u.name)}
                      </div>
                    )}

                    <div className="min-w-0 flex-1 pr-6 sm:pr-7">
                      <p className="truncate text-[13.5px] font-semibold leading-snug text-slate-900 sm:text-xl">{c.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 sm:mt-1.5 sm:gap-1.5 sm:text-sm">
                        <Building2 size={12} className="shrink-0" /> <span className="truncate">{u.name}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[9.5px] text-slate-400 sm:mt-1.5 sm:text-[10.5px]">
                        <span className="inline-flex shrink-0 items-center gap-1">
                          <Wallet size={11} /> {u.currencySymbol}{Math.round(c.feeUSD).toLocaleString()}
                        </span>
                        {depositLabel(u) && (
                          <>
                            <span className="shrink-0">·</span>
                            <span className="inline-flex shrink-0 items-center gap-1">
                              <Landmark size={11} /> {depositLabel(u)}
                            </span>
                          </>
                        )}
                      </div>
                      <div className="mt-2.5 flex items-center gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 sm:mt-4 sm:gap-3 sm:pt-3 sm:text-sm">
                        {u.openIntake && (
                          <span className="inline-flex min-w-0 items-center gap-1 sm:gap-1.5">
                            <CalendarDays size={13} className="shrink-0 text-slate-400" /> <span className="truncate">Open: {u.openIntake}</span>
                          </span>
                        )}
                        {scholarship && (
                          <>
                            <span className="h-3.5 w-px shrink-0 bg-slate-200 sm:h-4" />
                            <span className="inline-flex min-w-0 items-center gap-1 sm:gap-1.5">
                              <GraduationCap size={13} className="shrink-0 text-slate-400" /> <span className="truncate">{scholarship}</span>
                            </span>
                          </>
                        )}
                        <button
                          onClick={(e) => { e.stopPropagation(); if (open) setApplyTarget({ university: u, course: c }); }}
                          disabled={!open}
                          aria-label={open ? "Apply Now" : "Intake closed"}
                          title={open ? "Apply Now" : "Intake closed"}
                          className="ml-auto flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[image:var(--sd-gradient)] text-white disabled:bg-none disabled:bg-slate-200 disabled:text-slate-400"
                        >
                          <Send size={13} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}

              {programs.length === 0 && (
                <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-[0_0_10px_rgba(0,0,0,0.11)] lg:col-span-full">
                  {programShortlistedOnly ? (
                    <>
                      <p className="text-sm font-medium text-slate-700">No shortlisted programs yet</p>
                      <p className="mt-1 text-xs text-slate-400">Tap the bookmark on any program to save it here.</p>
                      <button onClick={() => setProgramShortlistedOnly(false)} className="mt-2 text-[12.5px] font-medium text-[var(--sd-ink)]">
                        Browse all programs
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-slate-700">No programs match these filters</p>
                      <button onClick={resetProgramFilters} className="mt-2 text-[12.5px] font-medium text-[var(--sd-ink)]">
                        Reset filters
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
            <Pagination page={programsPage.page} totalPages={programsPage.totalPages} onChange={programsPage.setPage} />
          </div>
        ) : (
          <>
            <div className="mt-4">
              <p className="text-[13px] text-slate-500">{results.length} {results.length === 1 ? "university" : "universities"} found</p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3 lg:grid-cols-2 xl:grid-cols-3">
              {results.length === 0 && (
                <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-[0_0_10px_rgba(0,0,0,0.11)] lg:col-span-full">
                  <p className="text-sm font-medium text-slate-700">No universities match your filters</p>
                  <p className="mt-1 text-xs text-slate-400">Try clearing a filter or searching a different term.</p>
                </div>
              )}
              {resultsPage.pageItems.map((u) => {
                const fav = favorites.has(u.id);
                const initials = universityInitials(u.name);
                return (
                  <button
                    key={u.id}
                    onClick={() => navigate(`/student/universities/${u.id}`)}
                    className="relative flex w-full items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-3.5 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)] sm:gap-4 sm:rounded-3xl sm:p-5"
                  >
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(u.id); }}
                      className="absolute right-3 top-3 shrink-0 text-slate-300 sm:right-4 sm:top-4"
                    >
                      <Heart size={18} className={fav ? "fill-rose-500 text-rose-500" : ""} />
                    </span>

                    {u.logoUrl ? (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-slate-100 bg-white sm:h-24 sm:w-24 sm:rounded-2xl">
                        <img src={u.logoUrl} alt={`${u.name} logo`} className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[#F1EEFB] text-lg font-semibold text-slate-500 sm:h-24 sm:w-24 sm:rounded-2xl sm:text-3xl">
                        {initials}
                      </div>
                    )}

                    <div className="min-w-0 flex-1 pr-6 sm:pr-7">
                      <p className="truncate text-[13.5px] font-semibold leading-snug text-slate-900 sm:text-xl">{u.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-slate-400 sm:mt-1.5 sm:gap-1.5 sm:text-sm">
                        <MapPin size={12} className="shrink-0" /> <span className="truncate">{u.city}, {u.country}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[9.5px] text-slate-400 sm:mt-1.5 sm:text-[10.5px]">
                        <span className="truncate">{u.tags[0]}</span>
                        {u.tags[1] && (
                          <>
                            <span className="shrink-0">·</span>
                            <span className="truncate">{u.tags[1]}</span>
                          </>
                        )}
                      </div>
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-2.5 text-[11px] text-slate-500 sm:mt-4 sm:gap-3 sm:pt-3 sm:text-sm">
                        <span className="inline-flex items-center gap-1 sm:gap-1.5">
                          <CalendarClock size={13} className="shrink-0 text-slate-400" /> <span className="truncate">Open: {u.openIntake}</span>
                        </span>
                        {u.scholarshipsAvailable && (
                          <>
                            <span className="h-3.5 w-px shrink-0 bg-slate-200 sm:h-4" />
                            <span className="inline-flex shrink-0 items-center gap-1 sm:gap-1.5">
                              <GraduationCap size={13} className="text-slate-400" /> Scholarships
                            </span>
                          </>
                        )}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
            <Pagination page={resultsPage.page} totalPages={resultsPage.totalPages} onChange={resultsPage.setPage} />
          </>
        )}
      </div>

      {applyTarget && (
        <ApplyModal university={applyTarget.university} course={applyTarget.course} onClose={() => setApplyTarget(null)} />
      )}
    </div>
  );
}
