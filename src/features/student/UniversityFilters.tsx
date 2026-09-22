import { useState } from "react";
import { useOutletContext, useNavigate } from "react-router-dom";
import { Globe2, ListChecks, ShieldCheck, Wallet } from "lucide-react";
import { MobileHeader, Section, SubLabel, DropdownChips, Toggle, SuggestInput, CheckboxList, inputClass } from "../../components/ui/mobile";
import {
  destinationOptions, durationOptions, levelOptions, subjectOptions, courseOptions,
  universityOptions, TEST_NAME_OPTIONS, intakeOptions, provinceOptions, disciplineAreaOptions,
  PROGRAM_LEVEL_OPTIONS, STANDARDIZED_TEST_OPTIONS, ACCEPTED_ENGLISH_TEST_CHECKBOXES,
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

  function toggleSetValue<K extends "intakes" | "standardizedTests" | "acceptedEnglishTests">(key: K, value: string) {
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
        <MobileHeader title="Advanced Search" onBack={() => navigate("/student/search")} />
      </div>

      <div className="px-5 lg:mx-auto lg:w-full lg:max-w-5xl lg:px-10">
        <div className="space-y-3 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4 lg:space-y-0">
          <Section icon={<ListChecks size={15} />} title="Program Level">
            <select value={filters.programLevel} onChange={(e) => update("programLevel", e.target.value)} className={inputClass}>
              <option value="">Select Program Level</option>
              {PROGRAM_LEVEL_OPTIONS.map((p) => <option key={p} value={p}>{p}</option>)}
            </select>
          </Section>

          <Section icon={<Globe2 size={15} />} title="Other Filters">
            <SubLabel>Country</SubLabel>
            <select
              value={filters.destination}
              onChange={(e) => {
                const destination = e.target.value;
                setFilters((prev) => ({ ...prev, destination, city: "" }));
              }}
              className={inputClass}
            >
              <option value="">Select Country</option>
              {destinationOptions().map((d) => <option key={d} value={d}>{d}</option>)}
            </select>

            <SubLabel className="mt-3.5">Province | State</SubLabel>
            <select value={filters.province} onChange={(e) => update("province", e.target.value)} className={inputClass}>
              <option value="">Select Province | State</option>
              {provinceOptions().map((p) => <option key={p} value={p}>{p}</option>)}
            </select>

            <SubLabel className="mt-3.5">Study Area</SubLabel>
            <SuggestInput
              value={filters.subjectQuery}
              onChange={(v) => update("subjectQuery", v)}
              options={subjectOptions()}
              placeholder="Select Study Area"
            />

            <SubLabel className="mt-3.5">Discipline Area</SubLabel>
            <select value={filters.disciplineArea} onChange={(e) => update("disciplineArea", e.target.value)} className={inputClass}>
              <option value="">Select Discipline Area</option>
              {disciplineAreaOptions().map((d) => <option key={d} value={d}>{d}</option>)}
            </select>

            <SubLabel className="mt-3.5">Duration</SubLabel>
            <select value={filters.duration} onChange={(e) => update("duration", e.target.value)} className={inputClass}>
              <option value="">Select Duration</option>
              {durationOptions().map((d) => <option key={d} value={d}>{d}</option>)}
            </select>

            <SubLabel className="mt-3.5">ESL / ELP Available</SubLabel>
            <select
              value={filters.eslElpOnly ? "yes" : ""}
              onChange={(e) => update("eslElpOnly", e.target.value === "yes")}
              className={inputClass}
            >
              <option value="">Select Available ESL / ELP</option>
              <option value="yes">Available</option>
            </select>
          </Section>

          <Section icon={<ShieldCheck size={15} />} title="Requirements">
            <CheckboxList options={ACCEPTED_ENGLISH_TEST_CHECKBOXES} selected={filters.acceptedEnglishTests} onToggle={(v) => toggleSetValue("acceptedEnglishTests", v)} />
            <div className="my-3 h-px bg-slate-100" />
            <CheckboxList options={STANDARDIZED_TEST_OPTIONS} selected={filters.standardizedTests} onToggle={(v) => toggleSetValue("standardizedTests", v)} columns={2} />
            <div className="my-3 h-px bg-slate-100" />
            <div className="space-y-2">
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={filters.withoutEnglishProficiency} onChange={(e) => update("withoutEnglishProficiency", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
                Without English Proficiency
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={filters.withoutGRE} onChange={(e) => update("withoutGRE", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
                Without GRE
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={filters.withoutGMAT} onChange={(e) => update("withoutGMAT", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
                Without GMAT
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={filters.withoutMaths} onChange={(e) => update("withoutMaths", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
                Without Maths
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={filters.stemOnly} onChange={(e) => update("stemOnly", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
                STEM Programs
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={filters.feeWaiverOnly} onChange={(e) => update("feeWaiverOnly", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
                Application Fee Waiver (up to 100%)
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={filters.scholarshipOnly} onChange={(e) => update("scholarshipOnly", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
                Scholarship Available
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={filters.accepts15YearsOnly} onChange={(e) => update("accepts15YearsOnly", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
                With 15 Years of Education
              </label>
              <label className="flex items-center gap-2 text-[12.5px] text-slate-600">
                <input type="checkbox" checked={filters.openProgramsOnly} onChange={(e) => update("openProgramsOnly", e.target.checked)} className="h-3.5 w-3.5 shrink-0 rounded border-slate-300" />
                Open Programs
              </label>
            </div>
          </Section>
        </div>

        <div className="mt-5 space-y-3 lg:grid lg:grid-cols-3 lg:items-start lg:gap-4 lg:space-y-0">
          <Section icon={<Globe2 size={15} />} title="More Filters">
            <SubLabel>Preferred City</SubLabel>
            <select value={filters.city} onChange={(e) => update("city", e.target.value)} className={inputClass}>
              <option value="">Any</option>
              {cityOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>

            <SubLabel className="mt-3.5">Level</SubLabel>
            <select value={filters.level} onChange={(e) => update("level", e.target.value)} className={inputClass}>
              <option value="">Any</option>
              {levelOptions().map((l) => <option key={l} value={l}>{l}</option>)}
            </select>

            <div className="mt-3.5">
              <DropdownChips
                label="Intake"
                options={intakeOptions()}
                selected={filters.intakes}
                onToggle={(v) => toggleSetValue("intakes", v)}
                open={intakeOpen}
                onToggleOpen={() => setIntakeOpen((v) => !v)}
              />
            </div>
          </Section>

          <Section icon={<Wallet size={15} />} title="University / Course">
            <SubLabel>University</SubLabel>
            <SuggestInput
              value={filters.universityQuery}
              onChange={(v) => update("universityQuery", v)}
              options={universityOptions()}
              placeholder="Start typing a university name"
            />
            <SubLabel className="mt-3.5">Course</SubLabel>
            <SuggestInput
              value={filters.courseQuery}
              onChange={(v) => update("courseQuery", v)}
              options={courseOptions()}
              placeholder="e.g. Data Science, MBA, Architecture"
            />
          </Section>

          <Section icon={<ShieldCheck size={15} />} title="Cost & Score Requirements">
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
                  {TEST_NAME_OPTIONS.map((t) => <option key={t} value={t}>{t}</option>)}
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
              <Toggle checked={filters.accreditedOnly} onChange={(v) => update("accreditedOnly", v)} label="Accredited institutions only" />
            </div>
          </Section>
        </div>
      </div>

      <div className="sticky bottom-0 mt-auto flex items-center gap-3 bg-[var(--sd-bg)] px-5 pb-2 pt-4 lg:mx-auto lg:w-full lg:max-w-5xl lg:px-10">
        <button
          onClick={() => setFilters((prev) => emptyFilters(prev.residenceCountry))}
          className="shrink-0 text-[13px] font-medium text-rose-500"
        >
          Clear All
        </button>
        <button
          onClick={() => navigate("/student/search")}
          className="flex-1 rounded-xl bg-[image:var(--sd-gradient)] py-3.5 text-[13px] font-semibold text-white"
        >
          Show {resultCount} {resultCount === 1 ? "result" : "results"}
        </button>
      </div>
    </div>
  );
}
