import { Table, StatusBadge, StatTile, PageHeader } from "../../components/ui";
import { COMMISSIONS, STUDENTS, CURRENT_AGENT_ID } from "../../data/mockData";

export default function AgentCommissions() {
  const rows = COMMISSIONS.filter((c) => c.agentId === CURRENT_AGENT_ID);
  const paid = rows.filter((r) => r.status === "Paid").reduce((s, r) => s + r.amount, 0);
  const pending = rows.filter((r) => r.status === "Pending" || r.status === "Approved").reduce((s, r) => s + r.amount, 0);
  const expected = rows.filter((r) => r.status === "Expected").reduce((s, r) => s + r.amount, 0);

  return (
    <div>
      <PageHeader title="Commission Dashboard" subtitle="Lifecycle: Not Eligible → Expected → Pending → Approved → Invoiced → Paid." />
      <div className="mb-6 flex gap-4">
        <StatTile label="Paid (YTD)" value={`$${paid.toLocaleString()}`} tone="green" />
        <StatTile label="Pending / Approved" value={`$${pending.toLocaleString()}`} />
        <StatTile label="Expected" value={`$${expected.toLocaleString()}`} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Student", "University", "Milestone", "Amount", "Status"]}>
          {rows.map((c) => {
            const student = STUDENTS.find((s) => s.id === c.studentId)!;
            return (
              <tr key={c.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{student.name}</td>
                <td className="px-5 py-3 text-slate-600">{c.university}</td>
                <td className="px-5 py-3 text-slate-600">{c.milestone}</td>
                <td className="px-5 py-3 text-slate-800">${c.amount.toLocaleString()} {c.currency}</td>
                <td className="px-5 py-3"><StatusBadge status={c.status} /></td>
              </tr>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
