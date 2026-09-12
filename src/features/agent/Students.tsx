import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Plus, ListChecks } from "lucide-react";
import { Badge, Button } from "../../components/ui";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { getAllApplications } from "../../data/applicationsStore";
import { getAgentTasks } from "../../utils/taskBoard";
import { CURRENT_AGENT_ID } from "../../data/mockData";
import { formatStudentId } from "../../utils/displayId";

export default function AgentStudents() {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const students = loadAgentStudents();
  const allApps = getAllApplications();
  const tasks = getAgentTasks(CURRENT_AGENT_ID);

  const filtered = students.filter((s) => {
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q) || s.country.toLowerCase().includes(q) || formatStudentId(s.id).toLowerCase().includes(q);
  });

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">My Students</h1>
          <p className="mt-1 text-xs text-slate-500">Own students only — record-level authorization enforced server-side.</p>
        </div>
        <Button onClick={() => navigate("/agent/students/new")} className="shrink-0 text-xs px-3 py-1.5">
          <Plus size={13} /> Register Student
        </Button>
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 max-w-sm">
        <Search size={14} className="shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, country, or ID…"
          className="w-full min-w-0 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="space-y-2.5">
        {filtered.map((s) => {
          const count = allApps.filter((a) => a.studentId === s.id).length;
          const studentTasks = tasks.filter((t) => t.studentId === s.id);
          const openTasks = studentTasks.filter((t) => !t.done);
          return (
            <button
              key={s.id}
              onClick={() => navigate(`/agent/students/${s.id}`)}
              className="flex w-full flex-col gap-2.5 rounded-2xl border border-slate-100 bg-white p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.05)] transition hover:border-slate-200 hover:shadow-[0_2px_14px_rgba(0,0,0,0.08)]"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${s.avatarColor}`}>
                  {s.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <p className="truncate text-xs font-medium text-slate-800">{s.name}</p>
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                      {formatStudentId(s.id)}
                    </span>
                  </div>
                  <p className="truncate text-xs text-slate-400">{s.email} · {s.country}</p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {openTasks.length > 0 && (
                  <span className="flex items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                    <ListChecks size={11} /> {openTasks.length} task{openTasks.length === 1 ? "" : "s"}
                  </span>
                )}
                <span className="text-xs text-slate-500">{count} application{count === 1 ? "" : "s"}</span>
                {s.riskFlag === "none" && <Badge tone="green">Clear</Badge>}
                {s.riskFlag === "watch" && <Badge tone="amber">Watch</Badge>}
                {s.riskFlag === "high" && <Badge tone="red">High risk</Badge>}
              </div>
            </button>
          );
        })}
        {filtered.length === 0 && (
          <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-8 text-center text-xs text-slate-400">
            No students match this search.
          </p>
        )}
      </div>
    </div>
  );
}
