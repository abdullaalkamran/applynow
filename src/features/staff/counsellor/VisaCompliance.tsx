import { useNavigate } from "react-router-dom";
import { ShieldCheck, ShieldAlert } from "lucide-react";
import { StatusBadge } from "../../../components/ui";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { activeApplicationsFor, VISA_BUCKET_STATUSES } from "../../../utils/counsellorData";

function daysSince(dateStr: string): number {
  return Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
}

export default function CounsellorVisaCompliance() {
  const navigate = useNavigate();
  const assigned = loadAssignedStudents();
  const rows = assigned.flatMap((s) => activeApplicationsFor(s.id).map((a) => ({ student: s, app: a })));

  const visaRows = rows.filter(({ app }) => VISA_BUCKET_STATUSES.has(app.status));
  const complianceRows = rows.filter(({ app }) => app.status === "Compliance Hold");

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Visa & Compliance</h1>
        <p className="mt-1 text-sm text-slate-500">Applications in a visa stage or under compliance review.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <ShieldCheck size={15} className="text-violet-500" />
            <p className="text-sm font-semibold text-slate-800">Visa in Process ({visaRows.length})</p>
          </div>
          <div className="divide-y divide-slate-50">
            {visaRows.map(({ student, app }) => (
              <button
                key={app.id}
                onClick={() => navigate(`/staff/counsellor/students/${student.id}`)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${student.avatarColor}`}>
                  {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{student.name}</p>
                  <p className="truncate text-xs text-slate-400">{app.university} · {daysSince(app.updatedAt)}d since update</p>
                </div>
                <StatusBadge status={app.status} />
              </button>
            ))}
            {visaRows.length === 0 && <p className="px-5 py-6 text-sm text-slate-400">No students currently in a visa stage.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <ShieldAlert size={15} className="text-rose-500" />
            <p className="text-sm font-semibold text-slate-800">Compliance Holds ({complianceRows.length})</p>
          </div>
          <div className="divide-y divide-slate-50">
            {complianceRows.map(({ student, app }) => (
              <button
                key={app.id}
                onClick={() => navigate(`/staff/counsellor/students/${student.id}`)}
                className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
              >
                <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${student.avatarColor}`}>
                  {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{student.name}</p>
                  <p className="truncate text-xs text-slate-400">{app.nextAction}</p>
                </div>
                <StatusBadge status={app.status} />
              </button>
            ))}
            {complianceRows.length === 0 && <p className="px-5 py-6 text-sm text-slate-400">No compliance holds on your students right now.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
