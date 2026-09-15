// Real, interactive cost calculator embedded in a university's Fees tab — replaces the old
// CostPlanner.tsx mock's hardcoded numbers with live computation off the university's actual
// `fees` array. `recommendedFundsUSD` (country-level, see countryRegistry.ts) seeds the starting
// "Available Funds" figure since visa financial-proof norms genuinely differ by destination.
import { useState } from "react";
import { CheckCircle2, Lightbulb } from "lucide-react";
import type { University } from "../types";

type Course = University["courses"][number];

export function durationYears(duration?: string): number {
  if (!duration) return 1;
  const n = parseFloat(duration);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function CostCalculator({ university, course, recommendedFundsUSD }: { university: University; course?: Course; recommendedFundsUSD?: number }) {
  const [durationMode, setDurationMode] = useState<"1st Year" | "Full Duration">("1st Year");
  const [availableFunds, setAvailableFunds] = useState(recommendedFundsUSD ?? 0);

  const years = durationMode === "Full Duration" ? durationYears(course?.duration) : 1;
  const fees = university.fees;
  const scaledFees = fees.map((f) => ({ ...f, amount: Math.round(f.amount * years) }));
  const total = scaledFees.reduce((sum, f) => sum + f.amount, 0);
  const gap = Math.max(0, total - availableFunds);
  const currency = university.currencySymbol;

  return (
    <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
      <p className="text-[13px] font-semibold text-slate-800">Cost Calculator</p>

      <div className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 p-1">
        {(["1st Year", "Full Duration"] as const).map((d) => (
          <button
            key={d}
            onClick={() => setDurationMode(d)}
            className={`flex-1 rounded-lg py-2 text-[12.5px] font-medium transition ${
              durationMode === d ? "bg-[image:var(--sd-gradient)] text-white" : "text-slate-500"
            }`}
          >
            {d}
          </button>
        ))}
      </div>

      <div className="mt-3">
        {scaledFees.map((f) => (
          <div key={f.label} className="flex items-center justify-between py-1.5 text-[13px]">
            <span className="text-slate-500">{f.label}</span>
            <span className="font-medium text-slate-800">{currency}{f.amount.toLocaleString()}</span>
          </div>
        ))}
        <div className="mt-1 flex items-center justify-between border-t border-slate-100 pt-2.5">
          <span className="text-[13.5px] font-semibold text-slate-900">Estimated Total</span>
          <span className="text-[15px] font-bold text-slate-900">{currency}{total.toLocaleString()}</span>
        </div>
      </div>

      <label className="mt-3 block text-[11.5px] font-medium text-slate-500">
        Available Funds ({currency})
        <input
          type="number"
          min={0}
          value={availableFunds}
          onChange={(e) => setAvailableFunds(Math.max(0, Number(e.target.value) || 0))}
          className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-800"
        />
      </label>

      <div className="mt-3 rounded-xl bg-slate-50 p-3">
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12.5px] font-medium text-[var(--sd-teal)]">
            <CheckCircle2 size={14} /> Available Funds
          </span>
          <span className="text-[12.5px] font-semibold text-slate-800">{currency}{availableFunds.toLocaleString()}</span>
        </div>
        <div className="mt-1.5 flex items-center justify-between">
          <span className="text-[12.5px] font-medium text-rose-500">Funding Gap</span>
          <span className="text-[12.5px] font-semibold text-rose-500">{currency}{gap.toLocaleString()}</span>
        </div>
      </div>

      {recommendedFundsUSD != null && (
        <div className="mt-3 flex items-start gap-2 rounded-xl bg-[#E7EEFC] p-3">
          <Lightbulb size={15} className="mt-0.5 shrink-0 text-[#2955C4]" />
          <p className="text-[12px] leading-relaxed text-[#1B2C57]">
            {university.country}'s typical recommended available funds figure is ${recommendedFundsUSD.toLocaleString()}.
          </p>
        </div>
      )}
    </div>
  );
}
