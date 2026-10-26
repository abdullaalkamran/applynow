import { useEffect, useState } from "react";
import { Table, Badge, PageHeader, EmptyState } from "../../components/ui";
import { ROLES } from "../../data/mockData";
import { apiGet } from "../../utils/apiClient";

interface AuditEntry {
  id: string;
  actor: string;
  role: string;
  action: string;
  target: string;
  detail: string;
  timestamp: string;
}

export default function AdminAuditLogs() {
  const [entries, setEntries] = useState<AuditEntry[] | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiGet<AuditEntry[]>("/api/applications/audit-log")
      .then((rows) => { if (!cancelled) setEntries(rows); })
      .catch((err) => { if (!cancelled) setError(err instanceof Error ? err.message : "Couldn't load the audit log."); });
    return () => { cancelled = true; };
  }, []);

  return (
    <div>
      <PageHeader title="Audit Logs" subtitle="The latest status, stage, assignment and document events across every application." />
      {error ? (
        <EmptyState title="Couldn't load the audit log" subtitle={error} />
      ) : entries === null ? (
        <p className="text-sm text-slate-400">Loading…</p>
      ) : entries.length === 0 ? (
        <EmptyState title="Nothing recorded yet" subtitle="Events appear here as applications are worked on." />
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <Table head={["Actor", "Role", "Action", "Target", "When"]}>
            {entries.map((a) => (
              <tr key={a.id} className="hover:bg-slate-50">
                <td className="px-5 py-3 font-medium text-slate-800">{a.actor}</td>
                <td className="px-5 py-3"><Badge tone="blue">{ROLES.find((r) => r.id === a.role)?.label ?? a.role}</Badge></td>
                <td className="px-5 py-3 text-slate-600">{a.action}{a.detail ? <span className="text-slate-400"> · {a.detail}</span> : null}</td>
                <td className="px-5 py-3 text-slate-600">{a.target}</td>
                <td className="px-5 py-3 text-xs text-slate-400">{new Date(a.timestamp).toLocaleString()}</td>
              </tr>
            ))}
          </Table>
        </div>
      )}
    </div>
  );
}
