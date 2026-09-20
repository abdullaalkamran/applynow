import { Award } from "lucide-react";
import type { CourseAccreditation } from "../types";

/** The bodies that accredit one specific course (entered on Data Management's course form) —
 * logo + name badges, rendered on the course's Overview across the student, agent and counsellor
 * portals. Renders nothing when the course has none. */
export function CourseAccreditations({ accreditations, className = "" }: { accreditations?: CourseAccreditation[]; className?: string }) {
  if (!accreditations?.length) return null;
  return (
    <div className={className}>
      <p className="flex items-center gap-1.5 text-[12px] font-semibold text-slate-700">
        <Award size={14} className="text-slate-400" /> Accredited by
      </p>
      <div className="mt-2 flex flex-wrap gap-2">
        {accreditations.map((a) => (
          <span key={a.name} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white py-1.5 pl-1.5 pr-3 text-[12px] font-medium text-slate-700">
            {a.logoUrl ? (
              <img src={a.logoUrl} alt={`${a.name} logo`} className="h-7 w-7 rounded-md object-contain" />
            ) : (
              <span className="flex h-7 w-7 items-center justify-center rounded-md bg-slate-100 text-[11px] font-semibold text-slate-500">
                {a.name.slice(0, 2).toUpperCase()}
              </span>
            )}
            {a.name}
          </span>
        ))}
      </div>
    </div>
  );
}
