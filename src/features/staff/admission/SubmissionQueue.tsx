import { AlertCircle } from "lucide-react";
import { Table, StatusBadge, StatTile, PageHeader, Badge, EmptyState } from "../../../components/ui";
import { getAllApplications } from "../../../data/applicationsStore";
import { getAllStudents } from "../../../data/allStudentsStore";

const CLOSED = new Set(["Withdrawn", "Rejected", "Deferred", "Enrolled"]);

export default function AdmissionSubmissionQueue() {
  const students = getAllStudents();
  // Real applications only — nothing is seeded. Closed ones drop out of the working queue.
  const rows = getAllApplications()
    .filter((a) => !CLOSED.has(a.status))
    .map((app) => ({ app, studentName: students.find((s) => s.id === app.studentId)?.name ?? "Unknown student" }));
  const deadlineRisk = rows.filter((r) => r.app.status === "Additional Documents Requested" || r.app.status === "Documents Pending");

  return (
    <div>
      <PageHeader title="Admission — Submission Queue" subtitle="Processing, submission, university follow-up and deadlines." />
      <div className="mb-6 flex gap-4">
        <StatTile label="In Queue" value={String(rows.length)} />
        <StatTile label="Deadline Risk" value={String(deadlineRisk.length)} tone="amber" />
        <StatTile label="On Compliance Hold" value={String(rows.filter((r) => r.app.status === "Compliance Hold").length)} tone="red" />
      </div>

      {deadlineRisk.length > 0 && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <AlertCircle size={16} /> {deadlineRisk.length} application(s) waiting on documents.
        </div>
      )}

      {rows.length === 0 ? (
        <EmptyState title="No applications in the queue" subtitle="Submitted applications will appear here." />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table head={["Student", "University", "Intake", "Status", "Next action"]}>
            {rows.map(({ app, studentName }) => (
              <tr key={app.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{studentName}</td>
                <td className="px-5 py-3 text-slate-600">{app.university} <span className="text-slate-400">· {app.course}</span></td>
                <td className="px-5 py-3 text-slate-600">{app.intake}</td>
                <td className="px-5 py-3"><StatusBadge status={app.status} /></td>
                <td className="px-5 py-3 text-slate-600">
                  {app.status === "Compliance Hold" ? <Badge tone="red">Locked by Compliance</Badge> : app.nextAction}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
