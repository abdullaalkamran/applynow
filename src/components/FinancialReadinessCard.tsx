import { useState, type ReactNode } from "react";
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

  // One large raised container; the wallet sits on its own raised tile, exactly like the other section headers.
  const shell = "mt-4 rounded-[28px] bg-[var(--sd-card)] p-4 shadow-neu min-[440px]:p-5";
  // Icon + title on one line, the subtitle underneath at full width, and the action on the right — it drops to its own
  // row on narrow phones so the title never gets squeezed into two lines.
  const header = (title: string, subtitle?: string, action?: ReactNode) => (
    <div>
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-[var(--sd-card)] text-neutral-900 shadow-neu-sm min-[440px]:h-12 min-[440px]:w-12">
          {isComplete ? <CheckCircle2 size={22} strokeWidth={1.7} /> : <Wallet size={22} strokeWidth={1.7} />}
        </span>
        <p className="min-w-0 flex-1 text-[15px] font-bold leading-tight text-neutral-900">{title}</p>
        {action && <span className="hidden shrink-0 min-[420px]:block">{action}</span>}
      </div>
      {subtitle && <p className="mt-2 text-[12.5px] leading-snug text-neutral-500">{subtitle}</p>}
      {action && <div className="mt-3 min-[420px]:hidden">{action}</div>}
    </div>
  );

  if (!editing && accounts.length > 0) {
    return (
      <div className={shell}>
        {header(
          isComplete ? "Financial Readiness confirmed" : "Financial Readiness",
          accounts.length > 1 ? `${accounts.length} banks · shared across all your applications` : "Shared across all your applications",
          <button
            onClick={() => setEditing(true)}
            className="rounded-full bg-[var(--sd-card)] px-4 py-2 text-[13px] font-semibold text-neutral-900 shadow-neu-sm transition-transform active:scale-95"
          >
            Edit banks
          </button>
        )}
        <div className="mt-4"><BankAccountsSummary accounts={accounts} tone="text-neutral-900" /></div>
        <FinancialReadinessHistory studentId={studentId} refreshKey={savedTick} tone="slate" />
      </div>
    );
  }

  return (
    <div className={shell}>
      {header("Financial Readiness")}
      <div className="mt-5">
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
