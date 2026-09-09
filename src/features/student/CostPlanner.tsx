import { useState } from "react";
import { ChevronDown, CheckCircle2, Lightbulb } from "lucide-react";
import { MobileHeader } from "../../components/ui/mobile";
import { UNIVERSITIES } from "../../data/mockData";

const AVAILABLE_FUNDS = 35000;

export default function CostPlanner() {
  const [duration, setDuration] = useState<"1st Year" | "Full Duration">("1st Year");
  const fees = UNIVERSITIES[0].fees;
  const total = fees.reduce((sum, f) => sum + f.amount, 0);
  const gap = Math.max(0, total - AVAILABLE_FUNDS);

  return (
    <div className="min-h-full pb-8">
      <MobileHeader title="Cost Planner" />

      <div className="px-5">
        <button className="flex w-full items-center justify-between rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.03]">
          <span className="flex items-center gap-2 text-[14px] font-medium text-slate-800">
            <span className="text-lg">🇬🇧</span> United Kingdom
          </span>
          <ChevronDown size={16} className="text-slate-400" />
        </button>

        <div className="mt-3 flex items-center gap-2 rounded-2xl bg-white p-1 shadow-sm shadow-black/[0.03]">
          {(["1st Year", "Full Duration"] as const).map((d) => (
            <button
              key={d}
              onClick={() => setDuration(d)}
              className={`flex-1 rounded-xl py-2.5 text-[13px] font-medium transition ${
                duration === d ? "bg-[var(--sd-ink)] text-white" : "text-slate-500"
              }`}
            >
              {d}
            </button>
          ))}
        </div>

        <div className="mt-4 rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.03]">
          {fees.map((f) => (
            <div key={f.label} className="flex items-center justify-between py-2 text-[13px]">
              <span className="text-slate-500">{f.label}</span>
              <span className="font-medium text-slate-800">£{f.amount.toLocaleString()}</span>
            </div>
          ))}
          <div className="mt-2 flex items-center justify-between border-t border-slate-100 pt-3">
            <span className="text-[14px] font-semibold text-slate-900">Estimated Total</span>
            <span className="text-[16px] font-bold text-slate-900">£{total.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-3 rounded-2xl bg-white p-4 shadow-sm shadow-black/[0.03]">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-[13px] font-medium text-[var(--sd-teal)]">
              <CheckCircle2 size={15} /> Available Funds
            </span>
            <span className="text-[13px] font-semibold text-slate-800">£{AVAILABLE_FUNDS.toLocaleString()}</span>
          </div>
          <div className="mt-2 flex items-center justify-between">
            <span className="text-[13px] font-medium text-rose-500">Funding Gap</span>
            <span className="text-[13px] font-semibold text-rose-500">£{gap.toLocaleString()}</span>
          </div>
        </div>

        <div className="mt-3 flex items-start gap-3 rounded-2xl bg-[#E7EEFC] p-4">
          <Lightbulb size={17} className="mt-0.5 shrink-0 text-[#2955C4]" />
          <p className="text-[13px] leading-relaxed text-[#1B2C57]">
            Tip: You may be eligible for a scholarship of up to £10,000 for this program.
          </p>
        </div>
      </div>
    </div>
  );
}
