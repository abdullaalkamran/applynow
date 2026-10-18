import { useState } from "react";

// Preset bands in whole units of the selected currency (so "Under £10k" is really £10,000).
const PRESET_BANDS: [number, number][] = [[0, 10000], [10000, 25000], [25000, 50000], [50000, Infinity]];

/** Annual-fee filter: a two-handle slider, typed From/To boxes (any value, not just 1,000 steps) and one-tap presets,
 * all in ONE selected currency. Amounts are never converted between currencies — a course priced in another currency, or
 * with no fee listed, simply can't be judged by the range, and the notes below say how many were left out. The top of the
 * slider means "no upper limit". When a country's courses use several currencies, chips switch which one the range is in. */
export function FeeRangeFilter({
  min, max, floor, ceiling, step, currency, currencies, onCurrencyChange, onChange,
  unknownCount, otherCurrencyCount, includeUnknown, onIncludeUnknown, rangeActive,
}: {
  min: string; max: string; floor: number; ceiling: number; step: number;
  currency: string; currencies: string[];
  onCurrencyChange: (symbol: string) => void;
  onChange: (min: string, max: string) => void;
  unknownCount: number; otherCurrencyCount: number;
  includeUnknown: boolean; onIncludeUnknown: (v: boolean) => void;
  rangeActive: boolean;
}) {
  const symbol = currency.trim() || "$";
  const fmt = (n: number) => `${symbol}${n.toLocaleString("en-US")}`;
  const short = (n: number) => `${symbol}${n / 1000}k`;
  const lo = Math.max(floor, Number(min) || floor);
  const hi = Math.min(ceiling, max === "" ? ceiling : Number(max));
  const unlimited = hi >= ceiling;

  // While a box is being typed in it shows the draft text; otherwise it mirrors the filter value.
  const [minDraft, setMinDraft] = useState<string | null>(null);
  const [maxDraft, setMaxDraft] = useState<string | null>(null);
  const minText = minDraft ?? String(lo);
  const maxText = maxDraft ?? (unlimited ? "" : String(hi));

  function commit(nextLo: number, nextHi: number) {
    const a = Math.max(floor, Math.min(nextLo, ceiling));
    const b = Math.max(floor, Math.min(nextHi, ceiling));
    onChange(String(Math.min(a, b)), String(Math.max(a, b)));
  }

  const pct = (v: number) => ((v - floor) / (ceiling - floor)) * 100;
  const thumb =
    "pointer-events-none absolute inset-0 h-6 w-full appearance-none bg-transparent " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:h-5 [&::-webkit-slider-thumb]:w-5 [&::-webkit-slider-thumb]:cursor-grab [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-0 [&::-webkit-slider-thumb]:bg-neutral-900 [&::-webkit-slider-thumb]:shadow-[0_2px_6px_rgba(0,0,0,0.35),inset_0_1px_1px_rgba(255,255,255,0.25)] " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:h-5 [&::-moz-range-thumb]:w-5 [&::-moz-range-thumb]:cursor-grab [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-neutral-900";

  return (
    <div>
      {currencies.length > 1 && (
        <div className="mb-3" role="group" aria-label="Fee currency">
          <span className="text-[11px] font-medium text-neutral-500">Currency</span>
          <div className="mt-1 flex flex-wrap gap-1.5">
            {currencies.map((c) => {
              const active = c.trim() === currency.trim();
              return (
                <button
                  key={c} type="button" onClick={() => onCurrencyChange(c)} aria-pressed={active}
                  className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${
                    active ? "bg-neutral-900 text-white shadow-neu-dark" : "bg-[var(--sd-card)] text-neutral-700 shadow-neu-sm"
                  }`}
                >
                  {c.trim()}
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div className="flex items-baseline justify-between gap-2">
        <span className="text-[17px] font-bold tracking-tight text-neutral-900">
          {fmt(lo)} <span className="font-medium text-neutral-400">–</span> {unlimited ? `${fmt(ceiling)}+` : fmt(hi)}
        </span>
        <span className="text-[11px] text-neutral-500">per year · {symbol}</span>
      </div>

      <div className="relative mt-3 h-6">
        <div className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-neutral-900"
          style={{ left: `${pct(lo)}%`, right: `${100 - pct(hi)}%` }}
        />
        <input
          type="range" aria-label="Minimum annual fee" min={floor} max={ceiling} step={step} value={lo}
          onChange={(e) => commit(Math.min(Number(e.target.value), hi), hi)}
          className={`${thumb} ${lo > ceiling - step * 5 ? "z-20" : "z-10"}`}
        />
        <input
          type="range" aria-label="Maximum annual fee" min={floor} max={ceiling} step={step} value={hi}
          onChange={(e) => commit(lo, Math.max(Number(e.target.value), lo))}
          className={`${thumb} z-10`}
        />
      </div>

      <div className="mt-3 grid grid-cols-2 gap-2.5">
        <label className="block">
          <span className="text-[11px] font-medium text-neutral-500">From</span>
          <div className="mt-1 flex items-center rounded-xl bg-[var(--sd-card)] px-3 shadow-neu-inset-sm">
            <span className="text-[13px] text-neutral-400">{symbol}</span>
            <input
              inputMode="numeric" value={minText} aria-label="Minimum fee"
              onChange={(e) => setMinDraft(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => { commit(Number(minText || 0), hi); setMinDraft(null); }}
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
              className="min-w-0 flex-1 bg-transparent py-2 pl-1 text-[13px] text-neutral-800 focus:outline-none"
            />
          </div>
        </label>
        <label className="block">
          <span className="text-[11px] font-medium text-neutral-500">To</span>
          <div className="mt-1 flex items-center rounded-xl bg-[var(--sd-card)] px-3 shadow-neu-inset-sm">
            <span className="text-[13px] text-neutral-400">{symbol}</span>
            <input
              inputMode="numeric" value={maxText} placeholder="No limit" aria-label="Maximum fee"
              onChange={(e) => setMaxDraft(e.target.value.replace(/[^\d]/g, ""))}
              onBlur={() => { commit(lo, maxText === "" ? ceiling : Number(maxText)); setMaxDraft(null); }}
              onKeyDown={(e) => e.key === "Enter" && (e.currentTarget as HTMLInputElement).blur()}
              className="min-w-0 flex-1 bg-transparent py-2 pl-1 text-[13px] text-neutral-800 placeholder:text-neutral-400 focus:outline-none"
            />
          </div>
        </label>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {[null, ...PRESET_BANDS].map((band) => {
          const pMin = band ? Math.max(band[0], floor) : floor;
          const pMax = band && Number.isFinite(band[1]) ? Math.min(band[1], ceiling) : ceiling;
          const label = !band ? "Any" : band[0] === 0 ? `Under ${short(band[1])}` : !Number.isFinite(band[1]) ? `${short(band[0])}+` : `${short(band[0])} – ${short(band[1])}`;
          const active = lo === pMin && hi === pMax;
          return (
            <button
              key={label} type="button" onClick={() => commit(pMin, pMax)}
              className={`rounded-full px-3 py-1.5 text-[11.5px] font-semibold transition ${
                active ? "bg-neutral-900 text-white shadow-neu-dark" : "bg-[var(--sd-card)] text-neutral-700 shadow-neu-sm"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {rangeActive && (unknownCount > 0 || otherCurrencyCount > 0) && (
        <div className="mt-3 space-y-1.5 rounded-xl bg-[var(--sd-card)] p-3 shadow-neu-inset-sm text-[11.5px] leading-snug text-neutral-600">
          {unknownCount > 0 && (
            <label className="flex cursor-pointer items-start gap-2">
              <input type="checkbox" checked={includeUnknown} onChange={(e) => onIncludeUnknown(e.target.checked)} className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>Also show {unknownCount} course{unknownCount === 1 ? "" : "s"} with no fee listed</span>
            </label>
          )}
          {otherCurrencyCount > 0 && (
            <p>{otherCurrencyCount} course{otherCurrencyCount === 1 ? " is" : "s are"} priced in another currency and can't be compared with this range{currencies.length > 1 ? " — switch currency above to see them" : ""}.</p>
          )}
        </div>
      )}
    </div>
  );
}
