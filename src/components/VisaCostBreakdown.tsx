// Real visa/immigration financial-planning breakdown — modeled directly on a UK Student visa cost
// sheet (CAS deposit, Immigration Health Surcharge, visa fee, TB test, air-ticket, then the
// separate bank-statement/proof-of-funds requirement), configured per country via
// countryRegistry.ts's VisaCostConfig and shown alongside CostCalculator on the Fees tab. Every
// figure is computed live off the actual university's tuition fee and course duration — nothing
// here is a static screenshot of one example.
import type { University } from "../types";
import type { VisaCostConfig } from "../data/countryRegistry";
import { courseFeeKind } from "../utils/courseFee";
import { FEES_CAN_CHANGE_WARNING, isUkCountry, ukIhs } from "../utils/ukvi";
import { durationYears } from "./CostCalculator";
import { AlertTriangle } from "lucide-react";

type Course = University["courses"][number];

function Row({ label, note, foreign, local, currency, localCurrency }: { label: string; note?: string; foreign?: number; local?: number; currency: string; localCurrency: string }) {
  return (
    <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 py-1.5 text-[12.5px]">
      <span className="text-neutral-600">
        {label}
        {note && <span className="ml-1 text-[11px] text-neutral-400">({note})</span>}
      </span>
      <span className="text-right font-medium text-neutral-800">{foreign != null ? `${currency}${foreign.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""}</span>
      <span className="text-right font-medium text-neutral-800">{local != null ? `${localCurrency} ${local.toLocaleString(undefined, { maximumFractionDigits: 0 })}` : ""}</span>
    </div>
  );
}

export function VisaCostBreakdown({ university, course, config }: { university: University; course?: Course; config: VisaCostConfig }) {
  const currency = university.currencySymbol;
  const local = config.localCurrencyName;
  const rate = config.foreignToLocalRate;

  // The selected course's own yearly fee — never the university's average tuition line.
  const tuition = course && courseFeeKind(course) === "amount" ? course.feeUSD : 0;
  const uk = isUkCountry(university.country);
  const ukRule = uk ? ukIhs(course?.duration, config.healthSurchargePerYear) : null;
  const years = ukRule ? ukRule.years : Math.ceil(durationYears(course?.duration));

  const casDeposit = Math.round((tuition * config.casPaymentPercent) / 100);
  const ihsTotal = ukRule ? ukRule.amount : Math.round(config.healthSurchargePerYear * years);
  const visaFee = config.visaApplicationFee;
  const preVisaTotalForeign = casDeposit + ihsTotal + visaFee;
  const preVisaTotalLocal = Math.round(preVisaTotalForeign * rate);
  const preVisaSubtotalLocal = preVisaTotalLocal + config.tbTestCostLocal + config.airTicketCostLocal;

  const tuitionDue = Math.round((tuition * config.tuitionDuePercent) / 100);
  const livingCostTotal = Math.round(config.livingCostPerMonth * config.livingCostMonths);
  const bankTotalForeign = tuitionDue + livingCostTotal;
  const bankTotalLocal = Math.round(bankTotalForeign * rate);

  const headerRow = (
    <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2 pb-1.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-400">
      <span />
      <span className="text-right">Amount in {currency}</span>
      <span className="text-right">Amount in {local}</span>
    </div>
  );

  return (
    <div className="rounded-2xl bg-[var(--sd-card)] p-4 shadow-neu">
      <p className="text-[13px] font-semibold text-neutral-800">Cost Before Visa</p>
      <div className="mt-2 divide-y divide-slate-50">
        {headerRow}
        <Row label="Tuition fees (average)" note={`${config.casPaymentPercent}% CAS Payment`} foreign={casDeposit} currency={currency} localCurrency={local} />
        <Row label="IHS Fees" note={ukRule ? `${ukRule.visaMonths}-month visa → ${years} × rate` : `${years} year${years === 1 ? "" : "s"}`} foreign={ihsTotal} currency={currency} localCurrency={local} />
        <Row label="Visa Application Fee" note="1" foreign={visaFee} currency={currency} localCurrency={local} />
        <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 bg-neutral-50 py-2 text-[12.5px] font-semibold text-neutral-900">
          <span>Total</span>
          <span className="text-right">{currency}{preVisaTotalForeign.toLocaleString()}</span>
          <span className="text-right">{local} {preVisaTotalLocal.toLocaleString()}</span>
        </div>
        <Row label="TB Test (Medical)" local={config.tbTestCostLocal} currency={currency} localCurrency={local} />
        <Row label="Air-ticket" local={config.airTicketCostLocal} currency={currency} localCurrency={local} />
        <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 bg-neutral-50 py-2 text-[12.5px] font-semibold text-neutral-900">
          <span>Sub Total</span>
          <span />
          <span className="text-right">{local} {preVisaSubtotalLocal.toLocaleString()}</span>
        </div>
      </div>

      <p className="mt-5 text-[13px] font-semibold text-neutral-800">Bank Statement</p>
      <div className="mt-2 divide-y divide-slate-50">
        {headerRow}
        <Row label="Tuition fees (average)" note="Due" foreign={tuitionDue} currency={currency} localCurrency={local} />
        <Row label="Living cost" note={`${config.livingCostMonths} month${config.livingCostMonths === 1 ? "" : "s"}`} foreign={livingCostTotal} currency={currency} localCurrency={local} />
        <div className="grid grid-cols-[1.4fr_1fr_1fr] items-center gap-2 bg-neutral-50 py-2 text-[12.5px] font-semibold text-neutral-900">
          <span>Show in FDR/Savings account for 28 days</span>
          <span className="text-right">{currency}{bankTotalForeign.toLocaleString()}</span>
          <span className="text-right">{local} {bankTotalLocal.toLocaleString()}</span>
        </div>
      </div>
      <div className="mt-4 flex items-start gap-2 rounded-xl border border-amber-200/70 bg-amber-50/70 p-3">
        <AlertTriangle size={15} className="mt-0.5 shrink-0 text-amber-500" />
        <p className="text-[12px] leading-relaxed text-amber-700">{FEES_CAN_CHANGE_WARNING}</p>
      </div>
    </div>
  );
}
