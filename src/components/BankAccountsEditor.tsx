import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "./ui";
import { DEPOSIT_TYPES } from "../types/journey";
import { daysHeldLabel } from "../utils/financialReadiness";
import { saveBankAccounts, type BankAccount } from "../data/studentBankAccountsStore";

// Students in this flow hold the funds in a Bangladeshi bank, so the amount is always BDT.
const BANK_CURRENCY = "BDT";

const BANK_STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: "Not Started", label: "Not Opened" },
  { value: "Preparing", label: "Preparing" },
  { value: "Maintaining", label: "Maintaining" },
  { value: "Matured", label: "Matured" },
  { value: "Ready", label: "Ready" },
];
// Only once money is actually in an account (Maintaining onwards) is there a deposit, date, amount, holder or type.
const HOLDING_STATUSES = new Set(["Maintaining", "Matured", "Ready"]);
const ACCOUNT_HOLDER_OPTIONS = ["Student", "Mother", "Father", "Brother/Sister", "Other"];
const ACCOUNT_TYPE_OPTIONS = ["Savings", "Current", "FDR", "Other"];

const bankStatusLabel = (value: string | undefined) => BANK_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value ?? "—";

const blankAccount = (): BankAccount => ({ bankName: "", status: "Not Started", depositType: DEPOSIT_TYPES[0], accountHolder: "Student", accountType: "Savings", currency: BANK_CURRENCY });

const INPUT = "mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800";

const needsDetails = (a: BankAccount) => HOLDING_STATUSES.has(a.status) && (!a.openingDate || !a.amount);
const isValid = (a: BankAccount) => !!a.bankName.trim() && !needsDetails(a);

/** Add / edit / remove the student's bank accounts — shared by the student's Dashboard card and the counsellor's
 * Journey panel, so both see and edit the same list. Saves the whole list at once. */
export function BankAccountsEditor({
  studentId, initial, onDone, onCancel, onDirtyChange,
}: {
  studentId: string;
  initial: BankAccount[];
  onDone: () => void;
  onCancel?: () => void;
  onDirtyChange?: (dirty: boolean) => void;
}) {
  const [accounts, setAccounts] = useState<BankAccount[]>(initial.length ? initial : [blankAccount()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  function change(index: number, patch: Partial<BankAccount>) {
    setAccounts((list) => list.map((a, i) => (i === index ? { ...a, ...patch } : a)));
    onDirtyChange?.(true);
  }
  function add() { setAccounts((list) => [...list, blankAccount()]); onDirtyChange?.(true); }
  function remove(index: number) { setAccounts((list) => list.filter((_, i) => i !== index)); onDirtyChange?.(true); }

  const canSave = accounts.length > 0 && accounts.every(isValid) && !saving;

  async function save() {
    if (!canSave) return;
    setSaving(true);
    setError("");
    try {
      await saveBankAccounts(studentId, accounts.map((a) => ({
        ...a,
        bankName: a.bankName.trim(),
        // Details only travel with a status that has them.
        ...(HOLDING_STATUSES.has(a.status) ? { currency: BANK_CURRENCY } : { openingDate: undefined, amount: undefined }),
      })));
      onDirtyChange?.(false);
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't save the bank accounts.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      <div className="space-y-3">
        {accounts.map((a, i) => {
          const showDetails = HOLDING_STATUSES.has(a.status);
          const held = showDetails ? daysHeldLabel(a.openingDate) : null;
          return (
            <div key={a.id ?? `new-${i}`} className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-slate-600">Bank {i + 1}</p>
                {accounts.length > 1 && (
                  <button type="button" onClick={() => remove(i)} aria-label={`Remove bank ${i + 1}`} className="text-slate-400 hover:text-rose-600"><Trash2 size={14} /></button>
                )}
              </div>
              <div className="mt-2 grid grid-cols-2 gap-3">
                <label className="col-span-2 block text-xs font-medium text-slate-500 sm:col-span-1">
                  Bank name
                  <input type="text" value={a.bankName} onChange={(e) => change(i, { bankName: e.target.value })} placeholder="e.g. Islami Bank Bangladesh" className={INPUT} />
                </label>
                <label className="col-span-2 block text-xs font-medium text-slate-500 sm:col-span-1">
                  Account status
                  <select value={a.status} onChange={(e) => change(i, { status: e.target.value })} className={INPUT}>
                    {BANK_STATUS_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </label>
                {showDetails && (
                  <>
                    <label className="block text-xs font-medium text-slate-500">
                      Deposit type
                      <select value={a.depositType ?? DEPOSIT_TYPES[0]} onChange={(e) => change(i, { depositType: e.target.value })} className={INPUT}>
                        {DEPOSIT_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-slate-500">
                      Opening / cash-in date
                      <input type="date" value={a.openingDate ?? ""} onChange={(e) => change(i, { openingDate: e.target.value })} className={INPUT} />
                    </label>
                    <label className="block text-xs font-medium text-slate-500">
                      Amount in {BANK_CURRENCY}
                      <input type="number" min={0} value={a.amount ?? ""} onChange={(e) => change(i, { amount: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="e.g. 2500000" className={INPUT} />
                    </label>
                    <label className="block text-xs font-medium text-slate-500">
                      Account holder
                      <select value={a.accountHolder ?? "Student"} onChange={(e) => change(i, { accountHolder: e.target.value })} className={INPUT}>
                        {ACCOUNT_HOLDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                    <label className="block text-xs font-medium text-slate-500">
                      Account type
                      <select value={a.accountType ?? "Savings"} onChange={(e) => change(i, { accountType: e.target.value })} className={INPUT}>
                        {ACCOUNT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </select>
                    </label>
                  </>
                )}
              </div>
              {held && <p className="mt-2 text-xs font-medium text-slate-600">{held}</p>}
              {needsDetails(a) && <p className="mt-2 text-[11.5px] text-rose-600">Enter the cash-in date and amount for this bank.</p>}
            </div>
          );
        })}
      </div>

      <button type="button" onClick={add} className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-600)]">
        <Plus size={13} /> Add another bank
      </button>

      {error && <p className="mt-2 text-xs text-rose-600">{error}</p>}
      <div className="mt-3 flex items-center justify-end gap-2">
        {onCancel && <Button variant="secondary" onClick={onCancel}>Cancel</Button>}
        <Button onClick={save} disabled={!canSave}>{saving ? "Saving…" : "Save"}</Button>
      </div>
    </div>
  );
}

/** Read-only list of the saved accounts, with the combined total — used by the card and the counsellor panel. */
export function BankAccountsSummary({ accounts, tone = "text-slate-700" }: { accounts: BankAccount[]; tone?: string }) {
  const total = accounts.filter((a) => HOLDING_STATUSES.has(a.status)).reduce((sum, a) => sum + (a.amount || 0), 0);
  return (
    <div className="space-y-2">
      {accounts.map((a, i) => (
        <div key={a.id ?? i} className="rounded-lg border border-slate-100 bg-slate-50 p-2.5">
          <div className="flex items-baseline justify-between gap-2">
            <p className={`text-[12.5px] font-semibold ${tone}`}>{a.bankName}</p>
            <p className={`text-[11.5px] ${tone}`}>{bankStatusLabel(a.status)}</p>
          </div>
          {HOLDING_STATUSES.has(a.status) && (
            <p className={`mt-0.5 text-[11.5px] opacity-80 ${tone}`}>
              {[a.amount ? `${BANK_CURRENCY} ${a.amount.toLocaleString()}` : null, a.depositType, a.accountType, a.accountHolder ? `held by ${a.accountHolder}` : null, a.openingDate ? `cash-in ${a.openingDate}` : null, daysHeldLabel(a.openingDate)].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
      ))}
      {accounts.length > 1 && total > 0 && <p className={`text-right text-[12px] font-semibold ${tone}`}>Total held: {BANK_CURRENCY} {total.toLocaleString()}</p>}
    </div>
  );
}
