import { Table, StatusBadge, Button, PageHeader, StatTile } from "../../../components/ui";
import { COMMISSIONS, STUDENTS } from "../../../data/mockData";

export default function FinanceCommissionApprovals() {
  const pending = COMMISSIONS.filter((c) => c.status === "Pending");
  const disputed = COMMISSIONS.filter((c) => c.status === "Disputed");

  return (
    <div>
      <PageHeader title="Finance — Commission Approvals" subtitle="Finance can modify commission but cannot alter academic requirements." />
      <div className="mb-6 flex gap-4">
        <StatTile label="Pending Approval" value={String(pending.length)} tone="amber" />
        <StatTile label="Disputed" value={String(disputed.length)} tone="red" />
        <StatTile label="Paid this month" value="$1,450" tone="green" />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Agent", "Student", "University", "Amount", "Status", "Action"]}>
          {COMMISSIONS.map((c) => {
            const student = STUDENTS.find((s) => s.id === c.studentId)!;
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-600">{c.agentId === "a1" ? "Global Reach Consultants" : "EduBridge Partners"}</td>
                <td className="px-5 py-3 font-medium text-slate-800">{student.name}</td>
                <td className="px-5 py-3 text-slate-600">{c.university}</td>
                <td className="px-5 py-3 text-slate-800">${c.amount.toLocaleString()}</td>
                <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
                <td className="px-5 py-3">
                  {c.status === "Pending" && <Button>Approve</Button>}
                  {c.status === "Disputed" && <Button variant="secondary">Review dispute</Button>}
                </td>
              </tr>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
