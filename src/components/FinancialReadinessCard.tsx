import { useState } from "react";
import { CheckCircle2, Wallet, CalendarClock } from "lucide-react";
import { Button } from "./ui";
import { FinancialReadinessHistory } from "./FinancialReadinessHistory";
import { loadFinancialReadiness } from "../data/studentFinancialReadinessStore";
import { updateFinancialReadinessForStudent } from "../data/applicationJourneyStore";
import { useHoldCacheSync } from "../utils/syncCache";
import { daysHeldLabel } from "../utils/financialReadiness";
import { DEPOSIT_TYPES } from "../types/journey";
import type { Role } from "../types";

// Students in this flow hold the funds in a Bangladeshi bank, so the amount is always BDT — no
// free-text currency field to get wrong.
const CURRENCY = "BDT";

const BANK_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "Not Started", label: "Not Opened" },
  { value: "Preparing", label: "Preparing" },
  { value: "Maintaining", label: "Maintaining" },
  { value: "Matured", label: "Matured" },
  { value: "Ready", label: "Ready" },
];
// Only once money is actually in an account (Maintaining onwards) is there a deposit, a date, an
// amount, a holder or an account type to record — "Not Opened"/"Preparing" are just the status.
const DETAIL_STATUSES = new Set(["Maintaining", "Matured", "Ready"]);
const ACCOUNT_HOLDER_OPTIONS = ["Student", "Mother", "Father", "Brother/Sister", "Other"];
const ACCOUNT_TYPE_OPTIONS = ["Savings", "Current", "FDR", "Other"];

const statusLabel = (value: string | undefined) => BANK_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value ?? "—";

/** Inline Financial Readiness section for the student's own Dashboard — lives under the Current
 * Application card rather than behind a popup, since it's something every student has to fill in
 * (and can always come back and change), not a one-off action worth interrupting the page for.
 * Reads/writes the one shared record per student (see studentFinancialReadinessStore.ts), so
 * editing it here is identical to editing it from a counsellor's Journey panel on any application —
 * same broadcast to everywhere else it shows up (see applicationJourneyStore.ts), and every save
 * from either side lands in the same edit history. */
export function FinancialReadinessCard({
  studentId, actor, onSaved,
}: {
  studentId: string;
  actor: { id: string; role: Role; name: string };
  onSaved: () => void;
}) {
  const existing = loadFinancialReadiness(studentId);
  const isComplete = !!existing?.completedAt;
  // Once anything has been saved the card shows the saved information; the form only opens on
  // an explicit Edit (or for a student who has never saved anything yet).
  const [editing, setEditing] = useState(!existing);
  const [savedTick, setSavedTick] = useState(0);

  const [bankStatus, setBankStatus] = useState(existing?.bankStatus && existing.bankStatus !== "Not Required" ? existing.bankStatus : "Not Started");
  const [bankName, setBankName] = useState(existing?.bankName ?? "");
  const [depositType, setDepositType] = useState(existing?.depositType ?? DEPOSIT_TYPES[0]);
  const [openingDate, setOpeningDate] = useState(existing?.openingDate ?? "");
  const [requiredAmount, setRequiredAmount] = useState(existing?.requiredAmount?.toString() ?? "");
  const [accountHolder, setAccountHolder] = useState(existing?.accountHolder ?? "Student");
  const [accountType, setAccountType] = useState(existing?.accountType ?? "Savings");
  const [dirty, setDirty] = useState(false);

  // This card sits inline on the Dashboard, which the shell remounts on every cache change (see
  // syncCache.ts) — including the 12s background poll. Without a hold, that reset `editing` and
  // every field mid-edit, so the form looked like it "closed by itself". Hold only while the
  // student is actually in the form (opened it on a saved record, or has typed something), so
  // the untouched blank form on a fresh account doesn't freeze the rest of the Dashboard.
  useHoldCacheSync(editing && (!!existing || dirty));

  function field<T>(setter: (v: T) => void) {
    return (v: T) => {
      setter(v);
      setDirty(true);
    };
  }
  const changeBankStatus = field(setBankStatus);
  const changeBankName = field(setBankName);
  const changeDepositType = field(setDepositType);
  const changeOpeningDate = field(setOpeningDate);
  const changeRequiredAmount = field(setRequiredAmount);
  const changeAccountHolder = field(setAccountHolder);
  const changeAccountType = field(setAccountType);

  const showDetails = DETAIL_STATUSES.has(bankStatus);
  const detailsMissing = showDetails && (!openingDate || !requiredAmount);
  const liveDaysHeld = showDetails ? daysHeldLabel(openingDate) : null;

  function closeForm() {
    setDirty(false);
    setEditing(false);
  }

  function handleSubmit() {
    if (detailsMissing) return;
    updateFinancialReadinessForStudent(
      studentId,
      {
        bankStatus: bankStatus as never,
        status: bankStatus,
        // Details only travel with a status that has them; for Not Opened/Preparing the hidden
        // fields are left untouched server-side rather than wiped, so switching back later
        // restores what was entered.
        ...(showDetails
          ? {
              bankName,
              depositType: depositType as never,
              openingDate,
              requiredAmount: Number(requiredAmount),
              currency: CURRENCY,
              accountHolder: accountHolder as never,
              accountType: accountType as never,
            }
          : {}),
      },
      actor
    );
    setSavedTick((t) => t + 1);
    closeForm();
    onSaved();
  }

  if (!editing && existing) {
    const savedDetails = DETAIL_STATUSES.has(existing.bankStatus);
    const savedDaysHeld = savedDetails ? daysHeldLabel(existing.openingDate) : null;
    const frame = isComplete ? "border-emerald-200 bg-emerald-50/60" : "border-[#B9D4FA] bg-[#EEF4FE]";
    const heading = isComplete ? "text-emerald-800" : "text-[#1B2C57]";
    const body = isComplete ? "text-emerald-700" : "text-[#3A4B76]";
    const rows: [string, string][] = [
      ["Status", statusLabel(existing.bankStatus)],
      ...(savedDetails
        ? ([
            ["Bank name", existing.bankName ?? "—"],
            ["Deposit type", existing.depositType ?? "—"],
            ["Cash-in date", existing.openingDate ?? "—"],
            [`Amount (${CURRENCY})`, existing.requiredAmount ? existing.requiredAmount.toLocaleString() : "—"],
            ["Account holder", existing.accountHolder ?? "—"],
            ["Account type", existing.accountType ?? "—"],
          ] as [string, string][])
        : []),
    ];
    return (
      <div className={`mt-4 rounded-2xl border p-4 ${frame}`}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {isComplete ? <CheckCircle2 size={16} className="text-emerald-600" /> : <Wallet size={16} className="text-[#2955C4]" />}
            <p className={`text-sm font-semibold ${heading}`}>{isComplete ? "Financial Readiness confirmed" : "Financial Readiness"}</p>
          </div>
          <button onClick={() => setEditing(true)} className={`shrink-0 text-xs font-semibold underline ${body}`}>
            Edit
          </button>
        </div>
        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1">
          {rows.map(([label, value]) => (
            <div key={label} className="flex items-baseline justify-between gap-2 border-b border-black/5 py-1 last:border-0">
              <dt className={`text-[11.5px] ${body}`}>{label}</dt>
              <dd className={`text-right text-[12.5px] font-medium ${heading}`}>{value}</dd>
            </div>
          ))}
        </dl>
        {savedDaysHeld && (
          <p className={`mt-2 flex items-center gap-1 text-xs font-medium ${body}`}>
            <CalendarClock size={12} /> {savedDaysHeld}
          </p>
        )}
        <FinancialReadinessHistory studentId={studentId} refreshKey={savedTick} tone={isComplete ? "emerald" : "slate"} />
      </div>
    );
  }

  const inputClass = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";

  return (
    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50/40 p-4">
      <div className="flex items-center gap-2">
        <Wallet size={16} className="text-rose-600" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-rose-800">Financial Readiness</p>
          <p className="text-xs text-rose-600">Shared across all your applications — fill it in once.</p>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-2 gap-3">
        <label className="block text-xs font-medium text-slate-500">
          Bank account status
          <select value={bankStatus} onChange={(e) => changeBankStatus(e.target.value)} className={inputClass}>
            {BANK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </label>

        {showDetails && (
          <>
            <label className="block text-xs font-medium text-slate-500">
              Bank name
              <input
                type="text"
                value={bankName}
                onChange={(e) => changeBankName(e.target.value)}
                placeholder="e.g. Islami Bank Bangladesh"
                className={inputClass}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Deposit type
              <select value={depositType} onChange={(e) => changeDepositType(e.target.value)} className={inputClass}>
                {DEPOSIT_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Account opening / cash-in date
              <input type="date" value={openingDate} onChange={(e) => changeOpeningDate(e.target.value)} className={inputClass} />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Amount in {CURRENCY}
              <input
                type="number"
                min={0}
                value={requiredAmount}
                onChange={(e) => changeRequiredAmount(e.target.value)}
                placeholder="e.g. 2500000"
                className={inputClass}
              />
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Account holder
              <select value={accountHolder} onChange={(e) => changeAccountHolder(e.target.value)} className={inputClass}>
                {ACCOUNT_HOLDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
            <label className="block text-xs font-medium text-slate-500">
              Account type
              <select value={accountType} onChange={(e) => changeAccountType(e.target.value)} className={inputClass}>
                {ACCOUNT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
              </select>
            </label>
          </>
        )}
      </div>

      {liveDaysHeld && (
        <p className="mt-2.5 flex items-center gap-1.5 text-xs font-medium text-slate-600">
          <CalendarClock size={13} className="text-slate-400" /> {liveDaysHeld}
        </p>
      )}

      <div className="mt-3 flex items-center justify-end gap-2">
        {detailsMissing && <p className="mr-auto text-[11.5px] text-rose-600">Enter the cash-in date and amount to save.</p>}
        {existing && (
          <Button variant="secondary" onClick={closeForm}>Cancel</Button>
        )}
        <Button onClick={handleSubmit} disabled={detailsMissing}>Save</Button>
      </div>
    </div>
  );
}
