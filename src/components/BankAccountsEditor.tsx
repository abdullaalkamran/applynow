import { useState } from "react";
import { Landmark, Plus, Trash2 } from "lucide-react";
import { DEPOSIT_TYPES } from "../types/journey";
import { daysHeldLabel } from "../utils/financialReadiness";
import { saveBankAccounts, type BankAccount } from "../data/studentBankAccountsStore";
import { useRole } from "../context/RoleContext";
import { NeuSelect } from "./ui/NeuSelect";

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
// Matured and Ready are the counsellor's call (Matured also happens by itself on the maturity date they pick).
const COUNSELLOR_ONLY_STATUSES = new Set(["Matured", "Ready"]);
const ACCOUNT_HOLDER_OPTIONS = ["Student", "Mother", "Father", "Brother/Sister", "Other"];
const ACCOUNT_TYPE_OPTIONS = ["Savings", "Current", "FDR", "Other"];

const bankStatusLabel = (value: string | undefined) => BANK_STATUS_OPTIONS.find((o) => o.value === value)?.label ?? value ?? "—";

const blankAccount = (): BankAccount => ({ bankName: "", status: "Not Started", depositType: DEPOSIT_TYPES[0], accountHolder: "Student", accountType: "Savings", currency: BANK_CURRENCY });

// Recessed (inset) fields — spelled out here so they also look right in the counsellor panel, which isn't inside the
// student theme wrapper.
// Type sizes use clamp() on the viewport width so they scale smoothly between small phones and tablets, instead of jumping
// between fixed steps.
const INPUT = "mt-1.5 w-full min-w-0 rounded-2xl border border-transparent bg-[var(--sd-card)] px-3.5 py-2.5 text-[13px] text-neutral-900 shadow-neu-inset outline-none transition-shadow placeholder:text-neutral-400 focus:bg-[#ebebeb] min-[440px]:px-4 min-[440px]:py-3";
const LABEL = "block text-[12.5px] font-semibold text-neutral-700";

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
  const { role } = useRole();
  const isCounsellor = role === "counsellor" || role === "admin";
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
        maturityDate: isCounsellor && (a.status === "Maintaining" || a.status === "Matured") ? a.maturityDate || undefined : undefined,
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
      <div className="space-y-4">
        {accounts.map((a, i) => {
          const showDetails = HOLDING_STATUSES.has(a.status);
          const held = showDetails ? daysHeldLabel(a.openingDate) : null;
          return (
            <div key={a.id ?? `new-${i}`} className="rounded-3xl bg-[var(--sd-card)] p-3.5 shadow-neu min-[440px]:p-4">
              <div className="flex items-center justify-between">
                <p className="text-[14px] font-bold text-neutral-900">Bank {i + 1}</p>
                {accounts.length > 1 && (
                  <button
                    type="button"
                    onClick={() => remove(i)}
                    aria-label={`Remove bank ${i + 1}`}
                    className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-900 shadow-neu-sm transition-transform active:scale-95 min-[440px]:h-10 min-[440px]:w-10"
                  >
                    <Trash2 size={16} />
                  </button>
                )}
              </div>
              <div className="mt-3 grid grid-cols-1 gap-3.5 min-[440px]:grid-cols-2 min-[440px]:gap-4">
                <label className={`min-[440px]:col-span-2 ${LABEL}`}>
                  Bank name
                  <span className="relative block">
                    <Landmark size={18} className="pointer-events-none absolute left-4 top-1/2 mt-[3px] -translate-y-1/2 text-neutral-900" />
                    <input type="text" value={a.bankName} onChange={(e) => change(i, { bankName: e.target.value })} placeholder="e.g. Islami Bank Bangladesh" className={`${INPUT} pl-11 min-[440px]:pl-11`} />
                  </span>
                </label>
                <label className={`min-[440px]:col-span-2 ${LABEL}`}>
                  Account status
                  <span className="mt-1.5 block">
                    <NeuSelect
                      value={a.status}
                      onChange={(e) => change(i, { status: e.target.value })}
                      disabled={!isCounsellor && COUNSELLOR_ONLY_STATUSES.has(a.status)}
                      startAdornment={<span className="h-3 w-3 shrink-0 rounded-full bg-neutral-700 shadow-neu-sm" />}
                    >
                      {BANK_STATUS_OPTIONS.filter((o) => isCounsellor || !COUNSELLOR_ONLY_STATUSES.has(o.value) || o.value === a.status).map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </NeuSelect>
                  </span>
                </label>
                {!isCounsellor && COUNSELLOR_ONLY_STATUSES.has(a.status) && (
                  <p className="text-[11px] text-neutral-500 min-[440px]:col-span-2">This stage is set by your counsellor.</p>
                )}
                {a.status === "Maintaining" && a.bankName.trim() && (
                  <p className="text-[11px] leading-snug text-neutral-600 min-[440px]:col-span-2">
                    The Bank Statement and Solvency Certificate for {a.bankName.trim()} are now on your required documents.
                  </p>
                )}
                {isCounsellor && (a.status === "Maintaining" || a.status === "Matured") && (
                  <label className={`min-[440px]:col-span-2 ${LABEL}`}>
                    Matures on
                    <input type="date" value={a.maturityDate ?? ""} onChange={(e) => change(i, { maturityDate: e.target.value })} className={INPUT} />
                    <span className="mt-1 block text-[11px] font-normal text-neutral-500">The account shows as Matured automatically once this date arrives.</span>
                  </label>
                )}
                {showDetails && (
                  <>
                    <label className={LABEL}>
                      Deposit type
                      <NeuSelect value={a.depositType ?? DEPOSIT_TYPES[0]} onChange={(e) => change(i, { depositType: e.target.value })} className={INPUT}>
                        {DEPOSIT_TYPES.map((o) => <option key={o} value={o}>{o}</option>)}
                      </NeuSelect>
                    </label>
                    <label className={LABEL}>
                      Opening / cash-in date
                      <input type="date" value={a.openingDate ?? ""} onChange={(e) => change(i, { openingDate: e.target.value })} className={INPUT} />
                    </label>
                    <label className={LABEL}>
                      Amount in {BANK_CURRENCY}
                      <input type="number" min={0} value={a.amount ?? ""} onChange={(e) => change(i, { amount: e.target.value === "" ? undefined : Number(e.target.value) })} placeholder="e.g. 2500000" className={INPUT} />
                    </label>
                    <label className={LABEL}>
                      Account holder
                      <NeuSelect value={a.accountHolder ?? "Student"} onChange={(e) => change(i, { accountHolder: e.target.value })} className={INPUT}>
                        {ACCOUNT_HOLDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </NeuSelect>
                    </label>
                    <label className={LABEL}>
                      Account type
                      <NeuSelect value={a.accountType ?? "Savings"} onChange={(e) => change(i, { accountType: e.target.value })} className={INPUT}>
                        {ACCOUNT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
                      </NeuSelect>
                    </label>
                  </>
                )}
              </div>
              {held && <p className="mt-3 text-xs font-medium text-neutral-600">{held}</p>}
              {needsDetails(a) && <p className="mt-3 text-[12px] font-medium text-neutral-900">Enter the cash-in date and amount for this bank.</p>}
            </div>
          );
        })}
      </div>

      {error && <p className="mt-3 text-xs font-medium text-neutral-900">{error}</p>}
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 min-[440px]:mt-5">
        <button
          type="button"
          onClick={add}
          className="inline-flex items-center gap-2.5 rounded-full bg-[var(--sd-card)] py-1.5 pl-1.5 pr-5 text-[14px] font-semibold text-neutral-900 shadow-neu transition-transform active:scale-[0.98]"
        >
          <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] shadow-neu-sm"><Plus size={16} /></span>
          Add another bank
        </button>
        <div className="ml-auto flex items-center gap-3">
          {onCancel && (
            <button type="button" onClick={onCancel} className="rounded-full bg-[var(--sd-card)] px-5 py-2.5 text-[14px] font-semibold text-neutral-700 shadow-neu-sm transition-transform active:scale-[0.97]">
              Cancel
            </button>
          )}
          <button
            type="button"
            onClick={save}
            disabled={!canSave}
            className="rounded-full bg-neutral-900 px-7 py-3 text-[14px] min-[440px]:px-9 min-[440px]:py-3.5 font-semibold text-white shadow-neu-dark transition-transform active:scale-[0.97] disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? "Saving…" : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}

/** Read-only list of the saved accounts, with the combined total — used by the card and the counsellor panel. */
export function BankAccountsSummary({ accounts, tone = "text-slate-700" }: { accounts: BankAccount[]; tone?: string }) {
  const total = accounts.filter((a) => HOLDING_STATUSES.has(a.status)).reduce((sum, a) => sum + (a.amount || 0), 0);
  return (
    <div className="space-y-2.5">
      {accounts.map((a, i) => {
        const holding = HOLDING_STATUSES.has(a.status);
        const held = holding ? daysHeldLabel(a.openingDate) : null;
        const details: [string, string | undefined][] = holding
          ? [["Deposit", a.depositType], ["Account", a.accountType], ["Holder", a.accountHolder], ["Cash-in", a.openingDate], ...(a.status === "Maintaining" && a.maturityDate ? ([["Matures", a.maturityDate]] as [string, string][]) : [])]
          : [];
        return (
          <div key={a.id ?? i} className="rounded-2xl bg-[var(--sd-card)] p-3.5 shadow-neu-inset-sm">
            <div className="flex items-start justify-between gap-3">
              <p className={`min-w-0 text-[14px] font-bold leading-snug ${tone}`}>{a.bankName}</p>
              <span className="shrink-0 rounded-full bg-[var(--sd-card)] px-2.5 py-1 text-[11px] font-semibold text-neutral-700 shadow-neu-sm">{bankStatusLabel(a.status)}</span>
            </div>
            {holding && a.amount ? (
              <p className={`mt-1.5 text-[15px] font-bold tracking-tight ${tone}`}>{BANK_CURRENCY} {a.amount.toLocaleString()}</p>
            ) : null}
            {details.some(([, v]) => v) && (
              <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-1.5 text-[11px]">
                {details.filter(([, v]) => v).map(([k, v]) => (
                  <div key={k} className="min-w-0">
                    <dt className="text-neutral-500">{k}</dt>
                    <dd className="truncate font-medium text-neutral-800">{v}</dd>
                  </div>
                ))}
              </dl>
            )}
            {held && <p className="mt-2 text-[11px] font-medium text-neutral-600">{held}</p>}
          </div>
        );
      })}
      {accounts.length > 1 && total > 0 && (
        <p className={`pt-0.5 text-right text-[13px] font-semibold ${tone}`}>Total held: {BANK_CURRENCY} {total.toLocaleString()}</p>
      )}
    </div>
  );
}
