import { Table, StatusBadge, ProgressBar, PageHeader } from "../../components/ui";
import { STUDENTS, APPLICATIONS, CURRENT_AGENT_ID } from "../../data/mockData";

export default function AgentApplications() {
  const myStudents = STUDENTS.filter((s) => s.agentId === CURRENT_AGENT_ID);
  const myApps = APPLICATIONS.filter((a) => myStudents.some((s) => s.id === a.studentId));

  return (
    <div>
      <PageHeader title="Application Tracking" subtitle="Track submission, decision and offer status across your students." />
      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Student", "University", "Status", "Progress"]}>
          {myApps.map((a) => {
            const student = STUDENTS.find((s) => s.id === a.studentId)!;
            return (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{student.name}</td>
                <td className="px-5 py-3 text-slate-600">{a.university} <span className="text-slate-400">· {a.course}</span></td>
                <td className="px-5 py-3"><StatusBadge status={a.status} /></td>
                <td className="px-5 py-3 w-40"><ProgressBar value={a.progress} size="sm" /></td>
              </tr>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
