import { Link } from "react-router-dom";
import { Card, CardBody, CardHeader, StatTile, StatusBadge, Avatar } from "../../components/ui";
import { STUDENTS, COMMISSIONS, CURRENT_AGENT_ID } from "../../data/mockData";
import { getAllApplications } from "../../data/applicationsStore";

export default function AgentDashboard() {
  const myStudents = STUDENTS.filter((s) => s.agentId === CURRENT_AGENT_ID);
  const myApps = getAllApplications().filter((a) => myStudents.some((s) => s.id === a.studentId));
  const myCommissions = COMMISSIONS.filter((c) => c.agentId === CURRENT_AGENT_ID);
  const pipelineValue = myCommissions.filter((c) => c.status !== "Paid").reduce((sum, c) => sum + c.amount, 0);

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm text-slate-500">Agent portal</p>
        <h1 className="text-2xl font-semibold text-slate-900">Global Reach Consultants</h1>
      </div>

      <div className="flex gap-4">
        <StatTile label="My Students" value={String(myStudents.length)} />
        <StatTile label="Active Applications" value={String(myApps.length)} />
        <StatTile label="Pipeline Commission" value={`$${pipelineValue.toLocaleString()}`} tone="green" />
      </div>

      <Card>
        <CardHeader title="Recent applications" action={<Link to="/agent/applications" className="text-sm font-medium text-[var(--brand-600)]">View all</Link>} />
        <CardBody className="space-y-3">
          {myApps.slice(0, 4).map((a) => {
            const student = STUDENTS.find((s) => s.id === a.studentId)!;
            return (
              <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3">
                  <Avatar name={student.name} colorClass={student.avatarColor} />
                  <div>
                    <p className="text-sm font-medium text-slate-800">{student.name}</p>
                    <p className="text-xs text-slate-500">{a.university} · {a.course}</p>
                  </div>
                </div>
                <StatusBadge status={a.status} />
              </div>
            );
          })}
        </CardBody>
      </Card>

      <Card>
        <CardHeader title="AI Agent Assistant" subtitle="Limited to your own student data" />
        <CardBody>
          <p className="text-sm text-slate-600">2 of your students have a pending document requirement expiring within 5 days. Tomiwa Adeyemi needs an updated IELTS score for University of Toronto.</p>
        </CardBody>
      </Card>
    </div>
  );
}
