import { useState } from "react";
import { CheckCircle2, Wallet } from "lucide-react";
import { FinancialReadinessHistory } from "./FinancialReadinessHistory";
import { BankAccountsEditor, BankAccountsSummary } from "./BankAccountsEditor";
import { loadFinancialReadiness } from "../data/studentFinancialReadinessStore";
import { loadBankAccounts, type BankAccount } from "../data/studentBankAccountsStore";
import { useHoldCacheSync } from "../utils/syncCache";
import type { Role } from "../types";

/** Inline Financial Readiness section for the student's own Dashboard — lives under the Current
 * Application card rather than behind a popup, since it's something every student has to fill in
 * (and can always come back and change), not a one-off action worth interrupting the page for.
 *
 * A student may hold the funds across several banks, so this lists every bank account and lets them add, edit or
 * remove any of them. The shared record per student (see studentFinancialReadinessStore.ts) keeps a combined summary
 * — names, total amount, most recent cash-in date, least-advanced status — so a counsellor's Journey panel, the
 * tasks and notifications all keep working off that; a counsellor edits the very same list. Every save from either
 * side lands in the same edit history. */
export function FinancialReadinessCard({
  studentId, onSaved,
}: {
  studentId: string;
  actor?: { id: string; role: Role; name: string };
  onSaved: () => void;
}) {
  const existing = loadFinancialReadiness(studentId);
  const isComplete = !!existing?.completedAt;
  const saved = loadBankAccounts(studentId);
  // A record saved before multiple banks existed but whose accounts haven't loaded yet still shows its one bank.
  const accounts: BankAccount[] = saved.length
    ? saved
    : existing?.bankName
      ? [{ bankName: existing.bankName, status: existing.bankStatus, depositType: existing.depositType, openingDate: existing.openingDate, amount: existing.requiredAmount, currency: existing.currency, accountHolder: existing.accountHolder, accountType: existing.accountType }]
      : [];

  // Once anything has been saved the card shows the saved information; the editor only opens on
  // an explicit Edit (or for a student who has never saved anything yet).
  const [editing, setEditing] = useState(accounts.length === 0);
  const [savedTick, setSavedTick] = useState(0);
  const [dirty, setDirty] = useState(false);

  // This card sits inline on the Dashboard, which the shell remounts on every cache change (see syncCache.ts) —
  // including the 12s background poll — so hold it while the student is actually editing, or the form would look
  // like it "closed by itself". Held only for a saved record or once something has been typed, so the untouched
  // blank form on a fresh account doesn't freeze the rest of the Dashboard.
  useHoldCacheSync(editing && (accounts.length > 0 || dirty));

  function done() {
    setDirty(false);
    setEditing(false);
    setSavedTick((t) => t + 1);
    onSaved();
  }

  if (!editing && accounts.length > 0) {
    // Solid white like the Current Application card; only the heading/icon colour says confirmed vs. in progress.
    const frame = "border-slate-100 bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]";
    const heading = isComplete ? "text-emerald-700" : "text-slate-900";
    const body = isComplete ? "text-emerald-700" : "text-slate-500";
    return (
      <div className={`mt-4 rounded-2xl border p-4 ${frame}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isComplete ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Wallet size={16} className="text-[#2955C4]" />}
            <p className={`text-sm font-semibold ${heading}`}>
              {isComplete ? "Financial Readiness confirmed" : "Financial Readiness"}
              {accounts.length > 1 && <span className={`ml-1.5 text-xs font-medium ${body}`}>· {accounts.length} banks</span>}
            </p>
          </div>
          <button onClick={() => setEditing(true)} className={`shrink-0 text-xs font-semibold underline ${body}`}>
            Edit banks
          </button>
        </div>
        <div className="mt-3"><BankAccountsSummary accounts={accounts} tone={heading} /></div>
        <FinancialReadinessHistory studentId={studentId} refreshKey={savedTick} tone={isComplete ? "emerald" : "slate"} />
      </div>
    );
  }

  return (
    <div className="mt-4 rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-rose-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900">Financial Readiness</p>
          <p className="text-xs text-slate-500">Shared across all your applications — add every bank your funds are in.</p>
        </div>
      </div>
      <div className="mt-3">
        <BankAccountsEditor
          studentId={studentId}
          initial={accounts}
          onDone={done}
          onCancel={accounts.length > 0 ? () => { setDirty(false); setEditing(false); } : undefined}
          onDirtyChange={setDirty}
        />
      </div>
    </div>
  );
}

