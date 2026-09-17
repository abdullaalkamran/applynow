// A university's own ordered admission/application steps, entered by Data Management — shown on
// the Overview tab of every role's University Detail page so applicants know what's next.
import type { University } from "../types";

export function AdmissionProcedureBlock({ university }: { university: University }) {
  const steps = university.admissionSteps ?? [];
  if (steps.length === 0) {
    return <p className="text-xs text-slate-400">No admission procedure added yet.</p>;
  }
  return (
    <ol className="space-y-2">
      {steps.map((step, i) => (
        <li key={step} className="flex items-start gap-2.5 rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-700">
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[var(--brand-500)] text-[10px] font-semibold text-white">
            {i + 1}
          </span>
          {step}
        </li>
      ))}
    </ol>
  );
}
