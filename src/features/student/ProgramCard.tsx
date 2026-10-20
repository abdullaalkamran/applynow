// The course card shown in Explore → Courses and in Home → Recommended: big logo, course name, university, fee and deposit,
// the open intake and scholarship, a bookmark and the Apply button. One component so both places always look and read the same.
import { Bookmark, Building2, CalendarDays, GraduationCap, Landmark, Send, Wallet } from "lucide-react";
import type { University } from "../../types";
import { courseFeeText } from "../../utils/courseFee";
import { courseHasOpenIntake, depositLabel, scholarshipLabel } from "../../utils/universityFilter";

// Matches LogoBadge's own initials logic exactly — this card renders its own flat-color badge (rather than LogoBadge's gradient
// one) only for this specific design, so the fallback letter(s) must still be identical to what LogoBadge would have picked.
export function universityInitials(name: string) {
  return name.replace(/^University of /, "").split(/\s+/).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
}

export function ProgramCard({
  university: u, course: c, shortlisted, onToggleShortlist, onOpen, onApply, className = "",
}: {
  university: University;
  course: University["courses"][number];
  shortlisted: boolean;
  onToggleShortlist: () => void;
  onOpen: () => void;
  onApply: () => void;
  className?: string;
}) {
  const scholarship = scholarshipLabel(u);
  const open = courseHasOpenIntake(u, c);
  return (
    <div
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => { if (e.key === "Enter") onOpen(); }}
      className={`relative flex w-full cursor-pointer items-start gap-3 rounded-2xl bg-[var(--sd-card)] p-3.5 text-left shadow-neu sm:gap-4 sm:rounded-3xl sm:p-5 ${className}`}
    >
      <span
        onClick={(e) => { e.stopPropagation(); onToggleShortlist(); }}
        aria-label={shortlisted ? "Remove from shortlist" : "Shortlist"}
        className={`absolute right-3 top-3 shrink-0 sm:right-4 sm:top-4 ${shortlisted ? "text-[var(--sd-ink)]" : "text-neutral-300"}`}
      >
        <Bookmark size={18} className={shortlisted ? "fill-[var(--sd-ink)]" : ""} />
      </span>

      {u.logoUrl ? (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-transparent bg-white sm:h-24 sm:w-24 sm:rounded-2xl">
          <img src={u.logoUrl} alt={`${u.name} logo`} className="h-full w-full object-contain" />
        </div>
      ) : (
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-[var(--sd-card)] shadow-neu-inset-sm text-lg font-semibold text-neutral-500 sm:h-24 sm:w-24 sm:rounded-2xl sm:text-3xl">
          {universityInitials(u.name)}
        </div>
      )}

      <div className="min-w-0 flex-1">
        <p className="line-clamp-2 break-words text-[11.5px] font-semibold leading-snug text-neutral-900 sm:text-lg">{c.name}</p>
        <p className="mt-1 flex items-center gap-1 text-[11px] text-neutral-400 sm:mt-1.5 sm:gap-1.5 sm:text-sm">
          <Building2 size={12} className="shrink-0" /> <span className="truncate">{u.name}</span>
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-1 text-[9.5px] text-neutral-400 sm:mt-1.5 sm:text-[10.5px]">
          <span className="inline-flex shrink-0 items-center gap-1">
            <Wallet size={11} /> {courseFeeText(u, c).text}
          </span>
          {depositLabel(u) && (
            <>
              <span className="shrink-0">·</span>
              <span className="inline-flex shrink-0 items-center gap-1">
                <Landmark size={11} /> {depositLabel(u)}
              </span>
            </>
          )}
        </div>
        <div className="mt-2.5 flex items-center gap-2 border-t border-transparent pt-2.5 text-[11px] text-neutral-500 sm:mt-4 sm:gap-3 sm:pt-3 sm:text-sm">
          {u.openIntake && (
            <span className="inline-flex min-w-0 items-center gap-1 sm:gap-1.5">
              <CalendarDays size={13} className="shrink-0 text-neutral-400" /> <span className="truncate">Open: {u.openIntake}</span>
            </span>
          )}
          {scholarship && (
            <>
              <span className="h-3.5 w-px shrink-0 bg-neutral-200 sm:h-4" />
              <span className="inline-flex min-w-0 items-center gap-1 sm:gap-1.5">
                <GraduationCap size={13} className="shrink-0 text-neutral-400" /> <span className="truncate">{scholarship}</span>
              </span>
            </>
          )}
        </div>
      </div>
      {/* Vertically centred on the card's right edge; the bookmark sits above it. */}
      <button
        onClick={(e) => { e.stopPropagation(); if (open) onApply(); }}
        disabled={!open}
        aria-label={open ? "Apply Now" : "Intake closed"}
        title={open ? "Apply Now" : "Intake closed"}
        className={`flex h-8 w-8 shrink-0 self-center items-center justify-center rounded-full ${open ? "neu-btn-green" : "bg-neutral-200 text-neutral-400"}`}
      >
        <Send size={14} />
      </button>
    </div>
  );
}
