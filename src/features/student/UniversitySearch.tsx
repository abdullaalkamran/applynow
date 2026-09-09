import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, ChevronDown, SlidersHorizontal, Heart, MapPin, X } from "lucide-react";
import { BackButton, SkylineArt, Pill, Chip, Toggle } from "../../components/ui/mobile";
import { UNIVERSITIES } from "../../data/mockData";
import { FIELDS_OF_STUDY } from "../../data/fields";

const MONTH_ORDER = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const COUNTRY_OPTIONS = Array.from(new Set(UNIVERSITIES.map((u) => u.country)));
const CAMPUS_OPTIONS = Array.from(new Set(UNIVERSITIES.map((u) => u.city))).sort();
const UNIVERSITY_OPTIONS = UNIVERSITIES.map((u) => u.name);
const COURSE_OPTIONS = Array.from(new Set(UNIVERSITIES.flatMap((u) => u.courses.map((c) => c.name)))).sort();
const LEVEL_OPTIONS = Array.from(new Set(UNIVERSITIES.flatMap((u) => u.courses.map((c) => c.level))));
const SUBJECT_OPTIONS = FIELDS_OF_STUDY;
const INTAKE_OPTIONS = Array.from(new Set(UNIVERSITIES.flatMap((u) => u.intakes))).sort(
  (a, b) => MONTH_ORDER.indexOf(a) - MONTH_ORDER.indexOf(b)
);
const FEE_RANGES = ["Under $20k", "$20k – $40k", "$40k – $60k", "$60k+"];
const IELTS_OPTIONS = [5.5, 6.0, 6.5, 7.0, 7.5, 8.0];

// Approximate FX rates to USD, used only to make the fee-range filter comparable across currencies.
const FX_TO_USD: Record<string, number> = { "£": 1.27, "$": 1.0, "C$": 0.74, "A$": 0.66, "€": 1.09, "AED ": 0.27 };

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
function tuitionInUSD(u: (typeof UNIVERSITIES)[number]) {
  const tuition = u.fees.find((f) => f.label === "Tuition Fee")?.amount ?? 0;
  return tuition * (FX_TO_USD[u.currencySymbol] ?? 1);
}
function matchesFeeRange(u: (typeof UNIVERSITIES)[number], range: string) {
  const usd = tuitionInUSD(u);
  if (range === "Under $20k") return usd < 20000;
  if (range === "$20k – $40k") return usd >= 20000 && usd < 40000;
  if (range === "$40k – $60k") return usd >= 40000 && usd < 60000;
  return usd >= 60000;
}

function toggleInSet(set: Set<string>, setter: (s: Set<string>) => void, value: string) {
  const next = new Set(set);
  if (next.has(value)) next.delete(value);
  else next.add(value);
  setter(next);
}

type PanelKey =
  | "country" | "campus" | "university" | "course" | "level" | "subject" | "intake" | "fees" | "ielts" | "more" | "sort"
  | null;

export default function UniversitySearch() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [favorites, setFavorites] = useState<Set<string>>(new Set());
  const [openPanel, setOpenPanel] = useState<PanelKey>(null);

  const [selectedCountries, setSelectedCountries] = useState<Set<string>>(new Set());
  const [selectedCampuses, setSelectedCampuses] = useState<Set<string>>(new Set());
  const [selectedUniversities, setSelectedUniversities] = useState<Set<string>>(new Set());
  const [selectedCourses, setSelectedCourses] = useState<Set<string>>(new Set());
  const [selectedLevels, setSelectedLevels] = useState<Set<string>>(new Set());
  const [selectedSubjects, setSelectedSubjects] = useState<Set<string>>(new Set());
  const [selectedIntakes, setSelectedIntakes] = useState<Set<string>>(new Set());
  const [feeRange, setFeeRange] = useState<string | null>(null);
  const [minIeltsFilter, setMinIeltsFilter] = useState<number | null>(null);
  const [topRankedOnly, setTopRankedOnly] = useState(false);
  const [highEmployabilityOnly, setHighEmployabilityOnly] = useState(false);
  const [sortBy, setSortBy] = useState<SortBy>("best");

  const filtersActive =
    selectedCountries.size > 0 || selectedCampuses.size > 0 || selectedUniversities.size > 0 ||
    selectedCourses.size > 0 || selectedLevels.size > 0 || selectedSubjects.size > 0 || selectedIntakes.size > 0 ||
    feeRange !== null || minIeltsFilter !== null || topRankedOnly || highEmployabilityOnly;

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = UNIVERSITIES.filter((u) => {
      if (q) {
        const matches =
          u.name.toLowerCase().includes(q) ||
          u.city.toLowerCase().includes(q) ||
          u.country.toLowerCase().includes(q) ||
          u.courses.some((c) => c.name.toLowerCase().includes(q));
        if (!matches) return false;
      }
      if (selectedCountries.size > 0 && !selectedCountries.has(u.country)) return false;
      if (selectedCampuses.size > 0 && !selectedCampuses.has(u.city)) return false;
      if (selectedUniversities.size > 0 && !selectedUniversities.has(u.name)) return false;
      if (selectedCourses.size > 0 && !u.courses.some((c) => selectedCourses.has(c.name))) return false;
      if (selectedLevels.size > 0 && !u.courses.some((c) => selectedLevels.has(c.level))) return false;
      if (selectedSubjects.size > 0 && !u.subjects.some((s) => selectedSubjects.has(s))) return false;
      if (selectedIntakes.size > 0 && !u.intakes.some((i) => selectedIntakes.has(i))) return false;
      if (feeRange && !matchesFeeRange(u, feeRange)) return false;
      if (minIeltsFilter !== null && u.minIELTS > minIeltsFilter) return false;
      if (topRankedOnly && rankNumber(u.worldRank) > 50) return false;
      if (highEmployabilityOnly && employabilityNumber(u.employability) < 90) return false;
      return true;
    });

    const sorted = [...filtered];
    if (sortBy === "rank") sorted.sort((a, b) => rankNumber(a.worldRank) - rankNumber(b.worldRank));
    else if (sortBy === "employability") sorted.sort((a, b) => employabilityNumber(b.employability) - employabilityNumber(a.employability));
    else if (sortBy === "name") sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [
    query, selectedCountries, selectedCampuses, selectedUniversities, selectedCourses, selectedLevels,
    selectedSubjects, selectedIntakes, feeRange, minIeltsFilter, topRankedOnly, highEmployabilityOnly, sortBy,
  ]);

  function toggleFavorite(id: string) {
    setFavorites((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function togglePanel(key: PanelKey) {
    setOpenPanel((prev) => (prev === key ? null : key));
  }

  function clearFilters() {
    setSelectedCountries(new Set());
    setSelectedCampuses(new Set());
    setSelectedUniversities(new Set());
    setSelectedCourses(new Set());
    setSelectedLevels(new Set());
    setSelectedSubjects(new Set());
    setSelectedIntakes(new Set());
    setFeeRange(null);
    setMinIeltsFilter(null);
    setTopRankedOnly(false);
    setHighEmployabilityOnly(false);
    setOpenPanel(null);
  }

  return (
    <div className="px-5 pb-6 pt-6">
      <div className="flex items-center gap-3">
        <BackButton />
        <h1 className="text-xl font-bold text-slate-900">Explore Universities</h1>
      </div>

      <div className="mt-4 flex items-center gap-2 rounded-xl bg-white px-3.5 py-3 shadow-sm shadow-black/[0.03]">
        <Search size={17} className="text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search university, course or city"
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="no-scrollbar mt-3 flex items-center gap-2 overflow-x-auto">
        <FilterTrigger label="Country" count={selectedCountries.size} singleValue={selectedCountries.size === 1 ? [...selectedCountries][0] : undefined} active={openPanel === "country"} onClick={() => togglePanel("country")} />
        <FilterTrigger label="Campus" count={selectedCampuses.size} singleValue={selectedCampuses.size === 1 ? [...selectedCampuses][0] : undefined} active={openPanel === "campus"} onClick={() => togglePanel("campus")} />
        <FilterTrigger label="University" count={selectedUniversities.size} active={openPanel === "university"} onClick={() => togglePanel("university")} />
        <FilterTrigger label="Course" count={selectedCourses.size} active={openPanel === "course"} onClick={() => togglePanel("course")} />
        <FilterTrigger label="Level" count={selectedLevels.size} singleValue={selectedLevels.size === 1 ? [...selectedLevels][0] : undefined} active={openPanel === "level"} onClick={() => togglePanel("level")} />
        <FilterTrigger label="Subject" count={selectedSubjects.size} active={openPanel === "subject"} onClick={() => togglePanel("subject")} />
        <FilterTrigger label="Intake" count={selectedIntakes.size} active={openPanel === "intake"} onClick={() => togglePanel("intake")} />
        <FilterTrigger label="Fees" count={feeRange ? 1 : 0} singleValue={feeRange ?? undefined} active={openPanel === "fees"} onClick={() => togglePanel("fees")} />
        <FilterTrigger label="English Score" count={minIeltsFilter !== null ? 1 : 0} singleValue={minIeltsFilter !== null ? `IELTS ${minIeltsFilter}` : undefined} active={openPanel === "ielts"} onClick={() => togglePanel("ielts")} />
        <FilterTrigger label="More" count={(topRankedOnly ? 1 : 0) + (highEmployabilityOnly ? 1 : 0)} active={openPanel === "more"} onClick={() => togglePanel("more")} />
      </div>

      {openPanel === "country" && (
        <FilterPanel>
          {COUNTRY_OPTIONS.map((c) => (
            <Chip key={c} label={c} selected={selectedCountries.has(c)} onClick={() => toggleInSet(selectedCountries, setSelectedCountries, c)} />
          ))}
        </FilterPanel>
      )}
      {openPanel === "campus" && (
        <FilterPanel>
          {CAMPUS_OPTIONS.map((c) => (
            <Chip key={c} label={c} selected={selectedCampuses.has(c)} onClick={() => toggleInSet(selectedCampuses, setSelectedCampuses, c)} />
          ))}
        </FilterPanel>
      )}
      {openPanel === "university" && (
        <FilterPanel>
          {UNIVERSITY_OPTIONS.map((n) => (
            <Chip key={n} label={n} selected={selectedUniversities.has(n)} onClick={() => toggleInSet(selectedUniversities, setSelectedUniversities, n)} />
          ))}
        </FilterPanel>
      )}
      {openPanel === "course" && (
        <FilterPanel>
          {COURSE_OPTIONS.map((c) => (
            <Chip key={c} label={c} selected={selectedCourses.has(c)} onClick={() => toggleInSet(selectedCourses, setSelectedCourses, c)} />
          ))}
        </FilterPanel>
      )}
      {openPanel === "level" && (
        <FilterPanel>
          {LEVEL_OPTIONS.map((l) => (
            <Chip key={l} label={l} selected={selectedLevels.has(l)} onClick={() => toggleInSet(selectedLevels, setSelectedLevels, l)} />
          ))}
        </FilterPanel>
      )}
      {openPanel === "subject" && (
        <FilterPanel>
          {SUBJECT_OPTIONS.map((s) => (
            <Chip key={s} label={s} selected={selectedSubjects.has(s)} onClick={() => toggleInSet(selectedSubjects, setSelectedSubjects, s)} />
          ))}
        </FilterPanel>
      )}
      {openPanel === "intake" && (
        <FilterPanel>
          {INTAKE_OPTIONS.map((i) => (
            <Chip key={i} label={i} selected={selectedIntakes.has(i)} onClick={() => toggleInSet(selectedIntakes, setSelectedIntakes, i)} />
          ))}
        </FilterPanel>
      )}
      {openPanel === "fees" && (
        <FilterPanel caption="Approximate, converted to USD for comparison across countries.">
          {FEE_RANGES.map((r) => (
            <Chip key={r} label={r} selected={feeRange === r} onClick={() => setFeeRange((prev) => (prev === r ? null : r))} />
          ))}
        </FilterPanel>
      )}
      {openPanel === "ielts" && (
        <FilterPanel caption="Shows universities that accept your IELTS score or lower.">
          {IELTS_OPTIONS.map((score) => (
            <Chip
              key={score}
              label={`IELTS ${score.toFixed(1)}`}
              selected={minIeltsFilter === score}
              onClick={() => setMinIeltsFilter((prev) => (prev === score ? null : score))}
            />
          ))}
        </FilterPanel>
      )}
      {openPanel === "more" && (
        <div className="mt-2 space-y-2.5 rounded-2xl bg-white p-3.5 shadow-sm shadow-black/[0.03]">
          <Toggle checked={topRankedOnly} onChange={setTopRankedOnly} label="Top 50 Global only" />
          <Toggle checked={highEmployabilityOnly} onChange={setHighEmployabilityOnly} label="High employability (90%+)" />
        </div>
      )}
      {openPanel === "sort" && (
        <FilterPanel>
          {SORT_OPTIONS.map((s) => (
            <Chip key={s.value} label={s.label} selected={sortBy === s.value} onClick={() => { setSortBy(s.value); setOpenPanel(null); }} />
          ))}
        </FilterPanel>
      )}

      <div className="mt-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <p className="text-[13px] text-slate-500">{results.length} universities found</p>
          {filtersActive && (
            <button onClick={clearFilters} className="flex items-center gap-0.5 text-[12px] font-medium text-rose-500">
              <X size={11} /> Clear
            </button>
          )}
        </div>
        <button
          onClick={() => togglePanel("sort")}
          className={`flex h-8 w-8 items-center justify-center rounded-lg shadow-sm shadow-black/[0.03] ${
            openPanel === "sort" ? "bg-[var(--sd-ink)] text-white" : "bg-white text-slate-500"
          }`}
          aria-label="Sort"
        >
          <SlidersHorizontal size={15} />
        </button>
      </div>

      <div className="mt-3 space-y-3">
        {results.length === 0 && (
          <div className="rounded-2xl bg-white p-6 text-center shadow-sm shadow-black/[0.03]">
            <p className="text-sm font-medium text-slate-700">No universities match your filters</p>
            <p className="mt-1 text-xs text-slate-400">Try clearing a filter or searching a different term.</p>
          </div>
        )}
        {results.map((u) => {
          const fav = favorites.has(u.id);
          return (
            <button
              key={u.id}
              onClick={() => navigate(`/student/universities/${u.id}`)}
              className="flex w-full items-center gap-3 rounded-2xl bg-white p-3 text-left shadow-sm shadow-black/[0.03]"
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
                <div className="mt-1.5 flex flex-wrap gap-1.5">
                  <Pill tone="blue">{u.tags[0]}</Pill>
                  <Pill tone="green">{u.tags[1]}</Pill>
                </div>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function FilterTrigger({
  label, count, singleValue, active, onClick,
}: { label: string; count: number; singleValue?: string; active: boolean; onClick: () => void }) {
  const highlighted = active || count > 0;
  const text = singleValue ?? (count > 1 ? `${label} (${count})` : label);
  return (
    <button
      onClick={onClick}
      className={`flex shrink-0 items-center gap-1 rounded-full px-3.5 py-2 text-[13px] font-medium transition ${
        highlighted ? "bg-[var(--sd-ink)] text-white" : "border border-slate-200 bg-white text-slate-600"
      }`}
    >
      {text} <ChevronDown size={13} className={active ? "rotate-180 transition-transform" : "transition-transform"} />
    </button>
  );
}

function FilterPanel({ children, caption }: { children: React.ReactNode; caption?: string }) {
  return (
    <div className="mt-2 rounded-2xl bg-white p-3 shadow-sm shadow-black/[0.03]">
      <div className="flex flex-wrap gap-2">{children}</div>
      {caption && <p className="mt-2 text-[11px] text-slate-400">{caption}</p>}
    </div>
  );
}
