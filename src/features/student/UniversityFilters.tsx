import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Globe2, GraduationCap, Wallet } from "lucide-react";
import { MobileHeader, Section, SubLabel, DropdownChips, Toggle, SuggestInput, inputClass } from "../../components/ui/mobile";
import { COUNTRIES } from "../../data/countries";
import {
  DESTINATION_OPTIONS, DURATION_OPTIONS, LEVEL_OPTIONS, SUBJECT_OPTIONS, COURSE_OPTIONS,
  UNIVERSITY_OPTIONS, TEST_NAME_OPTIONS, INTAKE_OPTIONS,
  FEE_MIN_USD, FEE_MAX_USD, FEE_STEP_USD, citiesForDestination,
  emptyFilters, type UniversityFilterState,
} from "../../utils/universityFilter";
import type { FiltersOutletContext } from "./UniversitySearch";

export default function UniversityFilters() {
  const navigate = useNavigate();
  const { filters, setFilters, resultCount } = useOutletContext<FiltersOutletContext>();
  const [intakeOpen, setIntakeOpen] = useState(false);

  // Always update from the previous state, never the `filters` snapshot in this closure — a
  // handler that needs to set two fields at once (e.g. destination + resetting city) would
  // otherwise have its first change silently clobbered by the second.
  function update<K extends keyof UniversityFilterState>(key: K, value: UniversityFilterState[K]) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function toggleSetValue<K extends "intakes">(key: K, value: string) {
    setFilters((prev) => {
      const next = new Set(prev[key]);
      if (next.has(value)) next.delete(value);
      else next.add(value);
      return { ...prev, [key]: next };
    });
  }

  const cityOptions = citiesForDestination(filters.destination);

  return (
    <div className="flex min-h-full flex-col pb-6">
      <div className="lg:mx-auto lg:w-full lg:max-w-5xl">
        <MobileHeader title="Filters" onBack={() => navigate("/student/search")} />
      </div>

      <div className="px-5 lg:mx-auto lg:w-full lg:max-w-5xl lg:px-10">
        <div className="space-y-3 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4 lg:space-y-0">
          <Section icon={<Globe2 size={15} />} title="Where">
            <SubLabel>My Residence Country</SubLabel>
            <select
              value={filters.residenceCountry}
              onChange={(e) => update("residenceCountry", e.target.value)}
              className={inputClass}
            >
              <option value="">Not set</option>
              {COUNTRIES.map((c) => (
                <option key={c.iso2} value={c.iso2}>{c.flag} {c.name}</option>
              ))}
            </select>

            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <div>
                <SubLabel>Preferred Destination</SubLabel>
                <select
                  value={filters.destination}
                  onChange={(e) => {
                    const destination = e.target.value;
                    setFilters((prev) => ({ ...prev, destination, city: "" }));
                  }}
                  className={inputClass}
                >
                  <option value="">Any</option>
                  {DESTINATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <SubLabel>Preferred City</SubLabel>
                <select value={filters.city} onChange={(e) => update("city", e.target.value)} className={inputClass}>
                  <option value="">Any</option>
                  {cityOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>
          </Section>

          <Section icon={<GraduationCap size={15} />} title="Program">
            <SubLabel>University</SubLabel>
            <SuggestInput
              value={filters.universityQuery}
              onChange={(v) => update("universityQuery", v)}
              options={UNIVERSITY_OPTIONS}
              placeholder="Start typing a university name"
            />

            <SubLabel className="mt-3.5">Course</SubLabel>
            <SuggestInput
              value={filters.courseQuery}
              onChange={(v) => update("courseQuery", v)}
              options={COURSE_OPTIONS}
              placeholder="e.g. Data Science, MBA, Architecture"
            />

            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <div>
                <SubLabel>Duration</SubLabel>
                <select value={filters.duration} onChange={(e) => update("duration", e.target.value)} className={inputClass}>
                  <option value="">Any</option>
                  {DURATION_OPTIONS.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
              <div>
                <SubLabel>Level</SubLabel>
                <select value={filters.level} onChange={(e) => update("level", e.target.value)} className={inputClass}>
                  <option value="">Any</option>
                  {LEVEL_OPTIONS.map((l) => (
                    <option key={l} value={l}>{l}</option>
                  ))}
                </select>
              </div>
            </div>

            <SubLabel className="mt-3.5">Subject</SubLabel>
            <SuggestInput
              value={filters.subjectQuery}
              onChange={(v) => update("subjectQuery", v)}
              options={SUBJECT_OPTIONS}
              placeholder="e.g. Engineering, Law, Data Science"
            />

            <div className="mt-3.5">
              <DropdownChips
                label="Intake"
                options={INTAKE_OPTIONS}
                selected={filters.intakes}
                onToggle={(v) => toggleSetValue("intakes", v)}
                open={intakeOpen}
                onToggleOpen={() => setIntakeOpen((v) => !v)}
              />
            </div>
          </Section>

          <Section icon={<Wallet size={15} />} title="Cost & Requirements">
            <SubLabel>
              Annual Fees — ${Number(filters.minFeeUSD).toLocaleString()} to ${Number(filters.maxFeeUSD).toLocaleString()} (USD, approx.)
            </SubLabel>
            <input
              type="range"
              min={FEE_MIN_USD}
              max={FEE_MAX_USD}
              step={FEE_STEP_USD}
              value={filters.minFeeUSD}
              onChange={(e) => update("minFeeUSD", Math.min(Number(e.target.value), Number(filters.maxFeeUSD)).toString())}
              className="w-full accent-[var(--sd-ink)]"
            />
            <input
              type="range"
              min={FEE_MIN_USD}
              max={FEE_MAX_USD}
              step={FEE_STEP_USD}
              value={filters.maxFeeUSD}
              onChange={(e) => update("maxFeeUSD", Math.max(Number(e.target.value), Number(filters.minFeeUSD)).toString())}
              className="mt-1 w-full accent-[var(--sd-ink)]"
            />

            <div className="mt-3.5 grid grid-cols-2 gap-3">
              <div>
                <SubLabel>English Test</SubLabel>
                <select aria-label="English Test" value={filters.englishTestName} onChange={(e) => update("englishTestName", e.target.value)} className={inputClass}>
                  {TEST_NAME_OPTIONS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
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
            <p className="mt-1.5 text-[11px] text-slate-400">Shows universities that accept your score or grade, or lower.</p>

            <div className="mt-3.5">
              <Toggle
                checked={filters.accreditedOnly}
                onChange={(v) => update("accreditedOnly", v)}
                label="Accredited institutions only"
              />
            </div>

            <div className="mt-3.5">
              <Toggle
                checked={filters.scholarshipOnly}
                onChange={(v) => update("scholarshipOnly", v)}
                label="Scholarships available only"
              />
            </div>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center gap-3 bg-[var(--sd-bg)] px-5 pb-2 pt-4 lg:mx-auto lg:w-full lg:max-w-5xl lg:px-10">
        <button
          onClick={() => setFilters((prev) => emptyFilters(prev.residenceCountry))}
          className="shrink-0 text-[13px] font-medium text-rose-500"
        >
          Reset all
        </button>
        <button
          onClick={() => navigate("/student/search")}
          className="flex-1 rounded-xl bg-[var(--sd-ink)] py-3.5 text-[13px] font-semibold text-white"
        >
          Show {resultCount} {resultCount === 1 ? "result" : "results"}
        </button>
      </div>
    </div>
  );
}
