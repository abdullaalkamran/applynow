import { useState } from "react";
import { ChevronDown, ChevronUp, Printer, FileText } from "lucide-react";
import { CURRENT_AGENT_ID } from "../../data/mockData";
import { staffContact } from "../../utils/currentStaff";
import { loadInvoicesFor } from "../../data/agentInvoicesStore";

export default function AgentStatements() {
  const agent = staffContact(CURRENT_AGENT_ID, "agent");
  const invoices = [...loadInvoicesFor(CURRENT_AGENT_ID)].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  const [openId, setOpenId] = useState<string | null>(null);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-base font-semibold text-slate-900">Statements &amp; Invoices</h1>
        <p className="mt-1 text-xs text-slate-500">Invoices you've generated from claimable commissions, and their payment status.</p>
      </div>

      <div className="space-y-2.5">
        {invoices.map((inv) => {
          const open = openId === inv.id;
          return (
            <div key={inv.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.05)]">
              <button onClick={() => setOpenId(open ? null : inv.id)} className="flex w-full items-center justify-between gap-3 p-4 text-left">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{inv.id}</p>
                  <p className="text-[11px] text-slate-400">{inv.createdAt} · {inv.lines.length} line{inv.lines.length === 1 ? "" : "s"}</p>
                </div>
                <p className="shrink-0 text-sm font-bold text-slate-900">${inv.totalAmount.toLocaleString()}</p>
                <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-semibold ${inv.status === "Paid" ? "bg-blue-50 text-blue-700" : "bg-amber-50 text-amber-700"}`}>
                  {inv.status}
                </span>
                {open ? <ChevronUp size={16} className="shrink-0 text-slate-300" /> : <ChevronDown size={16} className="shrink-0 text-slate-300" />}
              </button>

              {open && (
                <div id={`invoice-print-${inv.id}`} className="border-t border-slate-100 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <div>
                      <p className="text-xs font-semibold text-slate-800">Invoice {inv.id}</p>
                      <p className="text-[11px] text-slate-400">Issued {inv.createdAt} · {agent.name}, {agent.organization}</p>
                    </div>
                    <button
                      onClick={() => window.print()}
                      className="flex shrink-0 items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                    >
                      <Printer size={12} /> Print / Save as PDF
                    </button>
                  </div>
                  <div className="space-y-1.5">
                    {inv.lines.map((l) => (
                      <div key={l.applicationId} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2 text-xs">
                        <div className="min-w-0 flex-1">
                          <p className="truncate font-medium text-slate-700">{l.studentName}</p>
                          <p className="truncate text-[11px] text-slate-400">{l.university} · {l.course}</p>
                        </div>
                        <span className="shrink-0 font-semibold text-slate-800">${l.amount.toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-3 text-xs">
                    <span className="font-semibold text-slate-600">Total</span>
                    <span className="font-bold text-slate-900">${inv.totalAmount.toLocaleString()}</span>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {invoices.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
            <FileText size={20} className="text-slate-300" />
            <p className="text-xs text-slate-400">No invoices yet — generate one from the Finance page once a student enrols.</p>
          </div>
        )}
      </div>
    </div>
  );
}
