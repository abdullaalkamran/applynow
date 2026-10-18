import { getAllUniversities } from "../data/universityCatalogStore";
import { getCountryByName } from "../data/countryRegistry";
import type { University } from "../types";

// One place that decides what a course's fee MEANS and how it's shown, compared and filtered — every screen goes through it.
//
// A course stores `feeUSD` (a legacy name: it is the annual amount in the COURSE'S OWN currency, not US dollars) plus
// `feeStatus`. The rules, in order:
//   - feeStatus "free"            → Free (only ever set explicitly by Data Management)
//   - feeUSD > 0                  → an amount, in the course's effective currency
//   - anything else               → not provided. That includes every legacy row saved as (amount, 0): a 0 was always
//                                   what an unknown fee was stored as, so it is never silently read as free.
// Currency: the course's own symbol if it has one, else its university's — the existing configuration, nothing new.
// Amounts in different currencies are never compared or converted; they are simply not comparable.

type Course = University["courses"][number];

export type CourseFeeKind = "amount" | "free" | "unknown";

export function courseFeeKind(c: Pick<Course, "feeUSD" | "feeStatus">): CourseFeeKind {
  if (c.feeStatus === "free") return "free";
  if (c.feeStatus !== "unknown" && Number.isFinite(c.feeUSD) && c.feeUSD > 0) return "amount";
  return "unknown";
}

/** The symbol this course's fee is in, exactly as configured (may carry a trailing space, e.g. "AED "). */
export function courseCurrencySymbol(u: Pick<University, "currencySymbol">, c: Pick<Course, "currencySymbol">): string {
  return (c.currencySymbol && c.currencySymbol.trim() ? c.currencySymbol : u.currencySymbol) ?? "";
}

/** Symbols are compared by their trimmed text. */
export const sameCurrency = (a: string, b: string) => a.trim() === b.trim();

export interface CourseFeeText {
  kind: CourseFeeKind;
  /** "£25,000", "Free" or "Fee not provided". */
  text: string;
  /** Same, with "/yr" after a real amount: "£25,000/yr". */
  perYear: string;
  /** Only a real amount is a number worth showing in a stat tile; Free / not provided read as words. */
  isAmount: boolean;
}

export const FEE_NOT_PROVIDED = "Fee not provided";

export function courseFeeText(u: Pick<University, "currencySymbol">, c: Pick<Course, "feeUSD" | "feeStatus" | "currencySymbol">): CourseFeeText {
  const kind = courseFeeKind(c);
  if (kind === "free") return { kind, text: "Free", perYear: "Free", isAmount: false };
  if (kind === "unknown") return { kind, text: FEE_NOT_PROVIDED, perYear: FEE_NOT_PROVIDED, isAmount: false };
  const text = `${courseCurrencySymbol(u, c)}${Math.round(c.feeUSD).toLocaleString()}`;
  return { kind, text, perYear: `${text}/yr`, isAmount: true };
}

/** The course's yearly fee in `currency` (0 for a Free course), or null when it can't be compared: the fee is not
 * provided, or is in a different currency. No conversion, ever. */
export function courseFeeIn(u: Pick<University, "currencySymbol">, c: Course, currency: string): number | null {
  const kind = courseFeeKind(c);
  if (kind === "unknown") return null;
  if (!sameCurrency(courseCurrencySymbol(u, c), currency)) return null;
  return kind === "free" ? 0 : c.feeUSD;
}

/** Every currency in use among the given courses, most common first. */
export function currenciesOf(pairs: { u: University; c: Course }[]): string[] {
  const counts = new Map<string, { symbol: string; n: number }>();
  for (const { u, c } of pairs) {
    const symbol = courseCurrencySymbol(u, c);
    const key = symbol.trim();
    if (!key) continue;
    const hit = counts.get(key);
    if (hit) hit.n++; else counts.set(key, { symbol, n: 1 });
  }
  return [...counts.values()].sort((a, b) => b.n - a.n).map((x) => x.symbol);
}

/** The currencies a destination's fees are quoted in: the country's own configured symbols first (the existing Country
 * Management list), then any other currency its courses actually use. With no destination, every currency in the
 * catalogue. Nothing here converts or assumes one currency per country. */
export function feeCurrenciesFor(destination: string | string[]): string[] {
  const dests = (Array.isArray(destination) ? destination : [destination]).filter(Boolean);
  const pairs = getAllUniversities()
    .filter((u) => dests.length === 0 || dests.includes(u.country))
    .flatMap((u) => u.courses.map((c) => ({ u, c })));
  const used = currenciesOf(pairs);
  const configured = dests.flatMap((d) => getCountryByName(d)?.currencySymbols ?? []);
  const out: string[] = [];
  for (const sym of [...configured, ...used]) if (sym.trim() && !out.some((o) => sameCurrency(o, sym))) out.push(sym);
  return out;
}
