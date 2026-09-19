import { useEffect, useState } from "react";
import { ChevronDown, History } from "lucide-react";
import { fetchFinancialReadinessHistory, type FinancialReadinessHistoryEntry } from "../data/studentFinancialReadinessStore";

const FIELD_LABELS: Record<string, string> = {
  bankStatus: "Status",
  depositType: "Deposit type",
  openingDate: "Cash-in date",
  requiredAmount: "Amount",
  currency: "Currency",
  accountHolder: "Account holder",
  accountType: "Account type",
  holdingPeriodDays: "Holding period",
  maturityDate: "Maturity date",
};

function formatValue(field: string, value: string | number | null): string {
  if (value === null || value === "") return "—";
  if (field === "requiredAmount" && typeof value === "number") return value.toLocaleString();
  if (field === "holdingPeriodDays") return `${value} days`;
  return String(value);
}

/** Collapsible "Edit history" list for a student's Financial Readiness record — every save from
 * the student's own form or a counsellor's Journey panel, newest first, with who changed what.
 * Fetched on open (and re-fetched whenever `refreshKey` changes, so a save in the same view shows
 * up immediately) rather than cached, since it's only read on demand. */
export function FinancialReadinessHistory({ studentId, refreshKey = 0, tone = "slate" }: { studentId: string; refreshKey?: number; tone?: "slate" | "emerald" }) {
  const [open, setOpen] = useState(false);
  const [entries, setEntries] = useState<FinancialReadinessHistoryEntry[] | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    fetchFinancialReadinessHistory(studentId)
      .then((rows) => { if (!cancelled) setEntries(rows); })
      .catch(() => { if (!cancelled) setEntries([]); });
    return () => { cancelled = true; };
  }, [open, studentId, refreshKey]);

  const text = tone === "emerald" ? "text-emerald-700" : "text-slate-500";

  return (
    <div className="mt-2">
      <button onClick={() => setOpen((v) => !v)} className={`flex items-center gap-1 text-[11.5px] font-semibold ${text}`}>
        <History size={12} /> Edit history
        <ChevronDown size={12} className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {entries === null && <p className="text-[11.5px] text-slate-400">Loading…</p>}
          {entries?.length === 0 && <p className="text-[11.5px] text-slate-400">No changes recorded yet.</p>}
          {entries?.map((e) => (
            <div key={e.id} className="rounded-lg border border-slate-100 bg-white px-2.5 py-2">
              <p className="text-[11px] text-slate-400">
                {new Date(e.changedAt).toLocaleString()} · {e.changedBy.name} <span className="capitalize">({e.changedBy.role})</span>
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {e.changes.map((c) => (
                  <li key={c.field} className="text-[12px] text-slate-700">
                    <span className="font-medium">{FIELD_LABELS[c.field] ?? c.field}:</span>{" "}
                    <span className="text-slate-400">{formatValue(c.field, c.from)}</span> → {formatValue(c.field, c.to)}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
