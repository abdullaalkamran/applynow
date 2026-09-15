// Real visa/immigration financial-planning breakdown — modeled directly on a UK Student visa cost
// sheet (CAS deposit, Immigration Health Surcharge, visa fee, TB test, air-ticket, then the
// separate bank-statement/proof-of-funds requirement), configured per country via
// countryRegistry.ts's VisaCostConfig and shown alongside CostCalculator on the Fees tab. Every
// figure is computed live off the actual university's tuition fee and course duration — nothing
// here is a static screenshot of one example.
import type { University } from "../types";
import type { VisaCostConfig } from "../data/countryRegistry";
import { durationYears } from "./CostCalculator";

type Course = University["courses"][number];

function Row({ label, note, foreign, local, currency, localCurrency }: { label: string; note?: string; foreign?: number; local?: number; currency: string; localCurrency: string }) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 py-1.5 text-[12.5px]">
      <span className="text-slate-600">
        {label}
        {note && <span className="ml-1 text-[11px] text-slate-400">({note})</span>}
      </span>
      <span className="text-right font-medium text-slate-800">{foreign != null ? `${currency}${foreign.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""}</span>
      <span className="text-right font-medium text-slate-800">{local != null ? `${localCurrency} ${local.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""}</span>
    </div>
  );
}

export function VisaCostBreakdown({ university, course, config }: { university: University; course?: Course; config: VisaCostConfig }) {
  const currency = university.currencySymbol;
  const local = config.localCurrencyName;
  const rate = config.foreignToLocalRate;

  const tuition = university.fees.find((f) => f.label.toLowerCase().includes("tuition"))?.amount ?? 0;
  const years = Math.ceil(durationYears(course?.duration));

  const casDeposit = Math.round((tuition * config.casPaymentPercent) / 100);
  const ihsTotal = Math.round(config.healthSurchargePerYear * years);
  const visaFee = config.visaApplicationFee;
  const preVisaTotalForeign = casDeposit + ihsTotal + visaFee;
  const preVisaTotalLocal = Math.round(preVisaTotalForeign * rate);
  const preVisaSubtotalLocal = preVisaTotalLocal + config.tbTestCostLocal + config.airTicketCostLocal;

  const tuitionDue = Math.round((tuition * config.tuitionDuePercent) / 100);
  const livingCostTotal = Math.round(config.livingCostPerMonth * config.livingCostMonths);
  const bankTotalForeign = tuitionDue + livingCostTotal;
  const bankTotalLocal = Math.round(bankTotalForeign * rate);

  const headerRow = (
    <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-slate-400">
      <span />
      <span className="text-right">Amount in {currency}</span>
      <span className="text-right">Amount in {local}</span>
    </div>
  );

  return (
    <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
      <p className="text-[13px] font-semibold text-slate-800">Cost Before Visa</p>
      <div className="mt-2 divide-y divide-slate-50">
        {headerRow}
        <Row label="Tuition fees (average)" note={`${config.casPaymentPercent}% CAS Payment`} foreign={casDeposit} currency={currency} localCurrency={local} />
        <Row label="IHS Fees" note={`${years} year${years === 1 ? "" : "s"}`} foreign={ihsTotal} currency={currency} localCurrency={local} />
        <Row label="Visa Application Fee" note="1" foreign={visaFee} currency={currency} localCurrency={local} />
        <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 bg-slate-50 py-2 text-[12.5px] font-semibold text-slate-900">
          <span>Total</span>
          <span className="text-right">{currency}{preVisaTotalForeign.toLocaleString()}</span>
          <span className="text-right">{local} {preVisaTotalLocal.toLocaleString()}</span>
        </div>
        <Row label="TB Test (Medical)" local={config.tbTestCostLocal} currency={currency} localCurrency={local} />
        <Row label="Air-ticket" local={config.airTicketCostLocal} currency={currency} localCurrency={local} />
        <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 bg-slate-50 py-2 text-[12.5px] font-semibold text-slate-900">
          <span>Sub Total</span>
          <span />
          <span className="text-right">{local} {preVisaSubtotalLocal.toLocaleString()}</span>
        </div>
      </div>

      <p className="mt-5 text-[13px] font-semibold text-slate-800">Bank Statement</p>
      <div className="mt-2 divide-y divide-slate-50">
        {headerRow}
        <Row label="Tuition fees (average)" note="Due" foreign={tuitionDue} currency={currency} localCurrency={local} />
        <Row label="Living cost" note={`${config.livingCostMonths} month${config.livingCostMonths === 1 ? "" : "s"}`} foreign={livingCostTotal} currency={currency} localCurrency={local} />
        <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 bg-slate-50 py-2 text-[12.5px] font-semibold text-slate-900">
          <span>Show in FDR/Savings account for 28 days</span>
          <span className="text-right">{currency}{bankTotalForeign.toLocaleString()}</span>
          <span className="text-right">{local} {bankTotalLocal.toLocaleString()}</span>
        </div>
      </div>
    </div>
  );
}
