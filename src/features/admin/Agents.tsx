import { useState } from "react";
import { Search, Users2, Sparkles, CheckCircle2, FileText, Wallet, Printer } from "lucide-react";
import { Badge, Button, Avatar, Modal, PageHeader, StatTile, EmptyState } from "../../components/ui";
import { loadStaff, type StaffMember } from "../../data/staffStore";
import { getAllStudents } from "../../data/allStudentsStore";
import { getAllApplications } from "../../data/applicationsStore";
import { commissionFor } from "../../utils/commissionEngine";
import { loadInvoicesFor, markInvoicePaid } from "../../data/agentInvoicesStore";
import { useHoldCacheSync } from "../../utils/syncCache";
import { formatStudentId } from "../../utils/displayId";

/** Real per-agent commission totals — same computation the agent's own Finance page
 * (features/agent/Commissions.tsx) already does client-side from real Application+CommissionRate
 * data, just run here for an arbitrary agent instead of "the current one". */
function commissionSummaryFor(agentId: string, students: ReturnType<typeof getAllStudents>, applications: ReturnType<typeof getAllApplications>) {
  const studentIds = new Set(students.filter((s) => s.agentId === agentId).map((s) => s.id));
  const apps = applications.filter((a) => studentIds.has(a.studentId));
  const commissions = apps.map((app) => ({ app, commission: commissionFor(app) }));
  const invoices = loadInvoicesFor(agentId);
  const claimedIds = new Set(invoices.flatMap((inv) => inv.lines.map((l) => l.applicationId)));
  const totalEstimated = commissions.reduce((s, c) => s + c.commission.totalAmount, 0);
  const claimableTotal = commissions.filter((c) => c.commission.claimable && !claimedIds.has(c.app.id)).reduce((s, c) => s + c.commission.totalAmount, 0);
  const invoicedTotal = invoices.filter((i) => i.status === "Issued").reduce((s, i) => s + i.totalAmount, 0);
  const paidTotal = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + i.totalAmount, 0);
  return { totalEstimated, claimableTotal, invoicedTotal, paidTotal, applicationCount: apps.length };
}

export default function AdminAgents() {
  const [query, setQuery] = useState("");
  const [managingId, setManagingId] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const agents = loadStaff().filter((m) => m.role === "agent");
  const students = getAllStudents();
  const applications = getAllApplications();

  const q = query.trim().toLowerCase();
  const filtered = agents.filter((a) => !q || [a.name, a.email, a.organization ?? ""].some((v) => v.toLowerCase().includes(q)));

  const studentCountFor = (agentId: string) => students.filter((s) => s.agentId === agentId).length;
  const totalStudentsReferred = students.filter((s) => s.agentId).length;
  const totalPaid = agents.reduce((sum, a) => sum + commissionSummaryFor(a.id, students, applications).paidTotal, 0);

  const managing = agents.find((a) => a.id === managingId) ?? null;

  return (
    <div>
      <PageHeader
        title="Agents"
        subtitle="Every agent on the platform — their students, live commission totals, and real invoice/statement history."
      />

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatTile label="Total agents" value={String(agents.length)} />
        <StatTile label="Students referred" value={String(totalStudentsReferred)} />
        <StatTile label="Active" value={String(agents.filter((a) => a.status === "Active").length)} tone="green" />
        <StatTile label="Total paid out" value={`$${totalPaid.toLocaleString()}`} tone="blue" />
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:max-w-sm">
        <Search size={14} className="shrink-0 text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email or organization…"
          className="w-full min-w-0 bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          title={agents.length === 0 ? "No agents yet" : "No agents match this search"}
          subtitle={agents.length === 0 ? "Invite one from Teams & Roles' \"+ Invite agent\" button." : "Try a different search."}
        />
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Agent</th>
                <th className="px-5 py-3 font-medium">Organization</th>
                <th className="px-5 py-3 font-medium">Referral Code</th>
                <th className="px-5 py-3 font-medium">Students</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((a) => (
                <tr key={a.id} className="hover:bg-slate-50">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <Avatar name={a.name} colorClass={a.avatarColor} />
                      <div>
                        <p className="font-medium text-slate-800">{a.name}</p>
                        <p className="text-xs text-slate-400">{a.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-5 py-3 text-slate-700">{a.organization || <span className="text-slate-400">—</span>}</td>
                  <td className="px-5 py-3 font-mono text-xs text-slate-500">{a.referralCode || <span className="font-sans text-slate-400">—</span>}</td>
                  <td className="px-5 py-3 text-slate-700">{studentCountFor(a.id)}</td>
                  <td className="px-5 py-3">
                    <Badge tone={a.status === "Active" ? "green" : a.status === "Invited" ? "amber" : "neutral"}>{a.status}</Badge>
                  </td>
                  <td className="px-5 py-3">
                    <button onClick={() => setManagingId(a.id)} className="text-sm font-medium text-[var(--brand-600)]">
                      Manage
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {managing && (
        <AgentDetailModal
          agent={managing}
          students={students.filter((s) => s.agentId === managing.id)}
          onClose={() => setManagingId(null)}
          onChanged={() => forceTick((t) => t + 1)}
        />
      )}
    </div>
  );
}

function AgentDetailModal({
  agent, students, onClose, onChanged,
}: {
  agent: StaffMember;
  students: ReturnType<typeof getAllStudents>;
  onClose: () => void;
  onChanged: () => void;
}) {
  // Keep the 12s background poll from closing this out from under the admin mid-review — see
  // syncCache.ts's own doc comment on useHoldCacheSync.
  useHoldCacheSync();

  const applications = getAllApplications();
  const summary = commissionSummaryFor(agent.id, [...students], applications);
  const invoices = [...loadInvoicesFor(agent.id)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  async function handleMarkPaid(invoiceId: string) {
    await markInvoicePaid(agent.id, invoiceId);
    onChanged();
  }

  return (
    <Modal title={agent.name} onClose={onClose}>
      <div className="space-y-4">
        <div className="text-sm text-slate-600">
          <p>{agent.email}</p>
          {agent.organization && <p className="text-slate-400">{agent.organization}</p>}
          {agent.referralCode && <p className="mt-1 font-mono text-xs text-slate-500">Referral code: {agent.referralCode}</p>}
        </div>

        <div>
          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Users2 size={13} /> Students ({students.length})
          </p>
          {students.length === 0 ? (
            <p className="text-xs text-slate-400">No students referred yet.</p>
          ) : (
            <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg bg-slate-50 p-2">
              {students.map((s) => (
                <div key={s.id} className="flex items-center justify-between gap-2 rounded-md px-2 py-1 text-xs">
                  <span className="truncate text-slate-700">{s.name}</span>
                  <span className="font-mono text-slate-400">{formatStudentId(s.id)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">Commission Summary</p>
          <div className="grid grid-cols-2 gap-2">
            <MiniStat icon={<Sparkles size={12} />} tone="bg-violet-50 text-violet-600" label="Estimated" value={summary.totalEstimated} />
            <MiniStat icon={<CheckCircle2 size={12} />} tone="bg-emerald-50 text-emerald-600" label="Claimable" value={summary.claimableTotal} />
            <MiniStat icon={<FileText size={12} />} tone="bg-amber-50 text-amber-600" label="Invoiced" value={summary.invoicedTotal} />
            <MiniStat icon={<Wallet size={12} />} tone="bg-blue-50 text-blue-600" label="Paid" value={summary.paidTotal} />
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-semibold text-slate-700">Statements &amp; Invoices ({invoices.length})</p>
          {invoices.length === 0 ? (
            <p className="text-xs text-slate-400">No invoices generated yet.</p>
          ) : (
            <div className="max-h-56 space-y-2 overflow-y-auto">
              {invoices.map((inv) => (
                <div key={inv.id} className="rounded-lg border border-slate-100 bg-white p-2.5 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <p className="truncate font-semibold text-slate-800">{inv.id}</p>
                    <Badge tone={inv.status === "Paid" ? "blue" : "amber"}>{inv.status}</Badge>
                  </div>
                  <p className="mt-0.5 text-slate-400">{inv.createdAt} · {inv.lines.length} line{inv.lines.length === 1 ? "" : "s"}</p>
                  <div className="mt-1.5 flex items-center justify-between gap-2">
                    <span className="font-semibold text-slate-900">${inv.totalAmount.toLocaleString()}</span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => window.print()} className="flex items-center gap-1 text-slate-400 hover:text-slate-600" aria-label="Print">
                        <Printer size={12} />
                      </button>
                      {inv.status === "Issued" && (
                        <Button onClick={() => handleMarkPaid(inv.id)}>Mark Paid</Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function MiniStat({ icon, tone, label, value }: { icon: React.ReactNode; tone: string; label: string; value: number }) {
  return (
    <div className="rounded-lg border border-slate-100 p-2.5">
      <div className={`flex h-6 w-6 items-center justify-center rounded-md ${tone}`}>{icon}</div>
      <p className="mt-1.5 text-sm font-bold text-slate-900">${value.toLocaleString()}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
