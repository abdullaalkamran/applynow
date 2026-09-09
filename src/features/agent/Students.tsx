import { Table, Avatar, Badge, PageHeader, Button } from "../../components/ui";
import { STUDENTS, APPLICATIONS, CURRENT_AGENT_ID } from "../../data/mockData";

export default function AgentStudents() {
  const myStudents = STUDENTS.filter((s) => s.agentId === CURRENT_AGENT_ID);
  return (
    <div>
      <PageHeader title="My Students" subtitle="Own students only — record-level authorization enforced server-side." action={<Button>+ Register student</Button>} />
      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Student", "Country", "Applications", "Risk"]}>
          {myStudents.map((s) => {
            const count = APPLICATIONS.filter((a) => a.studentId === s.id).length;
            return (
              <tr key={s.id} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={s.name} colorClass={s.avatarColor} />
                    <div>
                      <p className="font-medium text-slate-800">{s.name}</p>
                      <p className="text-xs text-slate-400">{s.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3 text-slate-600">{s.country}</td>
                <td className="px-5 py-3 text-slate-600">{count}</td>
                <td className="px-5 py-3">
                  {s.riskFlag === "none" && <Badge tone="green">Clear</Badge>}
                  {s.riskFlag === "watch" && <Badge tone="amber">Watch</Badge>}
                  {s.riskFlag === "high" && <Badge tone="red">High risk</Badge>}
                </td>
              </tr>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
