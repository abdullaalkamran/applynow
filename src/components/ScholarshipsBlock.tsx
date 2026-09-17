// A university's named scholarships, each with its own award amount and eligibility note — the
// full detail behind the plain `scholarshipsAvailable` flag and the terser scholarshipAmountUSD()
// estimate shown elsewhere. Shown on the Overview tab of every role's University Detail page.
import type { University } from "../types";

export function ScholarshipsBlock({ university }: { university: University }) {
  const scholarships = university.scholarships ?? [];
  if (scholarships.length === 0) {
    return (
      <p className="text-xs text-slate-400">
        {university.scholarshipsAvailable ? "Scholarships available — no named awards listed yet." : "No scholarships added yet."}
      </p>
    );
  }
  return (
    <div className="space-y-2">
      {scholarships.map((s, i) => (
        <div key={i} className="rounded-lg bg-slate-50 px-3 py-2 text-xs">
          <div className="flex items-center justify-between">
            <span className="font-medium text-slate-700">{s.name}</span>
            <span className="font-semibold text-slate-800">{s.amount}</span>
          </div>
          {s.description && <p className="mt-1 text-slate-500">{s.description}</p>}
        </div>
      ))}
    </div>
  );
}
