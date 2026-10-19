// "Cost Before Visa" and "Bank Statement" tables for a country that has visa costs configured (see countryRegistry.ts
// VisaCostConfig, modeled on the UK Student visa). Every row shows the amount in the course's currency and in the student's home
// currency, and every figure comes from costModel.ts so these tables always match the Estimated Total below them.
import type { ReactNode } from "react";
import type { CostModel } from "../utils/costModel";

const fmt = (n: number) => Math.round(n).toLocaleString();

interface Cols { currency: string; local?: string; rate?: number }

function Head({ cols }: { cols: Cols }) {
  return (
    <div className={`grid items-end gap-2 border-b border-neutral-300/50 pb-1.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400 ${cols.local ? "grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]" : "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"}`}>
      <span>Item</span>
      <span className="text-right">{cols.currency.trim()}</span>
      {cols.local && <span className="text-right">{cols.local}</span>}
    </div>
  );
}

function GroupLabel({ children }: { children: ReactNode }) {
  return <p className="pt-3 pb-0.5 text-[10.5px] font-semibold uppercase tracking-wide text-neutral-400">{children}</p>;
}

function Row({ label, note, foreign, local, cols }: { label: string; note?: string; foreign: number | null; local?: number | null; cols: Cols }) {
  const localValue = local ?? (foreign !== null && cols.rate ? foreign * cols.rate : null);
  return (
    <div className={`grid items-start gap-2 border-b border-neutral-200/60 py-2 text-[12.5px] last:border-b-0 ${cols.local ? "grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]" : "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"}`}>
      <span className="min-w-0">
        <span className="block font-medium leading-snug text-neutral-800">{label}</span>
        {note && <span className="mt-0.5 block text-[10.5px] leading-snug text-neutral-400">{note}</span>}
      </span>
      <span className="text-right font-medium tabular-nums text-neutral-800">{foreign !== null ? `${cols.currency}${fmt(foreign)}` : "—"}</span>
      {cols.local && <span className="text-right font-medium tabular-nums text-neutral-800">{localValue !== null ? fmt(localValue) : "—"}</span>}
    </div>
  );
}

function Total({ label, note, foreign, cols }: { label: string; note?: string; foreign: number | null; cols: Cols }) {
  return (
    <div className={`mt-2 grid items-center gap-2 rounded-xl bg-[var(--sd-card)] px-3 py-2.5 shadow-neu-inset-sm ${cols.local ? "grid-cols-[minmax(0,1.5fr)_minmax(0,0.9fr)_minmax(0,1.1fr)]" : "grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]"}`}>
      <span className="min-w-0">
        <span className="block text-[12.5px] font-semibold leading-snug text-neutral-900">{label}</span>
        {note && <span className="mt-0.5 block text-[10.5px] font-normal leading-snug text-neutral-500">{note}</span>}
      </span>
      <span className="text-right text-[12.5px] font-bold tabular-nums text-neutral-900">{foreign !== null ? `${cols.currency}${fmt(foreign)}` : "—"}</span>
      {cols.local && <span className="text-right text-[12.5px] font-bold tabular-nums text-neutral-900">{foreign !== null && cols.rate ? fmt(foreign * cols.rate) : "—"}</span>}
    </div>
  );
}

export function VisaCostBreakdown({ model, depositInput, onDepositChange }: { model: CostModel; depositInput: string; onDepositChange: (value: string) => void }) {
  const typed = depositInput.trim() === "" ? null : Number(depositInput);
  const tooLow = typed !== null && Number.isFinite(typed) && typed < model.requiredDeposit;
  const cols: Cols = { currency: model.currency, local: model.localName && model.rate ? model.localName : undefined, rate: model.rate };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-neu">
        <p className="text-[13.5px] font-semibold text-neutral-900">Cost Before Visa</p>
        <p className="mb-2 mt-0.5 text-[11px] text-neutral-500">What you pay before your visa is granted.</p>
        <Head cols={cols} />

        <GroupLabel>Paid to the university and the visa authority</GroupLabel>
        <Row label="Tuition deposit" note={`Required by the university: ${model.currency}${fmt(model.requiredDeposit)} (${model.depositRule})`} foreign={model.casDeposit} cols={cols} />
        {model.ihs && <Row label="Immigration Health Surcharge (IHS)" note={model.ihs.note} foreign={model.ihs.amount} cols={cols} />}
        <Row label="Visa application fee" foreign={model.visaFee} cols={cols} />

        {(model.medical || model.airTicket) && <GroupLabel>Paid at home</GroupLabel>}
        {model.medical && <Row label="Medical test (TB)" note="Required for the visa" foreign={model.medical.foreign} local={model.medical.local} cols={cols} />}
        {model.airTicket && <Row label="Air ticket" note="One way, estimate" foreign={model.airTicket.foreign} local={model.airTicket.local} cols={cols} />}

        <Total label="Total before visa" foreign={model.beforeVisaForeign} cols={cols} />

        <div className="mt-3">
          <label className="block text-[11.5px] font-medium text-neutral-500" htmlFor="deposit-input">Your deposit (optional)</label>
          <input
            id="deposit-input"
            type="number"
            min={model.requiredDeposit}
            inputMode="decimal"
            value={depositInput}
            onChange={(e) => onDepositChange(e.target.value)}
            onBlur={() => { if (tooLow) onDepositChange(""); }}
            placeholder={`${model.currency}${fmt(model.requiredDeposit)} (required minimum)`}
            aria-invalid={tooLow}
            className={`mt-1 w-full rounded-xl bg-[var(--sd-card)] px-3.5 py-3 text-[13px] text-neutral-800 shadow-neu-inset focus:outline-none ${tooLow ? "ring-1 ring-red-300" : ""}`}
          />
          <p className={`mt-1 text-[10.5px] leading-snug ${tooLow ? "text-red-500" : "text-neutral-400"}`}>
            {tooLow
              ? `The deposit can't be less than the university's required ${model.currency}${fmt(model.requiredDeposit)} — the required amount is being used.`
              : "Want to pay more than the minimum? Enter your amount. It can't be less than the required deposit."}
          </p>
        </div>
      </div>

      <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-neu">
        <p className="text-[13.5px] font-semibold text-neutral-900">Bank Statement</p>
        <p className="mb-2 mt-0.5 text-[11px] text-neutral-500">The money you must show for your visa application.</p>
        <Head cols={cols} />
        <Row label="Tuition fee still to pay" note="First-year tuition less the deposit" foreign={model.tuitionDue} cols={cols} />
        {model.living && <Row label="Living costs" note={model.living.note} foreign={model.living.amount} cols={cols} />}
        <Total label="Show in your account" note="Held for 28 days in a row" foreign={model.bankForeign} cols={cols} />
      </div>
    </div>
  );
}
