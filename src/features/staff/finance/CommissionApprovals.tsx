import { Table, StatusBadge, Button, PageHeader, StatTile, EmptyState } from "../../../components/ui";
import { loadAllInvoices, markInvoicePaid } from "../../../data/agentInvoicesStore";
import { loadStaff } from "../../../data/staffStore";

export default function FinanceCommissionApprovals() {
  const staff = loadStaff();
  const agents = staff.filter((m) => m.role === "agent");
  const invoices = loadAllInvoices(agents.map((a) => a.id));
  const issued = invoices.filter((i) => i.status === "Issued");
  const paid = invoices.filter((i) => i.status === "Paid");
  const total = (list: typeof invoices) => list.reduce((sum, i) => sum + i.totalAmount, 0);

  return (
    <div>
      <PageHeader title="Finance — Commission Invoices" subtitle="Invoices raised by agents for enrolled students." />
      <div className="mb-6 flex gap-4">
        <StatTile label="Awaiting payment" value={String(issued.length)} tone="amber" />
        <StatTile label="Outstanding" value={total(issued).toLocaleString()} tone="red" />
        <StatTile label="Paid" value={total(paid).toLocaleString()} tone="green" />
      </div>

      {invoices.length === 0 ? (
        <EmptyState title="No invoices yet" subtitle="When an agent invoices an enrolled student's commission it will show up here." />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table head={["Agent", "Students", "Lines", "Amount", "Status", "Action"]}>
            {invoices.map((inv) => (
              <tr key={inv.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 text-slate-600">{agents.find((a) => a.id === inv.agentId)?.name ?? "Agent"}</td>
                <td className="px-5 py-3 font-medium text-slate-800">{inv.lines.map((l) => l.studentName).join(", ")}</td>
                <td className="px-5 py-3 text-slate-600">{inv.lines.length}</td>
                <td className="px-5 py-3 text-slate-800">{inv.totalAmount.toLocaleString()}</td>
                <td className="px-5 py-3"><StatusBadge status={inv.status} /></td>
                <td className="px-5 py-3">
                  {inv.status === "Issued" && (
                    <Button onClick={() => { markInvoicePaid(inv.agentId, inv.id).catch((err) => console.warn("Failed to mark invoice paid:", err)); }}>
                      Mark paid
                    </Button>
                  )}
                </td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
