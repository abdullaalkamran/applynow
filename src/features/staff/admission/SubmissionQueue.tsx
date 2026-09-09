import { AlertCircle } from "lucide-react";
import { Table, StatusBadge, StatTile, PageHeader, Button, Badge } from "../../../components/ui";
import { STUDENTS, APPLICATIONS } from "../../../data/mockData";

export default function AdmissionSubmissionQueue() {
  const rows = APPLICATIONS.map((a) => ({ app: a, student: STUDENTS.find((s) => s.id === a.studentId)! }));
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
          <AlertCircle size={16} /> {deadlineRisk.length} application(s) at deadline risk — action required this week.
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Student", "University", "Intake", "Status", "Action"]}>
          {rows.map(({ app, student }) => (
            <tr key={app.id} className="hover:bg-slate-50">
              <td className="px-5 py-3 font-medium text-slate-800">{student.name}</td>
              <td className="px-5 py-3 text-slate-600">{app.university} <span className="text-slate-400">· {app.course}</span></td>
              <td className="px-5 py-3 text-slate-600">{app.intake}</td>
              <td className="px-5 py-3"><StatusBadge status={app.status} /></td>
              <td className="px-5 py-3">
                {app.status === "Compliance Hold" ? (
                  <Badge tone="red">Locked by Compliance</Badge>
                ) : (
                  <Button variant="secondary">Follow up</Button>
                )}
              </td>
            </tr>
          ))}
        </Table>
      </div>
    </div>
  );
}
