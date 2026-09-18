import { useState } from "react";
import { CheckCircle2, Wallet } from "lucide-react";
import { Button } from "./ui";
import { loadFinancialReadiness } from "../data/studentFinancialReadinessStore";
import { updateFinancialReadinessForStudent } from "../data/applicationJourneyStore";
import type { Role } from "../types";

const BANK_STATUS_OPTIONS = ["Not Started", "Preparing", "Maintaining", "Matured", "Ready"];
const ACCOUNT_HOLDER_OPTIONS = ["Student", "Mother", "Father", "Brother/Sister", "Other"];
const ACCOUNT_TYPE_OPTIONS = ["Savings", "Current", "FDR", "Other"];

/** Inline Financial Readiness section for the student's own Dashboard — lives under the Current
 * Application card rather than behind a popup, since it's something every student has to fill in
 * (and can always come back and change), not a one-off action worth interrupting the page for.
 * Reads/writes the one shared record per student (see studentFinancialReadinessStore.ts), so
 * editing it here is identical to editing it from a counsellor's Journey panel on any application —
 * same broadcast to everywhere else it shows up (see applicationJourneyStore.ts). */
export function FinancialReadinessCard({
  studentId, actor, onSaved,
}: {
  studentId: string;
  actor: { id: string; role: Role; name: string };
  onSaved: () => void;
}) {
  const existing = loadFinancialReadiness(studentId);
  const isComplete = !!existing?.completedAt;
  const [editing, setEditing] = useState(!isComplete);

  const [bankStatus, setBankStatus] = useState(existing?.bankStatus && existing.bankStatus !== "Not Required" ? existing.bankStatus : "Not Started");
  const [openingDate, setOpeningDate] = useState(existing?.openingDate ?? "");
  const [requiredAmount, setRequiredAmount] = useState(existing?.requiredAmount?.toString() ?? "");
  const [currency, setCurrency] = useState(existing?.currency ?? "USD");
  const [accountHolder, setAccountHolder] = useState(existing?.accountHolder ?? "Student");
  const [accountType, setAccountType] = useState(existing?.accountType ?? "Savings");

  function handleSubmit() {
    updateFinancialReadinessForStudent(
      studentId,
      {
        bankStatus: bankStatus as never,
        status: bankStatus,
        openingDate: openingDate || undefined,
        requiredAmount: requiredAmount ? Number(requiredAmount) : undefined,
        currency: currency || undefined,
        accountHolder: accountHolder as never,
        accountType: accountType as never,
      },
      actor
    );
    setEditing(false);
    onSaved();
  }

  if (!editing) {
    return (
      <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50/60 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <CheckCircle2 size={16} className="text-emerald-600" />
            <p className="text-sm font-semibold text-emerald-800">Financial Readiness confirmed</p>
          </div>
          <button onClick={() => setEditing(true)} className="shrink-0 text-xs font-semibold text-emerald-700 underline">
            Edit
          </button>
        </div>
        <p className="mt-1 text-xs text-emerald-700">
          {existing?.bankStatus}
          {existing?.currency && existing?.requiredAmount ? ` · ${existing.currency} ${existing.requiredAmount.toLocaleString()}` : ""}
          {existing?.openingDate ? ` · opened ${existing.openingDate}` : ""}
        </p>
      </div>
    );
  }

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
          <select
            value={bankStatus}
            onChange={(e) => setBankStatus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {BANK_STATUS_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Account opened on
          <input
            type="date"
            value={openingDate}
            onChange={(e) => setOpeningDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Amount held
          <input
            type="number"
            value={requiredAmount}
            onChange={(e) => setRequiredAmount(e.target.value)}
            placeholder="e.g. 25000"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Currency
          <input
            value={currency}
            onChange={(e) => setCurrency(e.target.value)}
            placeholder="e.g. USD"
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Account holder
          <select
            value={accountHolder}
            onChange={(e) => setAccountHolder(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {ACCOUNT_HOLDER_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Account type
          <select
            value={accountType}
            onChange={(e) => setAccountType(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
          >
            {ACCOUNT_TYPE_OPTIONS.map((o) => <option key={o} value={o}>{o}</option>)}
          </select>
        </label>
      </div>

      <div className="mt-3 flex justify-end gap-2">
        {isComplete && (
          <Button variant="secondary" onClick={() => setEditing(false)}>Cancel</Button>
        )}
        <Button onClick={handleSubmit}>Save</Button>
      </div>
    </div>
  );
}
