// The Fees tab's budget tools. One course picker drives everything: the Cost Before Visa and Bank Statement tables first,
// then the Estimated Total Cost (tuition, a scholarship deduction, visa costs, medical test, air ticket and accommodation —
// each adjustable) as the summary below them, and a PDF of the result.
import { useMemo, useState } from "react";
import { AlertTriangle, Download } from "lucide-react";
import type { University } from "../types";
import type { CountryRecord } from "../data/countryRegistry";
import { buildCostModel, scholarshipAmountFrom, type DurationMode, type ScholarshipChoice } from "../utils/costModel";
import { downloadCostPdf } from "../utils/costPdf";
import { FEES_CAN_CHANGE_WARNING, durationMonths } from "../utils/ukvi";
import { NeuSelect } from "./ui/NeuSelect";
import { NeuTabs } from "./ui/NeuTabs";
import { SubLabel, inputClass } from "./ui/mobile";
import { VisaCostBreakdown } from "./VisaCostBreakdown";

const fmt = (n: number) => Math.round(n).toLocaleString();
const num = (s: string): number | null => { const t = s.trim(); if (t === "") return null; const n = Number(t); return Number.isFinite(n) && n >= 0 ? n : null; };
const smallInput = "w-24 rounded-lg bg-[var(--sd-card)] px-2 py-1.5 text-right text-[12.5px] tabular-nums text-neutral-800 shadow-neu-inset-sm focus:outline-none";

export function FeesPlanner({ university, course, country }: { university: University; course?: University["courses"][number]; country?: CountryRecord }) {
  const [name, setName] = useState(course?.name ?? university.courses[0]?.name ?? "");
  const [subject, setSubject] = useState("");
  const [mode, setMode] = useState<DurationMode>("1st Year");
  const [availableFunds, setAvailableFunds] = useState(0);
  const [depositInput, setDepositInput] = useState("");
  const [airInput, setAirInput] = useState("");
  const [medicalInput, setMedicalInput] = useState("");
  const [monthsInput, setMonthsInput] = useState("");
  const [scholarshipKey, setScholarshipKey] = useState(""); // "" none · "0".."n" a listed scholarship · "custom"
  const [customScholarship, setCustomScholarship] = useState("");

  const selected = university.courses.find((c) => c.name === name) ?? university.courses[0];
  const subjects = useMemo(() => [...new Set(university.courses.map((c) => c.subject).filter(Boolean))].sort((a, b) => a.localeCompare(b)), [university.courses]);
  const coursesInSubject = useMemo(() => (subject ? university.courses.filter((c) => c.subject === subject) : university.courses), [university.courses, subject]);
  const config = country?.visaCostConfig;

  // First pass (no scholarship) just to know the tuition being paid, which percentage scholarships are worked out against.
  const base = useMemo(
    () => buildCostModel(university, selected, config, mode, {
      depositOverride: num(depositInput), airTicket: num(airInput), medical: num(medicalInput), accommodationMonths: num(monthsInput),
    }),
    [university, selected, config, mode, depositInput, airInput, medicalInput, monthsInput],
  );
  const listed = university.scholarships ?? [];
  const scholarshipAmounts = useMemo(
    () => listed.map((sc) => scholarshipAmountFrom(`${sc.amount} ${sc.name}`, base.tuition, base.yearlyTuition, base.years)),
    [listed, base.tuition, base.yearlyTuition, base.years],
  );
  const chosen: ScholarshipChoice | null = useMemo(() => {
    if (scholarshipKey === "custom") { const n = num(customScholarship); return n ? { label: "Your scholarship", amount: n } : null; }
    if (scholarshipKey === "") return null;
    const i = Number(scholarshipKey);
    const amount = scholarshipAmounts[i];
    return listed[i] && amount ? { label: listed[i].name, amount } : null;
  }, [scholarshipKey, customScholarship, listed, scholarshipAmounts]);

  const m = useMemo(
    () => buildCostModel(university, selected, config, mode, {
      depositOverride: num(depositInput), airTicket: num(airInput), medical: num(medicalInput), accommodationMonths: num(monthsInput), scholarship: chosen,
    }),
    [university, selected, config, mode, depositInput, airInput, medicalInput, monthsInput, chosen],
  );
  const gap = Math.max(0, m.total - availableFunds);
  const showTables = !!config;
  const courseMonths = durationMonths(selected?.duration) ?? 12;
  // The country's configured figures, shown as hints even after the student has typed their own.
  const defaults = useMemo(() => buildCostModel(university, selected, config, mode), [university, selected, config, mode]);
  const defaultAir = defaults.airTicket?.foreign ?? null;
  const defaultMedical = defaults.medical?.foreign ?? null;

  function download() {
    downloadCostPdf({ model: m, universityName: university.name, country: university.country, courseName: selected?.name ?? "", mode, showVisaTables: showTables, availableFunds });
  }

  return (
    <div className="space-y-4">
      {/* 1. What to calculate for */}
      <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-neu">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[13.5px] font-semibold text-neutral-900">Cost Calculator</p>
          <button onClick={download} className="flex items-center gap-1.5 rounded-full bg-[var(--sd-card)] px-3 py-1.5 text-[11.5px] font-semibold text-[var(--sd-ink)] shadow-neu-sm">
            <Download size={13} /> Download PDF
          </button>
        </div>
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
                  if (next && selected?.subject !== next) {
                    const first = university.courses.find((c) => c.subject === next);
                    if (first) setName(first.name);
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
              <NeuSelect searchable value={selected?.name ?? ""} onChange={(e) => { setName(e.target.value); setMonthsInput(""); setScholarshipKey(""); }} className={inputClass}>
                {coursesInSubject.map((c) => <option key={c.name} value={c.name}>{c.level ? `${c.name} (${c.level})` : c.name}</option>)}
              </NeuSelect>
            </div>
          </div>
        )}
        <NeuTabs className="mt-2" ariaLabel="Duration" tabs={["1st Year", "Full Duration"] as const} value={mode} onChange={(v) => { setMode(v); setMonthsInput(""); }} />
      </div>

      {/* 2. The visa tables */}
      {showTables && <VisaCostBreakdown model={m} depositInput={depositInput} onDepositChange={setDepositInput} />}

      {/* 3. Estimated total, below the tables */}
      <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-neu">
        <p className="text-[13.5px] font-semibold text-neutral-900">Estimated Total Cost</p>
        <p className="mb-2 mt-0.5 text-[11px] text-neutral-500">
          {mode === "1st Year" ? "First year, plus the one-off visa costs." : `The whole ${courseMonths}-month course, plus the one-off visa costs.`} Change the boxes to match your plans.
        </p>

        <Line label={m.years > 1 ? `Tuition (${Math.round(m.years * 10) / 10} years)` : "Tuition (first year)"} value={m.tuitionKind === "amount" ? `${m.currency}${fmt(m.tuition)}` : m.tuitionKind === "free" ? "Free" : "Fee not provided"} />

        <div className="border-b border-neutral-200/60 py-2">
          <SubLabel>Scholarship to deduct</SubLabel>
          <NeuSelect value={scholarshipKey} onChange={(e) => setScholarshipKey(e.target.value)} className={inputClass} aria-label="Scholarship">
            <option value="">No scholarship</option>
            {listed.map((sc, i) => (
              <option key={`${sc.name}-${i}`} value={String(i)} disabled={!scholarshipAmounts[i]}>
                {sc.name} — {sc.amount}{scholarshipAmounts[i] ? "" : " (amount not stated)"}
              </option>
            ))}
            <option value="custom">Enter an amount…</option>
          </NeuSelect>
          {scholarshipKey === "custom" && (
            <input type="number" min={0} inputMode="decimal" value={customScholarship} onChange={(e) => setCustomScholarship(e.target.value)} placeholder={`Scholarship amount (${m.currency.trim()})`} className={`${inputClass} mt-2`} aria-label="Scholarship amount" />
          )}
          {listed.length === 0 && university.scholarshipsAvailable && scholarshipKey === "" && (
            <p className="mt-1 text-[10.5px] text-neutral-400">This university offers scholarships but hasn't listed amounts — enter one if you have been awarded it.</p>
          )}
          {m.scholarship && <Line label={`Scholarship: ${m.scholarship.label}`} note="Taken off the tuition" value={`-${m.currency}${fmt(m.scholarship.amount)}`} green />}
        </div>

        {m.ihs && <Line label="Immigration Health Surcharge" note={m.ihs.note} value={`${m.currency}${fmt(m.ihs.amount)}`} />}
        {m.visaFee > 0 && <Line label="Visa application fee" value={`${m.currency}${fmt(m.visaFee)}`} />}

        <InputLine
          label="Medical test"
          note={defaultMedical !== null ? `Usually ${m.currency}${fmt(defaultMedical)} (set for this country)` : "Enter your cost"}
          prefix={m.currency.trim()} value={medicalInput} placeholder={defaultMedical !== null ? fmt(defaultMedical) : "0"} onChange={setMedicalInput} ariaLabel="Medical test cost"
        />
        <InputLine
          label="Air ticket"
          note={defaultAir !== null ? `Usually ${m.currency}${fmt(defaultAir)} (set for this country)` : "Enter your cost"}
          prefix={m.currency.trim()} value={airInput} placeholder={defaultAir !== null ? fmt(defaultAir) : "0"} onChange={setAirInput} ariaLabel="Air ticket cost"
        />

        {m.accommodation && (
          <div className="flex items-start justify-between gap-3 border-b border-neutral-200/60 py-2 text-[12.5px] last:border-b-0">
            <span className="min-w-0">
              <span className="block font-medium leading-snug text-neutral-800">Accommodation</span>
              <span className="mt-0.5 block text-[10.5px] leading-snug text-neutral-400">{m.accommodation.place}: {m.currency}{fmt(m.accommodation.monthly)} per month</span>
              <span className="mt-1.5 flex items-center gap-1.5 text-[11px] text-neutral-500">
                for
                <input
                  type="number" min={0} max={120} step={1} inputMode="numeric"
                  value={monthsInput} placeholder={String(m.accommodation.defaultMonths)}
                  onChange={(e) => setMonthsInput(e.target.value)}
                  className="w-16 rounded-lg bg-[var(--sd-card)] px-2 py-1.5 text-center text-[12.5px] tabular-nums text-neutral-800 shadow-neu-inset-sm focus:outline-none"
                  aria-label="Months of accommodation"
                />
                months
              </span>
            </span>
            <span className="shrink-0 pt-0.5 font-medium tabular-nums text-neutral-800">{m.currency}{fmt(m.accommodation.amount)}</span>
          </div>
        )}

        <div className="mt-2 flex items-center justify-between rounded-xl bg-[var(--sd-card)] px-3 py-3 shadow-neu-inset-sm">
          <span className="text-[13.5px] font-semibold text-neutral-900">Estimated Total</span>
          <span className="text-[16px] font-bold tabular-nums text-neutral-900">{m.currency}{fmt(m.total)}</span>
        </div>
        {m.uk && <p className="mt-1.5 text-[10.5px] leading-snug text-neutral-400">Accommodation uses the average student rent for the region (Save the Student survey 2025). Your real rent depends on the room and provider.</p>}
        {m.notes.map((n) => <p key={n} className="mt-1.5 text-[10.5px] leading-snug text-neutral-500">{n}</p>)}

        <div className="mt-3">
          <SubLabel>Available Funds ({m.currency.trim()})</SubLabel>
          <input type="number" min={0} value={availableFunds} onChange={(e) => setAvailableFunds(Math.max(0, Number(e.target.value) || 0))} className={inputClass} />
        </div>
        <div className="mt-3 rounded-xl bg-[var(--sd-card)] p-3 text-[12.5px] shadow-neu-inset-sm">
          <div className="flex items-center justify-between"><span className="font-medium text-neutral-900">Funding gap</span><span className="font-semibold tabular-nums text-neutral-900">{m.currency}{fmt(gap)}</span></div>
          {m.casDeposit > 0 && (
            <>
              <div className="mt-1.5 flex items-center justify-between"><span className="text-neutral-600">Deposit to secure your place</span><span className="font-semibold tabular-nums text-neutral-800">{m.currency}{fmt(m.casDeposit)}</span></div>
              <div className="mt-1.5 flex items-center justify-between"><span className="text-neutral-600">Balance after deposit</span><span className="font-semibold tabular-nums text-neutral-800">{m.currency}{fmt(Math.max(0, m.total - m.casDeposit))}</span></div>
              <p className="mt-1.5 text-[10.5px] text-neutral-400">The deposit is normally credited against tuition, so it isn't added on top of the total.</p>
            </>
          )}
        </div>

        <button onClick={download} className="mt-3 flex w-full items-center justify-center gap-2 rounded-full bg-[var(--sd-card)] py-3 text-[13px] font-semibold text-[var(--sd-ink)] shadow-neu-sm">
          <Download size={15} /> Download PDF
        </button>

        <div className="mt-3 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3">
          <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
          <p className="text-[12px] leading-relaxed text-amber-700">{FEES_CAN_CHANGE_WARNING}</p>
        </div>
      </div>
    </div>
  );
}

function Line({ label, note, value, green }: { label: string; note?: string; value: string; green?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-3 border-b border-neutral-200/60 py-2 text-[12.5px] last:border-b-0">
      <span className="min-w-0">
        <span className="block font-medium leading-snug text-neutral-800">{label}</span>
        {note && <span className="mt-0.5 block text-[10.5px] leading-snug text-neutral-400">{note}</span>}
      </span>
      <span className={`shrink-0 font-medium tabular-nums ${green ? "text-emerald-700" : "text-neutral-800"}`}>{value}</span>
    </div>
  );
}

function InputLine({ label, note, prefix, value, placeholder, onChange, ariaLabel }: { label: string; note?: string; prefix: string; value: string; placeholder: string; onChange: (v: string) => void; ariaLabel: string }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-neutral-200/60 py-2 text-[12.5px]">
      <span className="min-w-0">
        <span className="block font-medium leading-snug text-neutral-800">{label}</span>
        {note && <span className="mt-0.5 block text-[10.5px] leading-snug text-neutral-400">{note}</span>}
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <span className="text-[11.5px] text-neutral-400">{prefix}</span>
        <input type="number" min={0} inputMode="decimal" value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={smallInput} aria-label={ariaLabel} />
      </span>
    </div>
  );
}
