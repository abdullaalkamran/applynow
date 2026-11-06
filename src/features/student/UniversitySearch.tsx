import { NeuTabs } from "../../components/ui/NeuTabs";
import { useMemo, useState, type Dispatch, type SetStateAction, type ReactNode } from "react";
import { usePreservedState } from "../../utils/syncCache";
import { useNavigate, useLocation, Outlet } from "react-router-dom";
import {
  Search, SlidersHorizontal, Heart, MapPin, X, CalendarClock,
  GraduationCap, ChevronDown, Bookmark, AlertCircle,
} from "lucide-react";
import { BackButton, Chip, DropdownChips, SubLabel, Pagination, SkylineArt } from "../../components/ui/mobile";
import { getCountryByName } from "../../data/countryRegistry";
import { CountryBadge } from "../../components/ui/CountryBadge";
import { useCatalogPage, useCatalogFacets } from "../../data/useCatalogSearch";
import { asUniversity, asCourse, type CardUniversity, type ProgramRow, type SortBy } from "../../data/catalogSearchApi";
import { apiGet } from "../../utils/apiClient";
import { reportSaveError } from "../../utils/toast";
import { allShortlistedKeys } from "../../data/shortlistStore";
import { CURRENT_STUDENT_ID } from "../../data/mockData";
import { getAllStudents } from "../../data/allStudentsStore";
import { COUNTRIES, countryByName } from "../../data/countries";
import { getProfileCompletion } from "../../data/profileCompletion";
import {
  emptyFilters, countActiveFilters,
  countryStats, yearOptions, type UniversityFilterState,
} from "../../utils/universityFilter";
import { ApplyModal } from "./ApplyModal";
import { ProgramCard, universityInitials } from "./ProgramCard";
import { isShortlisted, toggleShortlisted } from "../../data/shortlistStore";
import type { Student, University } from "../../types";
import { CreateApplicationModal } from "../agent/CreateApplicationModal";
import { NeuSelect } from "../../components/ui/NeuSelect";
import { sameCurrency } from "../../utils/courseFee";

export type Tab = "universities" | "subjects" | "countries";

const SORT_OPTIONS: { value: SortBy; label: string }[] = [
  { value: "best", label: "Best Match" },
  { value: "rank", label: "World Ranking" },
  { value: "feeLow", label: "Fees: Low to High" },
  { value: "feeHigh", label: "Fees: High to Low" },
  { value: "employability", label: "Employability" },
  { value: "name", label: "Name (A–Z)" },
];

export interface FiltersOutletContext {
  filters: UniversityFilterState;
  setFilters: Dispatch<SetStateAction<UniversityFilterState>>;
  resultCount: number;
  // Where the Explore page lives, so Advanced Search can return to the right role's page.
  basePath?: string;
}

/** What differs between the student's Explore page and the counsellor's / agent's partner-university page. The page itself —
 * tabs, search, Advanced Search, sorting, cards — is the same component for everyone. */
export interface ExploreVariant {
  /** Route of the page; Advanced Search lives at `${basePath}/filters`. */
  basePath: string;
  title: string;
  universityPath: (id: string) => string;
  countryPath: (name: string) => string;
  /** Student only: personal shortlist, apply-for-myself and the "complete your profile first" gate. */
  ownApplications: boolean;
  /** Staff: people they can start an application for. Omit for a browse-only page. */
  students?: () => Student[];
  /** Agent: render a per-student shortlist picker on each program card. */
  shortlistSlot?: (university: University, course: University["courses"][number], students: Student[]) => ReactNode;
  /** Extra line on a university card (e.g. "2 of your students applying here"). */
  universityNote?: (university: University) => ReactNode;
  /** Logged-out visitors (/universities, /courses): same page and data, every signed-in action goes to the sign-in page, and the
   * Universities/Courses tabs are separate URLs (`defaultTab` is the one this route shows). */
  publicMode?: boolean;
  /** Where a course lives, when it has its own address (public pages): opening a program card goes there. */
  coursePath?: (universityId: string, courseId: string) => string;
  tabs?: Tab[];
  defaultTab?: Tab;
}

const EXPLORE_FACETS = ["level"];

export const STUDENT_EXPLORE: ExploreVariant = {
  basePath: "/student/search",
  title: "Explore Universities",
  universityPath: (id) => `/student/universities/${id}`,
  countryPath: (name) => `/student/countries/${encodeURIComponent(name)}`,
  ownApplications: true,
};

// Same name→tone hash the destination cards on Home use, so a country without a photo always gets the same illustration.
const SKYLINE_TONES = ["violet", "amber", "teal", "rose"] as const;
function skylineToneFor(name: string): (typeof SKYLINE_TONES)[number] {
  const seed = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return SKYLINE_TONES[seed % SKYLINE_TONES.length];
}

export default function UniversitySearch() {
  return <ExploreUniversities variant={STUDENT_EXPLORE} />;
}

export function ExploreUniversities({ variant }: { variant: ExploreVariant }) {
  const navigate = useNavigate();
  const location = useLocation();
  const student = variant.ownApplications ? getAllStudents().find((s) => s.id === CURRENT_STUDENT_ID) : undefined;
  const defaultResidenceCountry = countryByName(student?.country ?? "")?.iso2 ?? "";
  const staffStudents = variant.students?.() ?? [];
  const [staffApplyTarget, setStaffApplyTarget] = useState<{ university: University; course: University["courses"][number] } | null>(null);
  // State that would otherwise reset whenever cached data refreshes and rebuilds this page (see syncCache.ts usePreservedState).
  const [query, setQuery] = usePreservedState("explore:query", "");
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
  const [levelDropdownOpen, setLevelDropdownOpen] = useState(false);
  // On mobile the full filter grid (Intake/Year/Nationality/State) takes up too much vertical
  // space above the results — collapsed by default there, tap to expand; always shown on lg:+
  // where there's room for the whole row at once (see the "contents" wrapper below).
  const [filtersExpanded, setFiltersExpanded] = usePreservedState("explore:filtersExpanded", false);
  const [sortBy, setSortBy] = usePreservedState<SortBy>("explore:sortBy", "best");
  // Fees are only ever compared within one currency (never converted), so fee sorting needs to know which one: "" = the most
  // common currency among the current results (or the destination's own when a country is picked).
  const [sortCurrency, setSortCurrency] = usePreservedState("explore:sortCurrency", "");
  const [filters, setFilters] = usePreservedState<UniversityFilterState>("explore:filters", () => emptyFilters(defaultResidenceCountry));
  // `/student/search?shortlisted=1` (the Dashboard's "Saved Programs" tile) lands straight on the
  // Courses tab with only the student's bookmarked programs showing.
  const openOnShortlist = new URLSearchParams(location.search).get("shortlisted") === "1";
  const [tabState, setTabState] = usePreservedState<Tab>("explore:tab", "subjects");
  // Public pages keep the tab in the URL (/universities, /courses); the signed-in page keeps it in state, as before.
  const tab: Tab = variant.publicMode ? variant.defaultTab ?? "universities" : tabState;
  const setTab = (t: Tab) => (variant.publicMode ? navigate(t === "subjects" ? "/courses" : "/universities") : setTabState(t));

  // The flat "all programs" list on the Courses tab also honours the one shared search bar/filter
  // panel above (see advancedFilteredUniversityIds below) — this is only its own quick toggle for
  // narrowing that list down to what's already bookmarked.
  const [programShortlistedOnly, setProgramShortlistedOnly] = usePreservedState("explore:shortlistedOnly", openOnShortlist);

  const showingFilters = location.pathname === `${variant.basePath}/filters`;

  // Searching, filtering, sorting and paging all happen on the server (see data/catalogSearchApi.ts): the browser only ever
  // holds the page it is showing, instead of the whole catalog. The server applies exactly the filters this page always had.
  // Only the Level list is needed here (plus the catalog-wide intakes and fee currency every facets answer carries).
  const facets = useCatalogFacets(filters, true, EXPLORE_FACETS);
  const shortlistKeys = programShortlistedOnly ? allShortlistedKeys() : undefined;
  // Re-reads the browser-held bookmarks after each toggle so un-bookmarking drops the program from a "Shortlisted" list at once.
  void shortlistTick;
  const programsPage = useCatalogPage<ProgramRow>({
    enabled: tab === "subjects", view: "courses", query, filters, sort: sortBy, sortCurrency, shortlistKeys, pageSize: 30, persistKey: "explore:programsPage",
  });
  const resultsPage = useCatalogPage<CardUniversity>({
    enabled: tab === "universities" || (tab === "countries" && showingFilters), view: "universities", query, filters, sort: sortBy, sortCurrency, pageSize: 30, persistKey: "explore:resultsPage",
  });

  // Countries tab only meaningfully honours the shared bar's free-text search (matching by country
  // name) — the other advanced fields don't map onto a plain destination list, and countryStats()
  // deliberately keeps zero-university countries visible (real Country Guide content can exist
  // before any partner university does), which a full applyFilters() pass would hide.
  const countryStatsFiltered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? countryStats().filter((c) => c.name.toLowerCase().includes(q)) : countryStats();
  }, [query]);

  // Currencies among the courses currently listed — the choices when sorting by fee.
  const sortCurrencies = programsPage.currencies;
  const programFiltersActive = programShortlistedOnly;

  // The application form needs the university's campuses, intake status and so on, which a list row doesn't carry: fetch the
  // one full record when Apply is pressed.
  async function openApply(row: ProgramRow) {
    try {
      const full = await apiGet<University>(`/api/universities/${encodeURIComponent(row.university.id)}`);
      const course = full.courses.find((c) => c.id === row.course.id);
      if (course) setApplyTarget({ university: full, course });
    } catch (err) {
      reportSaveError("Couldn't open the application form:", err);
    }
  }

  // Explore/apply is gated on having filled in the required parts of the profile — a counsellor or
  // admission officer needs that information to actually process an application, so letting someone
  // browse into applying without it just produces applications no one can act on. Only checked once
  // the student record has actually loaded (see the `!student` trade-off noted above).
  const profileCompletion = variant.ownApplications && student ? getProfileCompletion(student.id) : null;
  if (profileCompletion && profileCompletion.requiredRemaining > 0) {
    const nextStep = profileCompletion.pendingSteps.find((s) => s.required) ?? profileCompletion.pendingSteps[0];
    return (
      <div className="flex min-h-full flex-col items-center justify-center px-8 py-16 text-center">
        <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm text-neutral-900">
          <AlertCircle size={26} />
        </div>
        <h1 className="mt-4 text-[17px] font-bold text-neutral-900">Complete your profile first</h1>
        <p className="mt-2 max-w-xs text-[13px] leading-relaxed text-neutral-500">
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
    return <Outlet context={{ filters, setFilters, resultCount: tab === "subjects" ? programsPage.total : resultsPage.total, basePath: variant.basePath } satisfies FiltersOutletContext} />;
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

  // Same Level selection as Advanced Search's — one shared filter, so picking it here narrows every tab.
  function toggleFilterLevel(level: string) {
    setFilters((f) => {
      const next = new Set(f.level);
      if (next.has(level)) next.delete(level); else next.add(level);
      return { ...f, level: next };
    });
  }

  function openProgram(universityId: string, courseId: string, courseName: string, subject: string) {
    if (variant.coursePath) return navigate(variant.coursePath(universityId, courseId));
    navigate(variant.universityPath(universityId), { state: { selectedCourseName: courseName, subject } });
  }

  return (
    <div className="px-5 pb-6 pt-6 lg:px-10 lg:pb-10 lg:pt-8">
      <div className="lg:mx-auto lg:max-w-6xl">
        <div className="flex items-center gap-3">
          <div className="lg:hidden">
            <BackButton />
          </div>
          <h1 className="text-xl font-bold text-neutral-900 lg:text-2xl">{variant.title}</h1>
        </div>

        <div className="mt-2">
          <NeuTabs
            ariaLabel="Explore"
            tabs={variant.tabs ?? (["universities", "subjects", "countries"] as Tab[])}
            labels={{ universities: "Universities", subjects: "Courses", countries: "Countries" }}
            value={tab}
            onChange={setTab}
          />
        </div>

        <div className="mt-4 rounded-2xl bg-[var(--sd-card)] p-3.5 shadow-neu">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-6 lg:items-end">
            <div className="lg:col-span-1">
              <SubLabel>Search Programs</SubLabel>
              <div className="flex items-center gap-2">
                <div className="flex min-w-0 flex-1 items-center gap-2 h-9 rounded-xl border border-transparent px-3">
                  <Search size={15} className="shrink-0 text-neutral-400" />
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search Program / University"
                    className="w-full min-w-0 bg-transparent py-0 text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
                  />
                </div>
                <button
                  onClick={() => setFiltersExpanded((v) => !v)}
                  aria-label={filtersExpanded ? "Hide filters" : "Show more filters"}
                  aria-expanded={filtersExpanded}
                  className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl sm:hidden ${
                    filtersExpanded || activeFilterCount > 0 ? "bg-[image:var(--sd-gradient)] text-white" : "bg-neutral-100 text-neutral-500"
                  }`}
                >
                  <ChevronDown size={16} className={`transition-transform ${filtersExpanded ? "rotate-180" : ""}`} />
                </button>
              </div>
            </div>
            <div className={filtersExpanded ? "contents" : "hidden sm:contents"}>
              <div>
                <DropdownChips
                  label="Level"
                  floating
                  options={[...new Set([...filters.level, ...(facets?.facets.level ?? [])])]}
                  selected={filters.level}
                  onToggle={toggleFilterLevel}
                  open={levelDropdownOpen}
                  onToggleOpen={() => { setLevelDropdownOpen((v) => !v); setIntakeDropdownOpen(false); }}
                  placeholder="All levels"
                />
              </div>
              <div>
                <DropdownChips
                  label="Intake"
                  floating
                  options={[...new Set([...filters.intakes, ...(facets?.intakesAll ?? [])])]}
                  selected={filters.intakes}
                  onToggle={toggleFilterIntake}
                  open={intakeDropdownOpen}
                  onToggleOpen={() => { setIntakeDropdownOpen((v) => !v); setLevelDropdownOpen(false); }}
                  placeholder="All intakes"
                />
              </div>
              <div>
                <SubLabel>Year</SubLabel>
                <NeuSelect
                  value={filters.year}
                  onChange={(e) => setFilters((f) => ({ ...f, year: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-[13px] text-neutral-700"
                >
                  <option value="">Any year</option>
                  {(facets?.years ?? yearOptions()).map((y) => <option key={y} value={y}>{y}</option>)}
                </NeuSelect>
              </div>
              <div>
                <SubLabel>Student's Nationality</SubLabel>
                <NeuSelect
                  value={filters.residenceCountry}
                  onChange={(e) => setFilters((f) => ({ ...f, residenceCountry: e.target.value }))}
                  className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-[13px] text-neutral-700"
                >
                  <option value="">Any nationality</option>
                  {COUNTRIES.map((c) => <option key={c.iso2} value={c.iso2}>{c.name}</option>)}
                </NeuSelect>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <SubLabel>Student's State</SubLabel>
                  <input
                    value={filters.studentState}
                    onChange={(e) => setFilters((f) => ({ ...f, studentState: e.target.value }))}
                    placeholder="Student's State"
                    className="w-full rounded-xl border border-neutral-200 px-3 py-2.5 text-[13px] text-neutral-700 placeholder:text-neutral-400 focus:outline-none"
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
            <div className="flex items-center gap-3">
            <button
              onClick={() => navigate(`${variant.basePath}/filters`)}
              className="flex items-center gap-1 text-[13px] font-medium text-neutral-900"
            >
              Advanced Search {activeFilterCount > 0 && `(${activeFilterCount})`}
            </button>
            <button
              onClick={() => setFilters((f) => ({ ...f, openProgramsOnly: !f.openProgramsOnly }))}
              aria-pressed={filters.openProgramsOnly}
              className={`rounded-lg px-2.5 py-1.5 text-[11.5px] font-medium ${filters.openProgramsOnly ? "neu-btn-green" : "bg-neutral-100 text-neutral-500"}`}
            >
              Open intake
            </button>
            </div>
            <div className="flex items-center gap-2">
              {activeFilterCount > 0 && (
                <button onClick={() => setFilters(emptyFilters(defaultResidenceCountry))} className="flex items-center gap-0.5 text-[12px] font-medium text-neutral-900">
                  <X size={11} /> Clear All
                </button>
              )}
              {tab !== "countries" && (
                <button
                  onClick={() => setSortOpen((v) => !v)}
                  className={`flex h-[30px] shrink-0 items-center justify-center gap-1.5 rounded-lg px-2.5 text-[11.5px] font-medium ${
                    sortOpen || sortBy !== "best" ? "bg-[image:var(--sd-gradient)] text-white" : "bg-neutral-100 text-neutral-500"
                  }`}
                  aria-label="Sort"
                  aria-expanded={sortOpen}
                >
                  <SlidersHorizontal size={14} className="rotate-90" />
                  {sortBy === "best" ? "Sort" : SORT_OPTIONS.find((o) => o.value === sortBy)?.label}
                </button>
              )}
            </div>
          </div>
        </div>

        {tab !== "countries" && sortOpen && (
          <div className="mt-2 rounded-2xl bg-[var(--sd-card)] p-3 shadow-neu lg:w-fit">
            <div className="flex flex-wrap gap-2">
              {SORT_OPTIONS.map((s) => (
                <Chip key={s.value} label={s.label} selected={sortBy === s.value} onClick={() => { setSortBy(s.value); if (s.value !== "feeLow" && s.value !== "feeHigh") setSortOpen(false); }} />
              ))}
            </div>
            {(sortBy === "feeLow" || sortBy === "feeHigh") && (
              <div className="mt-3 border-t border-neutral-300/50 pt-2.5">
                {sortCurrencies.length > 1 && (
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-[11px] text-neutral-500">Currency:</span>
                    {sortCurrencies.map((c) => (
                      <Chip
                        key={c}
                        label={c}
                        selected={sameCurrency(sortCurrency || filters.feeCurrency || facets?.feeCurrency || sortCurrencies[0], c)}
                        onClick={() => setSortCurrency(c)}
                      />
                    ))}
                  </div>
                )}
                <p className="mt-1.5 text-[10.5px] leading-snug text-neutral-500">
                  Fees are only compared within one currency. Courses priced in another currency, or with no fee listed, come last.
                </p>
              </div>
            )}
          </div>
        )}

        {tab === "countries" ? (
          <div className="mt-4">
            <p className="text-[13px] text-neutral-500">{countryStatsFiltered.length} destination{countryStatsFiltered.length === 1 ? "" : "s"} to explore.</p>
            <div className="mt-3 grid grid-cols-2 gap-3 lg:grid-cols-3 lg:gap-4">
              {countryStatsFiltered.map((c) => {
                const photo = getCountryByName(c.name)?.photoUrl;
                return (
                  <button
                    key={c.name}
                    onClick={() => navigate(variant.countryPath(c.name))}
                    aria-label={c.name}
                    className="relative aspect-[4/3] w-full overflow-hidden rounded-2xl text-left shadow-neu"
                  >
                    {photo ? (
                      <img src={photo} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover" />
                    ) : (
                      <SkylineArt tone={skylineToneFor(c.name)} className="absolute inset-0 h-full w-full" />
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                    <CountryBadge name={c.name} className="absolute right-2 top-2 h-7 w-7 text-[15px]" />
                    <div className="absolute inset-x-0 bottom-0 p-3">
                      <p className="truncate text-[14px] font-semibold text-white">{c.name}</p>
                      <p className="text-[11.5px] text-white/85">
                        {c.universityCount} universit{c.universityCount === 1 ? "y" : "ies"} · {c.courseCount} course{c.courseCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </button>
                );
              })}
              {countryStatsFiltered.length === 0 && (
                <div className="col-span-full rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu">
                  <p className="text-sm font-medium text-neutral-700">No destinations yet</p>
                </div>
              )}
            </div>
          </div>
        ) : tab === "subjects" ? (
          <div className="mt-4">
            <div className="flex items-center justify-between">
              <p className="text-[13px] text-neutral-500">
                {programsPage.initialLoading
                  ? "Loading programs…"
                  : programShortlistedOnly
                    ? `${programsPage.total} shortlisted ${programsPage.total === 1 ? "program" : "programs"}.`
                    : `${programsPage.total.toLocaleString()} ${programsPage.total === 1 ? "program" : "programs"} from top universities worldwide.`}
              </p>
              {programFiltersActive && (
                <button onClick={resetProgramFilters} className="flex items-center gap-0.5 text-[12px] font-medium text-neutral-900">
                  <X size={11} /> Clear
                </button>
              )}
            </div>

            {variant.ownApplications && (
              <div className="mt-3 flex items-center gap-2">
                <Chip
                  label="Shortlisted"
                  selected={programShortlistedOnly}
                  onClick={() => setProgramShortlistedOnly((v) => !v)}
                  icon={<Bookmark size={12} className={programShortlistedOnly ? "fill-white" : ""} />}
                />
              </div>
            )}

            {/* Same card shape as the Universities tab below (big logo tile, title, location line,
                divider, detail row) so both tabs read as one consistent catalog. */}
            <div className="mt-3 grid grid-cols-1 gap-3">
              {programsPage.items.map((row) => {
                const u = asUniversity(row.university);
                const c = asCourse(row.course);
                const programKey = `${u.id}::${c.name}`;
                return (
                  <ProgramCard
                    key={programKey}
                    university={u}
                    course={c}
                    shortlisted={variant.ownApplications ? isShortlisted(programKey) : false}
                    onToggleShortlist={variant.ownApplications ? () => toggleProgramShortlist(programKey) : undefined}
                    onOpen={() => openProgram(u.id, c.id, c.name, c.subject)}
                    onApply={
                      variant.ownApplications
                        ? () => { void openApply(row); }
                        : variant.students
                          ? () => setStaffApplyTarget({ university: u, course: c })
                          : variant.publicMode
                            ? () => navigate("/login")
                            : undefined
                    }
                    actionSlot={variant.shortlistSlot?.(u, c, staffStudents)}
                  />
                );
              })}

              {programsPage.error && programsPage.items.length === 0 && (
                <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu lg:col-span-full">
                  <p className="text-sm font-medium text-neutral-700">Couldn't load programs right now</p>
                  <p className="mt-1 text-xs text-neutral-400">Please check your connection and try again.</p>
                  <button onClick={programsPage.reload} className="mt-2 text-[12.5px] font-medium text-[var(--sd-ink)]">Try again</button>
                </div>
              )}
              {!programsPage.initialLoading && !programsPage.error && programsPage.total === 0 && (
                <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu lg:col-span-full">
                  {programShortlistedOnly ? (
                    <>
                      <p className="text-sm font-medium text-neutral-700">No shortlisted programs yet</p>
                      <p className="mt-1 text-xs text-neutral-400">Tap the bookmark on any program to save it here.</p>
                      <button onClick={() => setProgramShortlistedOnly(false)} className="mt-2 text-[12.5px] font-medium text-[var(--sd-ink)]">
                        Browse all programs
                      </button>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-neutral-700">No programs match these filters</p>
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
              <p className="text-[13px] text-neutral-500">{resultsPage.initialLoading ? "Loading universities…" : `${resultsPage.total} ${resultsPage.total === 1 ? "university" : "universities"} found`}</p>
            </div>

            <div className="mt-3 grid grid-cols-1 gap-3">
              {resultsPage.error && resultsPage.items.length === 0 && (
                <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu lg:col-span-full">
                  <p className="text-sm font-medium text-neutral-700">Couldn't load universities right now</p>
                  <p className="mt-1 text-xs text-neutral-400">Please check your connection and try again.</p>
                  <button onClick={resultsPage.reload} className="mt-2 text-[12.5px] font-medium text-[var(--sd-ink)]">Try again</button>
                </div>
              )}
              {!resultsPage.initialLoading && !resultsPage.error && resultsPage.total === 0 && (
                <div className="rounded-2xl bg-[var(--sd-card)] p-6 text-center shadow-neu lg:col-span-full">
                  <p className="text-sm font-medium text-neutral-700">No universities match your filters</p>
                  <p className="mt-1 text-xs text-neutral-400">Try clearing a filter or searching a different term.</p>
                </div>
              )}
              {resultsPage.items.map((u) => {
                const fav = favorites.has(u.id);
                const initials = universityInitials(u.name);
                return (
                  <button
                    key={u.id}
                    onClick={() => navigate(variant.universityPath(u.id))}
                    className="relative flex w-full items-center gap-3 rounded-2xl bg-[var(--sd-card)] p-3.5 text-left shadow-neu sm:gap-4 sm:rounded-3xl sm:p-5"
                  >
                    <span
                      onClick={(e) => { e.stopPropagation(); toggleFavorite(u.id); }}
                      className="absolute right-3 top-3 shrink-0 text-neutral-300 sm:right-4 sm:top-4"
                    >
                      <Heart size={18} className={fav ? "fill-rose-500 text-neutral-900" : ""} />
                    </span>

                    {u.logoUrl ? (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-transparent bg-white sm:h-24 sm:w-24 sm:rounded-2xl">
                        <img src={u.logoUrl} alt={`${u.name} logo`} className="h-full w-full object-contain" />
                      </div>
                    ) : (
                      <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--sd-card)] shadow-neu-inset-sm text-lg font-semibold text-neutral-500 sm:h-24 sm:w-24 sm:rounded-2xl sm:text-3xl">
                        {initials}
                      </div>
                    )}

                    <div className="min-w-0 flex-1 pr-6 sm:pr-7">
                      <p className="truncate text-[13.5px] font-semibold leading-snug text-neutral-900 sm:text-xl">{u.name}</p>
                      <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-400 sm:mt-1.5 sm:gap-1.5 sm:text-sm">
                        <MapPin size={12} className="shrink-0" /> <span className="truncate">{u.city}, {u.country}</span>
                      </p>
                      <div className="mt-1 flex flex-wrap items-center gap-1 text-[9.5px] text-neutral-400 sm:mt-1.5 sm:text-[10.5px]">
                        <span className="truncate">{u.tags[0]}</span>
                        {u.tags[1] && (
                          <>
                            <span className="shrink-0">·</span>
                            <span className="truncate">{u.tags[1]}</span>
                          </>
                        )}
                      </div>
                      {variant.universityNote?.(asUniversity(u))}
                      <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-transparent pt-2.5 text-[11px] text-neutral-500 sm:mt-4 sm:gap-3 sm:pt-3 sm:text-sm">
                        <span className="inline-flex items-center gap-1 sm:gap-1.5">
                          <CalendarClock size={13} className="shrink-0 text-neutral-400" /> <span className="truncate">Open: {u.openIntake}</span>
                        </span>
                        {u.scholarshipsAvailable && (
                          <>
                            <span className="h-3.5 w-px shrink-0 bg-neutral-200 sm:h-4" />
                            <span className="inline-flex shrink-0 items-center gap-1 sm:gap-1.5">
                              <GraduationCap size={13} className="text-neutral-400" /> Scholarships
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
      {staffApplyTarget && (
        <CreateApplicationModal
          students={staffStudents}
          initialUniversityId={staffApplyTarget.university.id}
          initialCourseName={staffApplyTarget.course.name}
          onClose={() => setStaffApplyTarget(null)}
          onCreated={() => setStaffApplyTarget(null)}
        />
      )}
    </div>
  );
}
