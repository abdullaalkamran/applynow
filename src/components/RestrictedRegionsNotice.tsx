// A prominent warning for regions/divisions this university won't accept applicants from — based
// on passport/permanent address or where the applicant studied. Shown plainly (not inside a
// collapsible ExpandableSection) since it's a hard eligibility gate someone shouldn't have to hunt
// for, unlike the other Overview info. Hides itself entirely when the list is empty.
import { AlertTriangle } from "lucide-react";
import type { University } from "../types";

export function RestrictedRegionsNotice({ university, className = "" }: { university: University; className?: string }) {
  const regions = university.restrictedRegions ?? [];
  if (regions.length === 0) return null;
  return (
    <div className={`rounded-2xl border border-amber-200 bg-amber-50 p-4 ${className}`}>
      <p className="flex items-center gap-1.5 text-sm font-semibold text-amber-800">
        <AlertTriangle size={15} /> Not accepting applicants from
      </p>
      <p className="mt-1 text-xs text-amber-700">
        Based on passport/permanent address or where you studied (education board or prior institution).
      </p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {regions.map((r) => (
          <span key={r} className="rounded-full bg-amber-100 px-2.5 py-1 text-xs font-medium text-amber-800">{r}</span>
        ))}
      </div>
    </div>
  );
}
