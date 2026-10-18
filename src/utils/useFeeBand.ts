import { useState } from "react";
import { currenciesOf } from "./courseFee";
import { FEE_BAND_LIMITS, feeBandLabel, feeBandMax, courseWithinFeeBand } from "./universityFilter";
import type { University } from "../types";

type Course = University["courses"][number];

/** State for the compact "Fees" pill filter on the subject and agent program lists. The "Under X" bands are amounts in ONE
 * currency — the one chosen with the Currency pill (shown only when the listed programs use several) — so a £ course is
 * never measured against a $ band. A program whose fee isn't provided, or is in another currency, isn't within any band. */
export function useFeeBand(programs: { university: University; course: Course }[]) {
  const [limit, setLimit] = useState<number | null>(null);
  const [picked, setPicked] = useState("");
  const currencies = currenciesOf(programs.map(({ university, course }) => ({ u: university, c: course })));
  const currency = picked && currencies.some((c) => c.trim() === picked.trim()) ? picked : currencies[0] ?? "$";

  return {
    /** Everything the pills need. */
    bandOptions: FEE_BAND_LIMITS.map((l) => feeBandLabel(currency, l)),
    bandValue: limit === null ? "" : feeBandLabel(currency, limit),
    onBandChange: (label: string) => setLimit(label ? feeBandMax(label) : null),
    currencyOptions: currencies.map((c) => c.trim()),
    currencyValue: currency.trim(),
    onCurrencyChange: (symbol: string) => setPicked(currencies.find((c) => c.trim() === symbol) ?? ""),
    showCurrency: currencies.length > 1,
    active: limit !== null,
    reset: () => setLimit(null),
    /** True when no band is set, or when the program is comparable in the band currency and within the limit. */
    matches: (u: University, c: Course) => limit === null || courseWithinFeeBand(u, c, currency, limit),
  };
}
