// Home → Recommended: a row of course cards that slides sideways by itself, one card at a time. Swipe or scroll it by hand
// and it waits a few seconds before moving again; it stays still for anyone who prefers reduced motion, and while the
// pointer is over it.
import { useEffect, useRef, useState } from "react";
import { BarChart3, Calendar, ChevronRight, ShieldCheck } from "lucide-react";
import { LogoBadge } from "../../components/ui/mobile";
import type { University } from "../../types";

export interface RecommendedItem { university: University; course: University["courses"][number] }

const FADE = "linear-gradient(to right, transparent 0, #000 32px, #000 calc(100% - 32px), transparent 100%)";
const SLIDE_EVERY_MS = 4500;
const PAUSE_AFTER_TOUCH_MS = 9000;

export function RecommendedCarousel({ items, onOpen }: { items: RecommendedItem[]; onOpen: (item: RecommendedItem) => void }) {
  const track = useRef<HTMLDivElement>(null);
  const pausedUntil = useRef(0);
  const hovering = useRef(false);
  const [active, setActive] = useState(0);

  // Which card is nearest the left edge, for the dots.
  function syncActive() {
    const el = track.current;
    if (!el || el.children.length === 0) return;
    const step = (el.children[0] as HTMLElement).offsetWidth + 12;
    setActive(Math.min(items.length - 1, Math.max(0, Math.round(el.scrollLeft / step))));
  }

  function goTo(index: number) {
    const el = track.current;
    if (!el) return;
    const card = el.children[index] as HTMLElement | undefined;
    if (card) el.scrollTo({ left: card.offsetLeft - el.offsetLeft, behavior: "smooth" });
  }

  useEffect(() => {
    if (items.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const el = track.current;
      if (!el || hovering.current || Date.now() < pausedUntil.current || document.hidden) return;
      const step = (el.children[0] as HTMLElement).offsetWidth + 12;
      const current = Math.round(el.scrollLeft / step);
      goTo(current >= items.length - 1 || el.scrollLeft + el.clientWidth >= el.scrollWidth - 4 ? 0 : current + 1);
    }, SLIDE_EVERY_MS);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- goTo only reads refs
  }, [items.length]);

  const holdOff = () => { pausedUntil.current = Date.now() + PAUSE_AFTER_TOUCH_MS; };

  return (
    <div>
      <div
        ref={track}
        onScroll={syncActive}
        onTouchStart={holdOff}
        onWheel={holdOff}
        onPointerDown={holdOff}
        onMouseEnter={() => { hovering.current = true; }}
        onMouseLeave={() => { hovering.current = false; }}
        // The raised card shadow reaches ~26px past the card; a scrolling box clips anything outside it, which left a pale strip behind
        // the cards. 32px of padding on every side (pulled back with negative margins) keeps the whole shadow inside the box.
        className="no-scrollbar -mx-8 -mt-4 flex scroll-pl-8 snap-x snap-mandatory gap-3 overflow-x-auto scroll-smooth px-8 py-8"
        // Cards fade out over the box's outer 32px instead of being sliced off, so no hard edge shows on wide screens.
        style={{ maskImage: FADE, WebkitMaskImage: FADE }}
        aria-roledescription="carousel"
        aria-label="Recommended courses"
      >
        {items.map(({ university: u, course: c }) => (
          <button
            key={`${u.id}::${c.name}`}
            onClick={() => onOpen({ university: u, course: c })}
            className="flex w-[86%] shrink-0 snap-start items-center gap-3 rounded-2xl border border-transparent bg-[var(--sd-card)] p-3.5 text-left shadow-neu sm:w-[60%] lg:w-[46%]"
          >
            <LogoBadge name={u.name} tone={u.tone} logoUrl={u.logoUrl} className="h-14 w-14 shrink-0 text-sm" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 text-[14px] font-semibold leading-snug text-neutral-900">{c.name}</p>
              <p className="truncate text-xs text-neutral-400">{u.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-neutral-500">
                {u.worldRank && (
                  <span className="inline-flex items-center gap-1"><BarChart3 size={11} className="text-neutral-400" /> {u.worldRank}</span>
                )}
                {u.openIntake && (
                  <span className="inline-flex items-center gap-1"><Calendar size={11} className="text-neutral-400" /> {u.openIntake}</span>
                )}
                {u.scholarshipsAvailable && (
                  <span className="inline-flex items-center gap-1 text-neutral-800"><ShieldCheck size={12} /></span>
                )}
              </div>
            </div>
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-900 shadow-neu-sm">
              <ChevronRight size={16} />
            </span>
          </button>
        ))}
      </div>
      {items.length > 1 && (
        <div className="-mt-5 flex justify-center gap-1.5" role="tablist" aria-label="Choose a recommendation">
          {items.map((it, i) => (
            <button
              key={`${it.university.id}::${it.course.name}`}
              role="tab"
              aria-selected={i === active}
              aria-label={`Recommendation ${i + 1}`}
              onClick={() => { holdOff(); goTo(i); }}
              className={`h-1.5 rounded-full transition-all ${i === active ? "w-5 bg-neutral-800" : "w-1.5 bg-neutral-300"}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}
