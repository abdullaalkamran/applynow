// Real, interactive cost calculator embedded in a university's Fees tab — replaces the old
// CostPlanner.tsx mock's hardcoded numbers with live computation off the university's actual
// `fees` array. `recommendedFundsUSD` (country-level, see countryRegistry.ts) seeds the starting
// "Available Funds" figure since visa financial-proof norms genuinely differ by destination.
import { useMemo, useState } from "react";
import { AlertTriangle, CheckCircle2, Lightbulb } from "lucide-react";
import type { University } from "../types";
import { NeuSelect } from "./ui/NeuSelect";
import { NeuTabs } from "./ui/NeuTabs";
import { SubLabel, inputClass } from "./ui/mobile";
import { courseCurrencySymbol, courseFeeKind, sameCurrency } from "../utils/courseFee";
import { FEES_CAN_CHANGE_WARNING, UK_IHS_PER_YEAR, durationMonths, isLondon, isUkCountry, ukIhs, ukMaintenance } from "../utils/ukvi";

type Course = University["courses"][number];

export function durationYears(duration?: string): number {
  const months = durationMonths(duration);
  return months == null ? 1 : months / 12;
}

export function CostCalculator({
  university, course, onCourseChange, recommendedFundsUSD, ihsPerYear,
}: {
  university: University;
  course?: Course;
  onCourseChange?: (name: string) => void;
  recommendedFundsUSD?: number;
  /** Country-configured IHS per visa year; UK falls back to the current GOV.UK student rate. */
  ihsPerYear?: number;
}) {
  const [durationMode, setDurationMode] = useState<"1st Year" | "Full Duration">("1st Year");
  // Starts at 0 on purpose: the country's "recommended funds" figure is in US dollars, so it is shown as a labelled
  // hint below and never dropped into this field in £/€/etc.
  const [availableFunds, setAvailableFunds] = useState(0);
  // Subject narrows the course list; "" = every subject.
  const [subject, setSubject] = useState("");
  const subjects = useMemo(() => [...new Set(university.courses.map((c) => c.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [university.courses]);
  const coursesInSubject = useMemo(() => (subject ? university.courses.filter((c) => c.subject === subject) : university.courses), [university.courses, subject]);

  const years = durationMode === "Full Duration" ? durationYears(course?.duration) : 1;
  const currency = course ? courseCurrencySymbol(university, course) : university.currencySymbol;
  const tuitionKind = course ? courseFeeKind(course) : "unknown";
  const yearlyTuition = course && tuitionKind === "amount" ? course.feeUSD : 0;
  const tuition = Math.round(yearlyTuition * years);

  // Everything here comes from the selected course: the university's own average fee list is never used.
  // UK only: IHS is paid for the whole visa up front (course + UKVI extra time), whichever duration view is shown.
  const uk = isUkCountry(university.country) && !!course && sameCurrency(currency, "£");
  const ihs = uk ? ukIhs(course?.duration, ihsPerYear || UK_IHS_PER_YEAR) : null;
  const total = tuition + (ihs?.amount ?? 0);
  const gap = Math.max(0, total - availableFunds);

  // Deposit secures the place after an offer and is normally credited against tuition, so it's shown as
  // the amount due first and the balance left, not added on top of the total.
  const deposit = university.minimumDepositAmount == null ? null
    : university.depositMode === "half" ? Math.round(yearlyTuition * 0.5)
    : university.depositMode === "full" ? Math.round(yearlyTuition)
    : university.minimumDepositAmount;
  const balance = deposit == null ? null : Math.max(0, total - deposit);

  return (
    <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-neu">
      <p className="text-[13px] font-semibold text-neutral-800">Cost Calculator</p>

      {university.courses.length > 0 && (
        <div className="mt-3 space-y-3">
          <div>
            <SubLabel>Subject</SubLabel>
            <NeuSelect
              searchable
              value={subject}
              onChange={(e) => {
                const next = e.target.value;
                setSubject(next);
                // Keep the selected course when it belongs to the new subject; otherwise move to that subject's first one.
                if (next && course?.subject !== next) {
                  const first = university.courses.find((c) => c.subject === next);
                  if (first) onCourseChange?.(first.name);
                }
              }}
              className={inputClass}
            >
              <option value="">All subjects</option>
              {subjects.map((sub) => <option key={sub} value={sub}>{sub}</option>)}
            </NeuSelect>
          </div>
          <div>
            <SubLabel>Course</SubLabel>
            <NeuSelect searchable value={course?.name ?? ""} onChange={(e) => onCourseChange?.(e.target.value)} className={inputClass}>
              {coursesInSubject.map((c) => <option key={c.name} value={c.name}>{c.level ? `${c.name} (${c.level})` : c.name}</option>)}
            </NeuSelect>
          </div>
        </div>
      )}

      <NeuTabs className="mt-2" ariaLabel="Duration" tabs={["1st Year", "Full Duration"] as const} value={durationMode} onChange={setDurationMode} />

      <div className="mt-3">
        {course && (
          <div className="flex items-center justify-between py-1.5 text-[13px]">
            <span className="text-neutral-500">Tuition{years > 1 ? ` (${years} years)` : " (per year)"}</span>
            <span className="font-medium text-neutral-800">
              {tuitionKind === "amount" ? `${currency}${tuition.toLocaleString()}` : tuitionKind === "free" ? "Free" : "Fee not provided"}
            </span>
          </div>
        )}
        {ihs && (
          <div className="py-1.5 text-[13px]">
            <div className="flex items-center justify-between">
              <span className="text-neutral-500">Immigration Health Surcharge (IHS)</span>
              <span className="font-medium text-neutral-800">{currency}{ihs.amount.toLocaleString()}</span>
            </div>
            <p className="mt-0.5 text-[11px] text-neutral-400">
              {ihs.years === 0
                ? "A visa of 6 months or less needs no IHS when applying from outside the UK."
                : `${ihs.courseMonths}-month course + extra visa time = ${ihs.visaMonths} months → ${ihs.years} × ${currency}${(ihsPerYear || UK_IHS_PER_YEAR).toLocaleString()}. Paid for the whole visa up front.`}
            </p>
          </div>
        )}
        <div className="mt-1 flex items-center justify-between border-t border-transparent pt-2.5">
          <span className="text-[13.5px] font-semibold text-neutral-900">Estimated Total</span>
          <span className="text-[15px] font-bold text-neutral-900">{currency}{total.toLocaleString()}</span>
        </div>
      </div>

      <div className="mt-3">
        <SubLabel>Available Funds ({currency})</SubLabel>
        <input
          type="number"
          min={0}
          value={availableFunds}
          onChange={(e) => setAvailableFunds(Math.max(0, Number(e.target.value) || 0))}
          className={inputClass}
        />
      </div>

      {deposit != null && (
        <div className="mt-3 rounded-xl bg-[var(--sd-card)] shadow-neu-inset-sm p-3">
          <div className="flex items-center justify-between">
            <span className="text-[12.5px] font-medium text-neutral-900">Deposit to secure your place</span>
            <span className="text-[12.5px] font-semibold text-neutral-800">{currency}{deposit.toLocaleString()}</span>
          </div>
          <div className="mt-1.5 flex items-center justify-between">
            <span className="text-[12.5px] text-neutral-500">Balance after deposit</span>
            <span className="text-[12.5px] font-semibold text-neutral-800">{currency}{(balance ?? 0).toLocaleString()}</span>
          </div>
          <p className="mt-1.5 text-[11px] text-neutral-400">The deposit is normally credited against tuition, so it isn't added to the total.</p>
        </div>
      )}

      <div className="mt-3 rounded-xl bg-[var(--sd-card)] shadow-neu-inset-sm p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--sd-teal)]">
            <CheckCircle2 size={14} /> Available Funds
          </span>
          <span className="text-[12.5px] font-semibold text-neutral-800">{currency}{availableFunds.toLocaleString()}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-neutral-900">Funding Gap</span>
          <span className="text-[12.5px] font-semibold text-neutral-900">{currency}{gap.toLocaleString()}</span>
        </div>
      </div>

      {uk && course && (() => {
        const months = durationMonths(course.duration) ?? 12;
        const london = isLondon(university.city);
        const need = ukMaintenance(months, london);
        return (
          <div className="mt-3 rounded-xl bg-[var(--sd-card)] shadow-neu-inset-sm p-3 text-[12px] text-neutral-700">
            <p className="font-medium text-neutral-900">UK visa maintenance funds</p>
            <p className="mt-1 leading-relaxed">
              {london ? "London" : "Outside London"}: up to {Math.min(9, months)} months of living costs = <span className="font-semibold">{currency}{need.toLocaleString()}</span>, on top of any unpaid first-year tuition, held for 28 days before you apply.
            </p>
          </div>
        );
      })()}

      {recommendedFundsUSD != null && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--sd-card)] shadow-neu-inset-sm p-3">
          <Lightbulb size={15} className="mt-0.5 shrink-0 text-neutral-900" />
          <p className="text-[12px] leading-relaxed text-neutral-900">
            {university.country}'s typical recommended funds figure is US${recommendedFundsUSD.toLocaleString()} (US dollars — not converted to {currency.trim() || "the fee currency"}).
          </p>
        </div>
      )}

      <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
        <p className="text-[12px] leading-relaxed text-amber-700">{FEES_CAN_CHANGE_WARNING}</p>
      </div>
    </div>
  );
}
