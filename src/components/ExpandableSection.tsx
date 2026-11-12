// A collapsible info card for the University Detail Overview tab — collapsed by default (just the
// title bar), hovering reveals the full details via a pure CSS grid-rows transition (content always in the DOM for SEO/AEO) (degrades
// gracefully to nothing on touch devices, which don't hover), and clicking locks it fully open.
// Clicking again collapses it back. Used across every role's University Detail page so the many
// stacked Overview sections (Why study here, Subjects, Campuses, Intakes, Scholarships, Deposit,
// Admission Procedure) don't turn the page into one long unreadable scroll by default.
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function ExpandableSection({
  icon, title, children, className = "", bodyClassName = "", defaultExpanded = false,
}: {
  icon?: ReactNode;
  title: string;
  // A short one-line summary shown on hover while collapsed — omit to skip the hover peek (e.g.
  // when the section has nothing worth summarizing, like an empty list).
  // Kept for call-site compatibility; the full details now show on hover, so a summary line is no longer needed.
  preview?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
  // Starts open instead of collapsed — for information someone shouldn't have to hunt for, like
  // deposit/payment terms, while still letting them collapse it away if they want to.
  defaultExpanded?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultExpanded);
  return (
    <div className={`group overflow-hidden rounded-2xl ${className}`}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-4 text-left sm:px-5"
      >
        <span className="flex items-center gap-4 text-[15px] font-semibold text-neutral-900">
          {icon && <span className="shrink-0 text-neutral-900 [&>svg]:h-5 [&>svg]:w-5">{icon}</span>}
          {title}
        </span>
        <ChevronDown size={18} className={`shrink-0 text-neutral-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {/* The full content is ALWAYS in the DOM (so crawlers and AI answer engines read it — SEO/AEO); collapsing is purely
          visual via a 0fr grid row. Hovering or focusing the card previews the full details; clicking locks it open. */}
      <div className={`grid transition-[grid-template-rows] duration-200 ${expanded ? "grid-rows-[1fr]" : "grid-rows-[0fr] group-hover:grid-rows-[1fr] group-focus-within:grid-rows-[1fr]"}`}>
        <div className="min-h-0 overflow-hidden">
          <div className={`px-4 pb-4 sm:px-5 ${bodyClassName}`}>{children}</div>
        </div>
      </div>
    </div>
  );
}
