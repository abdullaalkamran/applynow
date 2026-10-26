import { getAllApplications, sortByCreatedAscending } from "../data/applicationsStore";
import { loadStudentComments } from "../data/studentCommentsStore";
import { ApplicationCommentsCard } from "./ApplicationJourneyPanel";
import { usePreservedState } from "../utils/syncCache";

/** The Comments tab on a student's profile for counsellors and agents. Comments belong to an
 * APPLICATION — the same thread the student sees on that application's Comments tab — so a reply
 * from any of them reaches the others. (This tab used to hold a separate, profile-wide thread that
 * the student never saw, so counsellor/agent comments and student comments never met.) */
export function StudentApplicationComments({ studentId }: { studentId: string }) {
  const apps = sortByCreatedAscending(getAllApplications().filter((a) => a.studentId === studentId));
  const [selected, setSelected] = usePreservedState(`student-comments:${studentId}`, "");
  const active = apps.find((a) => a.id === selected) ?? apps[0];
  // Notes posted before comments moved onto applications — kept readable, no longer written to.
  const earlier = loadStudentComments(studentId);

  if (apps.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-slate-200 p-6 text-center text-[12.5px] text-slate-400">
        No applications yet — comments are added on an application.
      </p>
    );
  }

  return (
    <div>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {apps.map((a) => (
          <button
            key={a.id}
            onClick={() => setSelected(a.id)}
            className={`max-w-full truncate rounded-full border px-3 py-1.5 text-[12px] font-medium ${
              a.id === active?.id ? "border-[var(--sd-ink)] bg-[var(--sd-ink)] text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {a.university} — {a.course}
          </button>
        ))}
      </div>

      {active && (
        <>
          <p className="mb-2 text-xs text-slate-400">
            Shared with the student, their counsellor, admission officer and agent — posting notifies each of them.
          </p>
          <ApplicationCommentsCard applicationId={active.id} />
        </>
      )}

      {earlier.length > 0 && (
        <div className="mt-5 border-t border-slate-100 pt-4">
          <p className="mb-2 text-xs font-semibold text-slate-500">Earlier case notes</p>
          <div className="max-h-48 space-y-2 overflow-y-auto pr-1">
            {earlier.map((c) => (
              <div key={c.id} className="rounded-lg bg-slate-50 p-2.5">
                <p className="text-[12.5px] text-slate-700">{c.notes}</p>
                <p className="mt-1 text-[11px] text-slate-400">{c.performedBy.name} ({c.performedBy.role}) — {new Date(c.timestamp).toLocaleString()}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
