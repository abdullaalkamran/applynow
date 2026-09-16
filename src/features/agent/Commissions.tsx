import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Wallet, Landmark, CheckCircle2, FileText, Sparkles, ArrowRight } from "lucide-react";
import { LogoBadge } from "../../components/ui/mobile";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { getAllApplications } from "../../data/applicationsStore";
import { CURRENT_AGENT_ID } from "../../data/mockData";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { commissionFor } from "../../utils/commissionEngine";
import { getCommissionRate } from "../../data/commissionRatesStore";
import { loadClaimedApplicationIds, loadInvoicesFor, createInvoice } from "../../data/agentInvoicesStore";
import { formatStudentId, formatApplicationId } from "../../utils/displayId";

export default function AgentCommissions() {
  const navigate = useNavigate();
  const UNIVERSITIES = getAllUniversities();
  const students = loadAgentStudents();
  const apps = getAllApplications().filter((a) => students.some((s) => s.id === a.studentId));
  const claimedIds = loadClaimedApplicationIds(CURRENT_AGENT_ID);
  const invoices = loadInvoicesFor(CURRENT_AGENT_ID);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [, forceTick] = useState(0);

  const invoiceByApp = new Map<string, (typeof invoices)[number]>();
  invoices.forEach((inv) => inv.lines.forEach((l) => invoiceByApp.set(l.applicationId, inv)));

  const rows = apps
    .map((app) => ({ app, student: students.find((s) => s.id === app.studentId)!, commission: commissionFor(app) }))
    .sort((a, b) => b.app.updatedAt.localeCompare(a.app.updatedAt));

  const totalEstimated = rows.reduce((s, r) => s + r.commission.totalAmount, 0);
  const claimableRows = rows.filter((r) => r.commission.claimable && !claimedIds.has(r.app.id));
  const claimableTotal = claimableRows.reduce((s, r) => s + r.commission.totalAmount, 0);
  const invoicedTotal = invoices.filter((i) => i.status === "Issued").reduce((s, i) => s + i.totalAmount, 0);
  const paidTotal = invoices.filter((i) => i.status === "Paid").reduce((s, i) => s + i.totalAmount, 0);

  const universityRates = UNIVERSITIES
    .map((u) => ({ university: u, rate: getCommissionRate(u.id) }))
    .sort((a, b) => (b.rate.ratePercent + b.rate.bonusPercent) - (a.rate.ratePercent + a.rate.bonusPercent));

  function toggleSelect(appId: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(appId)) next.delete(appId); else next.add(appId);
      return next;
    });
  }

  function generateInvoice() {
    const lines = rows
      .filter((r) => selected.has(r.app.id))
      .map((r) => ({ applicationId: r.app.id, studentName: r.student.name, university: r.app.university, course: r.app.course, amount: r.commission.totalAmount }));
    createInvoice(CURRENT_AGENT_ID, lines);
    setSelected(new Set());
    forceTick((t) => t + 1);
  }

  return (
    <div className="pb-20">
      <div className="mb-6">
        <h1 className="text-base font-semibold text-slate-900">Finance</h1>
        <p className="mt-1 text-xs text-slate-500">Commission rates, estimated earnings, and invoicing for your students.</p>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard icon={<Sparkles size={14} />} tone="bg-violet-50 text-violet-600" label="Total Estimated" value={`$${totalEstimated.toLocaleString()}`} />
        <StatCard icon={<CheckCircle2 size={14} />} tone="bg-emerald-50 text-emerald-600" label="Claimable Now" value={`$${claimableTotal.toLocaleString()}`} />
        <StatCard icon={<FileText size={14} />} tone="bg-amber-50 text-amber-600" label="Invoiced" value={`$${invoicedTotal.toLocaleString()}`} />
        <StatCard icon={<Wallet size={14} />} tone="bg-blue-50 text-blue-600" label="Paid" value={`$${paidTotal.toLocaleString()}`} />
      </div>

      <div className="mb-5 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
        <div className="mb-3 flex items-center gap-1.5">
          <Landmark size={14} className="text-slate-400" />
          <p className="text-xs font-semibold text-slate-800">Commission Rates by University</p>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {universityRates.map(({ university, rate }) => (
            <div key={university.id} className="flex items-center gap-2.5 rounded-xl border border-slate-100 p-2.5">
              <LogoBadge name={university.name} tone={university.tone} logoUrl={university.logoUrl} className="h-9 w-9 shrink-0 text-[11px]" />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[11.5px] font-medium text-slate-800">{university.name}</p>
                <div className="mt-0.5 flex flex-wrap items-center gap-1">
                  <span className="text-[11px] font-semibold text-slate-700">{rate.ratePercent}%</span>
                  {rate.bonusPercent > 0 && (
                    <span className="flex items-center gap-1 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-emerald-700">
                      +{rate.bonusPercent}% {rate.bonusLabel}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.05)]">
        <div className="flex items-center justify-between gap-2 p-4 pb-0">
          <p className="text-xs font-semibold text-slate-800">Your Commissions</p>
          <p className="text-[11px] text-slate-400">Only enrolled students can be invoiced</p>
        </div>
        <div className="divide-y divide-slate-50">
          {rows.map(({ app, student, commission }) => {
            const invoice = invoiceByApp.get(app.id);
            const university = UNIVERSITIES.find((u) => u.id === commission.universityId);
            const canSelect = commission.claimable && !claimedIds.has(app.id);
            return (
              <div key={app.id} className="flex flex-col gap-2 p-4">
                <div className="flex items-center gap-3">
                  {canSelect ? (
                    <input
                      type="checkbox"
                      checked={selected.has(app.id)}
                      onChange={() => toggleSelect(app.id)}
                      className="h-4 w-4 shrink-0 accent-blue-600"
                      aria-label={`Select commission for ${student.name}`}
                    />
                  ) : (
                    <span className="h-4 w-4 shrink-0" />
                  )}
                  <LogoBadge name={app.university} tone={university?.tone ?? "violet"} logoUrl={university?.logoUrl} className="h-9 w-9 shrink-0 text-[11px]" />
                  <button
                    onClick={() => navigate(`/agent/students/${student.id}`, { state: { tab: "Applications", appId: app.id } })}
                    className="min-w-0 flex-1 truncate text-left text-xs font-medium text-slate-800 hover:text-blue-600"
                  >
                    {student.name} <span className="font-mono text-[10px] text-slate-400">{formatStudentId(student.id)}</span>
                  </button>
                  <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${
                    invoice?.status === "Paid" ? "bg-blue-50 text-blue-700"
                      : invoice ? "bg-amber-50 text-amber-700"
                      : commission.claimable ? "bg-emerald-50 text-emerald-700"
                      : "bg-slate-100 text-slate-500"
                  }`}>
                    {invoice?.status === "Paid" ? "Paid" : invoice ? "Invoiced" : commission.claimable ? "Claimable" : "Estimated"}
                  </span>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="min-w-0 flex-1 truncate text-[11px] text-slate-500">
                    {app.university} · {app.course} <span className="font-mono text-slate-300">{formatApplicationId(app.id)}</span>
                  </p>
                  <div className="shrink-0 text-right">
                    <span className="text-xs font-semibold text-slate-900">${commission.totalAmount.toLocaleString()}</span>
                    <span className="ml-1.5 text-[10px] text-slate-400">
                      {commission.ratePercent}%{commission.bonusPercent > 0 ? ` +${commission.bonusPercent}%` : ""} of ${commission.tuitionFeeUSD.toLocaleString()}
                    </span>
                  </div>
                </div>
              </div>
            );
          })}
          {rows.length === 0 && (
            <p className="p-8 text-center text-xs text-slate-400">No applications yet — commissions will appear here once your students apply.</p>
          )}
        </div>
      </div>

      {selected.size > 0 && (
        <div className="fixed inset-x-0 bottom-0 z-30 flex items-center justify-between gap-3 border-t border-slate-200 bg-white p-4 shadow-[0_-4px_20px_rgba(0,0,0,0.08)] md:left-64">
          <p className="text-xs text-slate-600">
            {selected.size} commission{selected.size === 1 ? "" : "s"} selected · <span className="font-semibold text-slate-900">${rows.filter((r) => selected.has(r.app.id)).reduce((s, r) => s + r.commission.totalAmount, 0).toLocaleString()}</span>
          </p>
          <button onClick={generateInvoice} className="flex items-center gap-1.5 rounded-full bg-blue-600 px-4 py-2 text-xs font-semibold text-white hover:bg-blue-700">
            Generate Invoice <ArrowRight size={13} />
          </button>
        </div>
      )}
    </div>
  );
}

function StatCard({ icon, tone, label, value }: { icon: React.ReactNode; tone: string; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
      <p className="mt-2 text-base font-bold text-slate-900">{value}</p>
      <p className="text-[10px] text-slate-500">{label}</p>
    </div>
  );
}
