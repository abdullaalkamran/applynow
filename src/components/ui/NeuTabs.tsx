import { useEffect, useRef } from "react";

/**
 * Sub-tabs in the app's soft-UI style: a raised track with the active tab as a raised black key, like the Explore
 * Universities / Subjects / Countries switcher. Tabs share the width when they fit and the track scrolls sideways (the
 * active tab is kept in view) when they don't, so five tabs work on a 320px phone.
 */
export function NeuTabs<T extends string>({
  tabs, value, onChange, ariaLabel, className = "", labels, counts,
}: {
  tabs: readonly T[];
  value: T;
  onChange: (tab: T) => void;
  ariaLabel?: string;
  className?: string;
  /** Display text per tab, when it differs from the tab key. */
  labels?: Partial<Record<T, string>>;
  /** A small count shown after the label (e.g. applications in each bucket). */
  counts?: Partial<Record<T, number>>;
}) {
  const refs = useRef<Record<string, HTMLButtonElement | null>>({});
  const first = useRef(true);

  // Bring the chosen tab into view in a scrolling track (not on first paint, so the page doesn't jump on load).
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    refs.current[value]?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [value]);

  // The wrapper's padding gives the track's shadow room, so the scroll container doesn't clip it into a visible box.
  return (
    <div className={`no-scrollbar -mx-4 overflow-x-auto px-4 py-4 -my-2 ${className}`}>
      <div role="tablist" aria-label={ariaLabel} className="flex min-w-max gap-1 rounded-2xl bg-[var(--sd-card)] p-1 shadow-neu-sm">
        {tabs.map((t) => {
          const active = t === value;
          return (
            <button
              key={t}
              ref={(el) => { refs.current[t] = el; }}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onChange(t)}
              className={`flex-1 whitespace-nowrap rounded-xl ${counts ? "px-2.5 min-[420px]:px-3" : "px-3.5"} py-2 text-[clamp(11.5px,3.3vw,13px)] font-medium transition-all duration-200 ${
                active ? "bg-neutral-900 text-white shadow-neu-dark" : "text-neutral-600 hover:text-neutral-900"
              }`}
            >
              {labels?.[t] ?? t}
              {counts && counts[t] !== undefined && (
                <span
                  className={`ml-1 inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                    active ? "bg-white/20 text-white" : "bg-[var(--sd-card)] text-neutral-600 shadow-neu-inset-sm"
                  }`}
                >
                  {counts[t]}
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
