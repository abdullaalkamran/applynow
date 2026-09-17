// A university's full intake calendar — every offered month, whether it's currently open for
// applications, and its application/CAS/enrollment deadlines. Shown on the Overview tab of every
// role's University Detail page so the single `openIntake` chip elsewhere isn't the only place
// this shows — that chip only ever surfaces the first open month for backward compatibility.
import type { University } from "../types";

function formatDate(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function IntakesBlock({ university }: { university: University }) {
  if (university.intakes.length === 0) {
    return <p className="text-xs text-slate-400">No intakes added yet.</p>;
  }
  return (
    <div className="space-y-2">
      {university.intakes.map((m) => {
        const open = university.intakeStatus?.[m] ?? false;
        const dates = university.intakeDates?.[m];
        const hasDates = dates && (dates.applicationDeadline || dates.casRequestDeadline || dates.enrollmentDate);
        return (
          <div key={m} className="rounded-lg bg-slate-50 px-3 py-2">
            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${open ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"}`}>
              {m} · {open ? "Open" : "Closed"}
            </span>
            {hasDates && (
              <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                {dates!.applicationDeadline && (
                  <span>Application last date: <span className="font-medium text-slate-700">{formatDate(dates!.applicationDeadline)}</span></span>
                )}
                {dates!.casRequestDeadline && (
                  <span>CAS request last date: <span className="font-medium text-slate-700">{formatDate(dates!.casRequestDeadline)}</span></span>
                )}
                {dates!.enrollmentDate && (
                  <span>Enrollment date: <span className="font-medium text-slate-700">{formatDate(dates!.enrollmentDate)}</span></span>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
