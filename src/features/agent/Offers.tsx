import { useNavigate } from "react-router-dom";
import { StatusBadge, ProgressBar } from "../../components/ui";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { getAllApplications } from "../../data/applicationsStore";
import { agentStageFor } from "../../utils/agentPipeline";

export default function AgentOffers() {
  const navigate = useNavigate();
  const students = loadAgentStudents();
  const rows = getAllApplications()
    .filter((a) => students.some((s) => s.id === a.studentId) && agentStageFor(a.status) === "Offer")
    .map((app) => ({ app, student: students.find((s) => s.id === app.studentId)! }));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-base font-semibold text-slate-900">Offers</h1>
        <p className="mt-1 text-xs text-slate-500">{rows.length} student{rows.length === 1 ? "" : "s"} with an offer, conditions, or deposit stage application.</p>
      </div>

      <div className="space-y-2.5">
        {rows.map(({ app, student }) => (
          <button
            key={app.id}
            onClick={() => navigate(`/agent/students/${student.id}`)}
            className="block w-full rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.05)] transition hover:border-slate-200 hover:shadow-[0_2px_14px_rgba(0,0,0,0.08)]"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${student.avatarColor}`}>
                  {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0">
                  <p className="truncate text-xs font-medium text-slate-800">{student.name}</p>
                  <p className="truncate text-xs text-slate-500">{app.university} · {app.course}</p>
                </div>
              </div>
              <StatusBadge status={app.status} />
            </div>
            <div className="mt-3 flex items-center gap-2">
              <ProgressBar value={app.progress} size="sm" />
              <span className="shrink-0 text-[11px] text-slate-400">{app.progress}%</span>
            </div>
            <p className="mt-2 text-xs text-slate-500">{app.nextAction}</p>
          </button>
        ))}
        {rows.length === 0 && (
          <p className="py-10 text-center text-xs text-slate-400">No students have an offer in progress right now.</p>
        )}
      </div>
    </div>
  );
}
