// UK Student-route (UKVI) cost rules, kept in one place so every screen applies the same arithmetic.
// Figures were checked against GOV.UK on 2026-10-18 — they change, so the UI always warns to confirm:
//   - Immigration Health Surcharge (IHS): £776 per year for students (https://www.gov.uk/healthcare-immigration-application/how-much-pay).
//     It is charged for the WHOLE visa, up front. A part year of 6 months or less costs half a year; more than
//     6 months (but under a year) costs a full year. A whole visa of 6 months or less needs no IHS from outside the UK.
//   - The visa runs for the course plus extra time: 4 months for a course of 12 months or longer, 2 months for
//     6 months to under 12 months (university visa guidance). So a 1-year course is a 16-month visa → 1.5 × IHS,
//     3 years → 3.5 ×, 4 years → 4.5 ×.
//   - Maintenance money (https://www.gov.uk/student-visa/money): £1,529/month in London, £1,171/month elsewhere,
//     for up to 9 months, held for 28 days.
export const UK_IHS_PER_YEAR = 776;
export const UK_MAINTENANCE_LONDON = 1529;
export const UK_MAINTENANCE_OUTSIDE = 1171;
export const UK_MAINTENANCE_MAX_MONTHS = 9;

/** "3 years", "18 months", "12 months", "1.5 years" → months. A bare number counts as years. Null when unreadable. */
export function durationMonths(duration?: string): number | null {
  if (!duration) return null;
  const m = /(\d+(?:\.\d+)?)\s*(month|mo\b|year|yr|week)?/i.exec(duration);
  if (!m) return null;
  const n = parseFloat(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  const unit = (m[2] ?? "year").toLowerCase();
  if (unit.startsWith("month") || unit === "mo") return Math.round(n);
  if (unit.startsWith("week")) return Math.max(1, Math.round(n / 4.345));
  return Math.round(n * 12);
}

/** Visa length in months: the course plus the extra time UKVI grants after it. */
export function ukVisaMonths(courseMonths: number): number {
  return courseMonths + (courseMonths >= 12 ? 4 : courseMonths >= 6 ? 2 : 0);
}

/** How many "years" of IHS a visa of `visaMonths` is charged: whole years, plus half a year for a remainder of
 * 6 months or less, or a full year for more than 6 months. A visa of 6 months or less is 0 (no IHS outside the UK). */
export function ihsYears(visaMonths: number): number {
  if (visaMonths <= 6) return 0;
  const whole = Math.floor(visaMonths / 12);
  const rest = visaMonths - whole * 12;
  return whole + (rest === 0 ? 0 : rest <= 6 ? 0.5 : 1);
}

export const isUkCountry = (country?: string) => /^(uk|united kingdom|great britain|england|scotland|wales)$/i.test((country ?? "").trim());

export interface UkIhs { courseMonths: number; visaMonths: number; years: number; amount: number }
export function ukIhs(duration: string | undefined, perYear: number = UK_IHS_PER_YEAR): UkIhs {
  const courseMonths = durationMonths(duration) ?? 12;
  const visaMonths = ukVisaMonths(courseMonths);
  const years = ihsYears(visaMonths);
  return { courseMonths, visaMonths, years, amount: Math.round(perYear * years * 100) / 100 };
}

export const isLondon = (city?: string) => /london/i.test(city ?? "");
export function ukMaintenance(courseMonths: number, london: boolean): number {
  return (london ? UK_MAINTENANCE_LONDON : UK_MAINTENANCE_OUTSIDE) * Math.min(UK_MAINTENANCE_MAX_MONTHS, courseMonths);
}

export const FEES_CAN_CHANGE_WARNING =
  "Fees, surcharges and visa requirements can change at any time. Please check the official university and government websites, or talk to your counsellor, before you pay or apply.";
