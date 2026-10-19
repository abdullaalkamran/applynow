// One place that works out every cost figure the Fees tab and the Cost Calculator page show, so the tables and the
// estimated total always agree. Amounts are in the course's currency (£ for the UK); the student's home-currency figures come
// from the country's configured visa costs (see countryRegistry.ts VisaCostConfig) converted at its configured rate.
import type { University } from "../types";
import type { VisaCostConfig } from "../data/countryRegistry";
import { courseCurrencySymbol, courseFeeKind, sameCurrency } from "./courseFee";
import { UK_IHS_PER_YEAR, UK_VISA_FEE, durationMonths, isLondon, isUkCountry, ukIhs, ukMaintenance } from "./ukvi";
import { ukRentFor } from "./ukAccommodation";

type Course = University["courses"][number];
export type DurationMode = "1st Year" | "Full Duration";

/** What the student can change on the page. Anything left undefined uses the calculated/configured default. */
export interface CostOptions {
  depositOverride?: number | null; // paid deposit; never counted below the university's required deposit
  scholarship?: ScholarshipChoice | null; // deducted from the estimated total
  airTicket?: number | null; // in the course currency
  medical?: number | null; // in the course currency
  accommodationMonths?: number | null;
}
export interface ScholarshipChoice { label: string; amount: number }

/** The number a scholarship's free-text award stands for: "up to £10,000" → 10000, "£5k" → 5000, "50% of tuition" → half of the
 * tuition being paid. Null when the text names no amount. "per year" awards are multiplied across the years shown. */
export function scholarshipAmountFrom(text: string, tuitionShown: number, yearlyTuition: number, years: number): number | null {
  const t = (text ?? "").toLowerCase();
  const pct = /(\d+(?:\.\d+)?)\s*%/.exec(t);
  if (pct) {
    const base = /per year|a year|\/\s*year|annual/.test(t) ? yearlyTuition * years : tuitionShown;
    return Math.round((base * Number(pct[1])) / 100);
  }
  const m = /(\d[\d,]*(?:\.\d+)?)\s*(k|thousand|m\b|million)?/.exec(t);
  if (!m) return null;
  let n = Number(m[1].replace(/,/g, ""));
  if (!Number.isFinite(n) || n <= 0) return null;
  if (m[2] === "k" || m[2] === "thousand") n *= 1000;
  if (m[2] === "m" || m[2] === "million") n *= 1_000_000;
  if (/per year|a year|\/\s*year|annual/.test(t)) n *= years;
  return Math.round(n);
}

export interface CostLine { key: string; label: string; note?: string; amount: number | null; local?: number | null }

export interface CostModel {
  currency: string;
  uk: boolean;
  courseMonths: number;
  years: number;
  tuitionKind: "amount" | "free" | "unknown";
  yearlyTuition: number;
  tuition: number;
  localName?: string;
  rate?: number;
  // Cost Before Visa
  requiredDeposit: number; // the university's minimum deposit (or the country's CAS % when the university gives none)
  depositRule: string;
  casDeposit: number; // the deposit actually counted: the required amount, or more if the student entered more
  ihs: { amount: number; note: string } | null;
  visaFee: number;
  payInForeign: number; // CAS + IHS + visa fee
  medical: { local: number | null; foreign: number | null; custom: boolean } | null;
  airTicket: { local: number | null; foreign: number | null; custom: boolean } | null;
  beforeVisaForeign: number | null; // everything above in the course currency (null if a home-currency item can't be converted)
  // Bank statement
  tuitionDuePercent: number;
  tuitionDue: number;
  living: { amount: number; note: string } | null;
  bankForeign: number;
  // Estimated total
  accommodation: { amount: number; monthly: number; months: number; defaultMonths: number; place: string } | null;
  scholarship: { label: string; amount: number } | null;
  total: number;
  notes: string[];
  // Deposit
  deposit: number | null;
}

const toForeign = (local: number, rate?: number) => (rate && rate > 0 ? local / rate : null);

export function buildCostModel(university: University, course: Course | undefined, config: VisaCostConfig | undefined, mode: DurationMode, opts: CostOptions = {}): CostModel {
  const currency = course ? courseCurrencySymbol(university, course) : university.currencySymbol;
  const tuitionKind = course ? courseFeeKind(course) : "unknown";
  const yearlyTuition = course && tuitionKind === "amount" ? course.feeUSD : 0;
  const courseMonths = durationMonths(course?.duration) ?? 12;
  const courseYears = courseMonths / 12;
  const years = mode === "Full Duration" ? courseYears : 1;
  const tuition = Math.round(yearlyTuition * years);
  const uk = isUkCountry(university.country) && !!course && sameCurrency(currency, "£");
  const rate = config?.foreignToLocalRate;
  const notes: string[] = [];

  // IHS: UK follows the UKVI rule (whole visa, half/full year for the remainder); other countries use the configured per-year amount.
  let ihs: CostModel["ihs"] = null;
  if (uk) {
    const r = ukIhs(course?.duration, config?.healthSurchargePerYear || UK_IHS_PER_YEAR);
    ihs = {
      amount: r.amount,
      note: r.years === 0
        ? "A visa of 6 months or less needs no IHS from outside the UK"
        : `${r.visaMonths}-month visa (course + extra time) → ${r.years} × ${currency}${(config?.healthSurchargePerYear || UK_IHS_PER_YEAR).toLocaleString()}`,
    };
  } else if (config && config.healthSurchargePerYear > 0) {
    const y = Math.max(1, Math.ceil(courseYears));
    ihs = { amount: Math.round(config.healthSurchargePerYear * y), note: `${y} year${y === 1 ? "" : "s"} × ${currency}${config.healthSurchargePerYear.toLocaleString()}` };
  }

  const visaFee = config?.visaApplicationFee || (uk ? UK_VISA_FEE : 0);

  // Deposit: what the UNIVERSITY requires (its own minimum, or half/full of first-year tuition), falling back to the country's
  // CAS percentage only when the university states nothing. The student may pay more, never less.
  const casPercent = config?.casPaymentPercent ?? 0;
  const uniDeposit = university.minimumDepositAmount == null ? null
    : university.depositMode === "half" ? Math.round(yearlyTuition * 0.5)
    : university.depositMode === "full" ? Math.round(yearlyTuition)
    : university.minimumDepositAmount;
  const requiredDeposit = uniDeposit ?? Math.round((yearlyTuition * casPercent) / 100);
  const depositRule = uniDeposit != null
    ? (university.depositMode === "half" ? "50% of first-year tuition" : university.depositMode === "full" ? "Full first-year tuition" : "Minimum set by the university")
    : casPercent > 0 ? `${casPercent}% of first-year tuition (country default)` : "No deposit set";
  const casDeposit = Math.max(requiredDeposit, Math.round(opts.depositOverride ?? 0));

  // Medical test and air ticket: the student's own figure when they typed one, else the country's configured home-currency cost
  // converted at its rate.
  const defMedical = config && config.tbTestCostLocal > 0 ? { local: config.tbTestCostLocal, foreign: toForeign(config.tbTestCostLocal, rate) } : null;
  const defAir = config && config.airTicketCostLocal > 0 ? { local: config.airTicketCostLocal, foreign: toForeign(config.airTicketCostLocal, rate) } : null;
  const medical: CostModel["medical"] = opts.medical != null ? { local: null, foreign: opts.medical, custom: true } : defMedical ? { ...defMedical, custom: false } : null;
  const airTicket: CostModel["airTicket"] = opts.airTicket != null ? { local: null, foreign: opts.airTicket, custom: true } : defAir ? { ...defAir, custom: false } : null;
  const payInForeign = casDeposit + (ihs?.amount ?? 0) + visaFee;
  const convertible = (!medical || medical.foreign !== null) && (!airTicket || airTicket.foreign !== null);
  const beforeVisaForeign = convertible ? payInForeign + (medical?.foreign ?? 0) + (airTicket?.foreign ?? 0) : null;

  // Bank statement: first-year tuition still to pay after the deposit, plus living money. UK uses UKVI's own maintenance figures.
  const tuitionDue = Math.max(0, Math.round(yearlyTuition) - casDeposit);
  const tuitionDuePercent = yearlyTuition > 0 ? Math.round((tuitionDue / yearlyTuition) * 100) : 0;
  let living: CostModel["living"] = null;
  if (uk) {
    const london = isLondon(university.city);
    const m = Math.min(9, courseMonths);
    living = { amount: ukMaintenance(courseMonths, london), note: `UKVI maintenance: ${m} month${m === 1 ? "" : "s"} × ${currency}${(london ? 1529 : 1171).toLocaleString()} (${london ? "London" : "outside London"})` };
  } else if (config && config.livingCostPerMonth > 0) {
    living = { amount: Math.round(config.livingCostPerMonth * config.livingCostMonths), note: `${config.livingCostMonths} month${config.livingCostMonths === 1 ? "" : "s"} × ${currency}${config.livingCostPerMonth.toLocaleString()}` };
  }
  const bankForeign = tuitionDue + (living?.amount ?? 0);

  // Accommodation (UK only for now — other countries' rules come later): the average student rent for the university's region,
  // for the months the student chooses (default: the first year, or the whole course).
  let accommodation: CostModel["accommodation"] = null;
  if (uk) {
    const rent = ukRentFor(university.city);
    const defaultMonths = mode === "1st Year" ? Math.min(12, courseMonths) : courseMonths;
    const months = opts.accommodationMonths != null ? Math.max(0, Math.min(120, Math.round(opts.accommodationMonths))) : defaultMonths;
    accommodation = { amount: Math.round(rent.monthly * months), monthly: rent.monthly, months, defaultMonths, place: rent.region ? `${rent.region} average` : "UK average" };
  }

  // A scholarship comes off the tuition being paid — never more than that tuition.
  const scholarship = opts.scholarship && opts.scholarship.amount > 0 && tuition > 0
    ? { label: opts.scholarship.label, amount: Math.min(Math.round(opts.scholarship.amount), tuition) }
    : null;

  const gross = tuition + (ihs?.amount ?? 0) + visaFee + (medical?.foreign ?? 0) + (airTicket?.foreign ?? 0) + (accommodation?.amount ?? 0);
  const total = Math.max(0, Math.round(gross - (scholarship?.amount ?? 0)));
  if (!convertible) notes.push("Medical test and air ticket aren't counted: no exchange rate is set for this country yet. Enter your own figures below.");
  if (!config) notes.push("This country's visa costs (visa fee, medical test, air ticket) haven't been set up yet. You can still enter your own medical test and air ticket costs below.");

  return {
    currency, uk, courseMonths, years, tuitionKind, yearlyTuition, tuition, localName: config?.localCurrencyName, rate,
    requiredDeposit, depositRule, casDeposit, ihs, visaFee, payInForeign, medical, airTicket, beforeVisaForeign,
    tuitionDuePercent, tuitionDue, living, bankForeign, accommodation, scholarship, total, notes, deposit: casDeposit > 0 ? casDeposit : null,
  };
}
