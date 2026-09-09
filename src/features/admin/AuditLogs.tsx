import { Table, Badge, PageHeader } from "../../components/ui";
import { AUDIT_LOG, ROLES } from "../../data/mockData";

export default function AdminAuditLogs() {
  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="Every role/permission change, freeze, publish and approval is recorded." />
      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["Actor", "Role", "Action", "Target", "Timestamp"]}>
          {AUDIT_LOG.map((a) => {
            const roleMeta = ROLES.find((r) => r.id === a.role)!;
            return (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{a.actor}</td>
                <td className="px-5 py-3"><Badge tone="blue">{roleMeta.label}</Badge></td>
                <td className="px-5 py-3 text-slate-600">{a.action}</td>
                <td className="px-5 py-3 text-slate-600">{a.target}</td>
                <td className="px-5 py-3 text-xs text-slate-400">{a.timestamp}</td>
              </tr>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
