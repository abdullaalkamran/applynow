import { AlertTriangle } from "lucide-react";
import { getUniversitiesLoadError, retryUniversities } from "../data/universityCatalogStore";

/** Shown when the university catalog couldn't be loaded (a slow or failing server), instead of a screen that sits empty or breaks.
 * Renders nothing when there is no problem. */
export function CatalogLoadNotice() {
  const error = getUniversitiesLoadError();
  if (!error) return null;
  return (
    <div role="alert" className="mb-4 flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-[13px] text-amber-900">
      <AlertTriangle size={16} className="shrink-0" />
      <p className="min-w-0 flex-1">We couldn't load the universities just now ({error}). The numbers below may be incomplete.</p>
      <button onClick={() => { void retryUniversities(); }} className="rounded-lg bg-amber-900 px-3 py-1.5 text-[12.5px] font-medium text-white">Try again</button>
    </div>
  );
}
