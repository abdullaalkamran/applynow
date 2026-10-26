import { useMemo, useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Globe2, ListChecks, ShieldCheck } from "lucide-react";
import { MobileHeader, Section, SubLabel, DropdownChips, Toggle, CheckboxList, inputClass } from "../../components/ui/mobile";
import {
  TEST_NAME_OPTIONS, locationOptions, facetOptions,
  STANDARDIZED_TEST_OPTIONS, ACCEPTED_ENGLISH_TEST_CHECKBOXES,
  FEE_MIN, FEE_MAX, FEE_STEP, activeFeeCurrency, feeRangeActive, feeFilterStats,
  emptyFilters, type UniversityFilterState,
} from "../../utils/universityFilter";
import type { FiltersOutletContext } from "./UniversitySearch";
import { feeCurrenciesFor } from "../../utils/courseFee";
import { FeeRangeFilter } from "../../components/ui/FeeRangeFilter";
import { NeuSelect } from "../../components/ui/NeuSelect";

export default function UniversityFilters() {
  const navigate = useNavigate();
  const { filters, setFilters, resultCount, basePath = "/student/search" } = useOutletContext<FiltersOutletContext>();
  // Which multi-select list is expanded (one at a time).
  const [openList, setOpenList] = useState<string | null>(null);
  const toggleOpen = (key: string) => setOpenList((cur) => (cur === key ? null : key));

  // Always update from the previous state, never the `filters` snapshot in this closure — a
  // handler that needs to set two fields at once (e.g. destination + resetting city) would
  // otherwise have its first change silently clobbered by the second.
  function update<K extends keyof UniversityFilterState>(key: K, value: UniversityFilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSetValue<K extends "intakes" | "standardizedTests" | "acceptedEnglishTests" | "level" | "location" | "universities" | "disciplineArea" | "duration">(key: K, value: string) {
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [key]: next };
    });
  }

  // Every dropdown lists only what still exists among the courses passing all the other filters.
  const options = useMemo(() => ({
    level: facetOptions(filters, "level"),
    destination: facetOptions(filters, "destination"),
    location: facetOptions(filters, "location"),
    university: facetOptions(filters, "university"),
    course: facetOptions(filters, "course"),
    discipline: facetOptions(filters, "discipline"),
    duration: facetOptions(filters, "duration"),
    intake: facetOptions(filters, "intake"),
  }), [filters]);
  // The fee range speaks one currency at a time: the destination's own (country-configured first), with chips when its
  // courses use several. Amounts are never converted — see utils/courseFee.ts.
  const feeCurrencies = useMemo(() => feeCurrenciesFor([...filters.destination]), [filters.destination]);
  const feeCurrency = activeFeeCurrency(filters);
  const feeStats = useMemo(() => feeFilterStats(filters), [filters]);
  // A value picked earlier stays in its list even if a later choice made it unavailable, so the conflict is
  // obvious (and one tap away from fixing) rather than the chip silently vanishing.
  const withSelected = (list: string[], picked: Set<string>) => [...new Set([...picked, ...list])];

  function toggleCountry(value: string) {
    setFilters((prev) => {
      const destination = new Set(prev.destination);
      if (destination.has(value)) destination.delete(value); else destination.add(value);
      // Keep only the picked cities that still exist in the chosen countries.
      const valid = destination.size === 0 ? null : new Set(locationOptions(destination));
      const location = valid ? new Set([...prev.location].filter((l) => valid.has(l))) : prev.location;
      // Amounts in one currency mean nothing in another, so the fee range starts over for the new destination.
      return { ...prev, destination, location, feeCurrency: "", minFee: String(FEE_MIN), maxFee: String(FEE_MAX) };
    });
  }

  return (
    <div className="flex min-h-full flex-col pb-6">
      <div className="lg:mx-auto lg:w-full lg:max-w-5xl">
        <MobileHeader title="Advanced Search" onBack={() => navigate(basePath)} />
      </div>

      <div className="px-5 lg:mx-auto lg:w-full lg:max-w-5xl lg:px-10">
        <div className="space-y-3 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4 lg:space-y-0">
          <div className="lg:col-start-1 lg:row-start-1">
            <Section icon={<ListChecks size={15} />} title="Level">
              <DropdownChips
                label="Level" placeholder="Select Level"
                options={withSelected(options.level, filters.level)} selected={filters.level}
                onToggle={(v) => toggleSetValue("level", v)} open={openList === "level"} onToggleOpen={() => toggleOpen("level")}
              />
            </Section>
          </div>

          <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1">
            <Section icon={<Globe2 size={15} />} title="Course & Location">
              <DropdownChips
                label="Country" placeholder="Select Country"
                options={withSelected(options.destination, filters.destination)} selected={filters.destination}
                onToggle={toggleCountry} open={openList === "country"} onToggleOpen={() => toggleOpen("country")}
              />

              <div className="mt-3.5">
                <DropdownChips
                  label="City | State" placeholder="Select City | State"
                  options={withSelected(options.location, filters.location)} selected={filters.location}
                  onToggle={(v) => toggleSetValue("location", v)} open={openList === "location"} onToggleOpen={() => toggleOpen("location")}
                />
              </div>

              <div className="mt-3.5">
                <DropdownChips
                  label="University" placeholder="Select University"
                  options={withSelected(options.university, filters.universities)} selected={filters.universities}
                  onToggle={(v) => toggleSetValue("universities", v)} open={openList === "university"} onToggleOpen={() => toggleOpen("university")}
                />
              </div>

              <SubLabel className="mt-3.5">Course</SubLabel>
              {/* A plain text box: whatever is typed is matched against course names (any part of the name, any case)
                  and the results update as you type. */}
              <input
                type="text"
                value={filters.courseQuery}
                onChange={(e) => update("courseQuery", e.target.value)}
                placeholder="Type a course name, e.g. Data Science, MBA"
                autoComplete="off"
                className={inputClass}
              />

              <div className="mt-3.5">
                <DropdownChips
                  label="Discipline Area" placeholder="Select Discipline Area"
                  options={withSelected(options.discipline, filters.disciplineArea)} selected={filters.disciplineArea}
                  onToggle={(v) => toggleSetValue("disciplineArea", v)} open={openList === "discipline"} onToggleOpen={() => toggleOpen("discipline")}
                />
              </div>

              <div className="mt-3.5">
                <DropdownChips
                  label="Duration" placeholder="Select Duration"
                  options={withSelected(options.duration, filters.duration)} selected={filters.duration}
                  onToggle={(v) => toggleSetValue("duration", v)} open={openList === "duration"} onToggleOpen={() => toggleOpen("duration")}
                />
              </div>

              <div className="mt-3.5">
                <DropdownChips
                  label="Intake"
                  options={[...new Set([...options.intake, ...filters.intakes])]}
                  selected={filters.intakes}
                  onToggle={(v) => toggleSetValue("intakes", v)}
                  open={openList === "intake"}
                  onToggleOpen={() => toggleOpen("intake")}
                />
              </div>

              <SubLabel className="mt-3.5">ESL / ELP Available</SubLabel>
              <NeuSelect searchable
                value={filters.eslElpOnly ? "yes" : ""}
                onChange={(e) => update("eslElpOnly", e.target.value === "yes")}
                className={inputClass}
              >
                <option value="">Select Available ESL / ELP</option>
                <option value="yes">Available</option>
              </NeuSelect>
            </Section>
          </div>

          <div className="lg:col-start-3 lg:row-span-2 lg:row-start-1">
            <Section icon={<ShieldCheck size={15} />} title="Requirements">
              <CheckboxList options={ACCEPTED_ENGLISH_TEST_CHECKBOXES} selected={filters.acceptedEnglishTests} onToggle={(v) => toggleSetValue("acceptedEnglishTests", v)} />
              <div className="my-3 h-px bg-neutral-100" />
              <CheckboxList options={STANDARDIZED_TEST_OPTIONS} selected={filters.standardizedTests} onToggle={(v) => toggleSetValue("standardizedTests", v)} columns={2} />
              <div className="my-3 h-px bg-neutral-100" />
              <div className="space-y-2">
                <label className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                  <input type="checkbox" checked={filters.withoutEnglishProficiency} onChange={(e) => update("withoutEnglishProficiency", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-neutral-300" />
                  Without English Proficiency
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                  <input type="checkbox" checked={filters.withoutGRE} onChange={(e) => update("withoutGRE", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-neutral-300" />
                  Without GRE
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                  <input type="checkbox" checked={filters.withoutGMAT} onChange={(e) => update("withoutGMAT", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-neutral-300" />
                  Without GMAT
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                  <input type="checkbox" checked={filters.withoutMaths} onChange={(e) => update("withoutMaths", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-neutral-300" />
                  Without Maths
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                  <input type="checkbox" checked={filters.stemOnly} onChange={(e) => update("stemOnly", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-neutral-300" />
                  STEM Programs
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                  <input type="checkbox" checked={filters.feeWaiverOnly} onChange={(e) => update("feeWaiverOnly", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-neutral-300" />
                  Application Fee Waiver (up to 100%)
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                  <input type="checkbox" checked={filters.scholarshipOnly} onChange={(e) => update("scholarshipOnly", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-neutral-300" />
                  Scholarship Available
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                  <input type="checkbox" checked={filters.accepts15YearsOnly} onChange={(e) => update("accepts15YearsOnly", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-neutral-300" />
                  With 15 Years of Education
                </label>
                <label className="flex items-center gap-2 text-[12.5px] text-neutral-600">
                  <input type="checkbox" checked={filters.openProgramsOnly} onChange={(e) => update("openProgramsOnly", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-neutral-300" />
                  Open intake only
                </label>
              </div>
            </Section>
          </div>

          <div className="lg:col-start-1 lg:row-start-2">
            <Section icon={<ShieldCheck size={15} />} title="Cost & Score Requirements">
              <SubLabel>Annual Fees</SubLabel>
              <FeeRangeFilter
                min={filters.minFee}
                max={filters.maxFee}
                floor={FEE_MIN}
                ceiling={FEE_MAX}
                step={FEE_STEP}
                currency={feeCurrency}
                currencies={feeCurrencies}
                onCurrencyChange={(sym) => setFilters((prev) => ({ ...prev, feeCurrency: sym, minFee: String(FEE_MIN), maxFee: String(FEE_MAX) }))}
                onChange={(minFee, maxFee) => setFilters((prev) => ({ ...prev, minFee, maxFee }))}
                rangeActive={feeRangeActive(filters)}
                unknownCount={feeStats.unknown}
                otherCurrencyCount={feeStats.otherCurrency}
                includeUnknown={filters.includeUnknownFee}
                onIncludeUnknown={(v) => update("includeUnknownFee", v)}
              />

              <div className="mt-3.5 grid grid-cols-2 gap-3">
                <div>
                  <SubLabel>English Test</SubLabel>
                  <NeuSelect searchable aria-label="English Test" value={filters.englishTestName} onChange={(e) => update("englishTestName", e.target.value)} className={inputClass}>
                    {TEST_NAME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </NeuSelect>
                </div>
                <div>
                  <SubLabel>Overall Score</SubLabel>
                  <input
                    type="number"
                    inputMode="decimal"
                    value={filters.englishScore}
                    onChange={(e) => update("englishScore", e.target.value)}
                    placeholder="e.g. 6.5"
                    className={inputClass}
                  />
                </div>
              </div>

              <SubLabel className="mt-3.5">Academic GPA (out of 4.0)</SubLabel>
              <input
                type="number"
                inputMode="decimal"
                step="0.1"
                min="0"
                max="4"
                value={filters.minGPA}
                onChange={(e) => update("minGPA", e.target.value)}
                placeholder="e.g. 3.3"
                className={inputClass}
              />
              <p className="mt-1.5 text-[11px] text-neutral-400">Shows universities that accept your score or grade, or lower.</p>

              <div className="mt-3.5">
                <Toggle checked={filters.accreditedOnly} onChange={(v) => update("accreditedOnly", v)} label="Accredited institutions only" />
              </div>
            </Section>
          </div>
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center gap-3 bg-[var(--sd-bg)] px-5 pb-2 pt-4 lg:mx-auto lg:w-full lg:max-w-5xl lg:px-10">
        <button
          onClick={() => setFilters((prev) => emptyFilters(prev.residenceCountry))}
          className="shrink-0 text-[13px] font-medium text-neutral-900"
        >
          Clear All
        </button>
        <button
          onClick={() => navigate(basePath)}
          className="flex-1 rounded-xl bg-[image:var(--sd-gradient)] py-3.5 text-[13px] font-semibold text-white"
        >
          Show {resultCount} {resultCount === 1 ? "result" : "results"}
        </button>
      </div>
    </div>
  );
}
