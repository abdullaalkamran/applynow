// A collapsible info card for the University Detail Overview tab — collapsed by default (just the
// title bar), hovering reveals a one-line preview via a pure CSS max-height transition (degrades
// gracefully to nothing on touch devices, which don't hover), and clicking locks it fully open.
// Clicking again collapses it back. Used across every role's University Detail page so the many
// stacked Overview sections (Why study here, Subjects, Campuses, Intakes, Scholarships, Deposit,
// Admission Procedure) don't turn the page into one long unreadable scroll by default.
import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";

export function ExpandableSection({
  icon, title, preview, children, className = "", bodyClassName = "", defaultExpanded = false,
}: {
  icon?: ReactNode;
  title: string;
  // A short one-line summary shown on hover while collapsed — omit to skip the hover peek (e.g.
  // when the section has nothing worth summarizing, like an empty list).
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
        className="flex w-full items-center justify-between gap-2 px-4 py-3.5 text-left"
      >
        <span className="flex items-center gap-1.5 text-sm font-semibold text-slate-900">{icon}{title}</span>
        <ChevronDown size={16} className={`shrink-0 text-slate-400 transition-transform ${expanded ? "rotate-180" : ""}`} />
      </button>
      {!expanded && preview && (
        <div className="max-h-0 overflow-hidden px-4 transition-all duration-200 group-hover:max-h-16 group-hover:pb-3.5">
          <p className="truncate text-xs text-slate-400">{preview}</p>
        </div>
      )}
      {expanded && <div className={`px-4 pb-4 ${bodyClassName}`}>{children}</div>}
    </div>
  );
}
