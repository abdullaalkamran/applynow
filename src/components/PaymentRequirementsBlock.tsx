// A university's minimum deposit, payment deadline, and deposit rules — shown on the Overview and
// Fees tabs of every role's University Detail page. Previously duplicated as a local component on
// the staff Data Management page; now shared so student/agent get the same information instead of
// only showing it via the terser depositLabel() chip.
import { CheckCircle2 } from "lucide-react";
import type { University } from "../types";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function PaymentRequirementsBlock({ university }: { university: University }) {
  const hasAny = university.minimumDepositAmount != null || !!university.paymentDeadline || (university.depositRules ?? []).length > 0;
  if (!hasAny) {
    return <p className="text-xs text-slate-400">No deposit details added yet.</p>;
  }
  return (
    <div className="space-y-2">
      {university.minimumDepositAmount != null && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-600">Minimum deposit</span>
          <span className="font-semibold text-slate-800">
            {university.depositMode === "half" && "50% of first year tuition fees"}
            {university.depositMode === "full" && "Full payment of first year tuition fees"}
            {(!university.depositMode || university.depositMode === "custom") &&
              `${university.currencySymbol}${university.minimumDepositAmount.toLocaleString()}`}
          </span>
        </div>
      )}
      {university.paymentDeadline && (
        <div className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <span className="text-slate-600">Last date of payment</span>
          <span className="font-semibold text-slate-800">{formatDate(university.paymentDeadline)}</span>
        </div>
      )}
      {(university.depositRules ?? []).map((r) => (
        <div key={r} className="flex items-start gap-2 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-emerald-500" /> {r}
        </div>
      ))}
    </div>
  );
}
