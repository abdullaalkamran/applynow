import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, ArrowUpRight } from "lucide-react";
import { ProgressBar } from "../../../components/ui";
import { loadLeads, loadLeadFollowUpStatus, setLeadFollowUpStatus } from "../../../data/leadsStore";
import { getProfileCompletion } from "../../../data/profileCompletion";
import { loadPreferences } from "../../../data/studentProfileDetailsStore";
import { formatStudentId } from "../../../utils/displayId";
import type { LeadFollowUpStatus } from "../../../types";

const STATUS_TABS: (LeadFollowUpStatus | "All")[] = ["All", "New", "Contacted", "Nurturing", "Not Interested"];
const EDITABLE_STATUSES: LeadFollowUpStatus[] = ["New", "Contacted", "Nurturing", "Not Interested"];

export default function Leads() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("All");
  const [query, setQuery] = useState("");
  const [, forceTick] = useState(0);

  const leads = loadLeads().map((student) => ({
    student,
    status: loadLeadFollowUpStatus(student.id),
    completion: getProfileCompletion(student.id),
    preferences: loadPreferences(student.id),
  }));

  const filtered = leads.filter(({ student, status }) => {
    if (tab !== "All" && status !== tab) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      student.name.toLowerCase().includes(q) ||
      student.email.toLowerCase().includes(q) ||
      student.country.toLowerCase().includes(q) ||
      formatStudentId(student.id).toLowerCase().includes(q)
    );
  });

  const counts: Record<(typeof STATUS_TABS)[number], number> = {
    All: leads.length, New: 0, Contacted: 0, Nurturing: 0, "Not Interested": 0,
  };
  leads.forEach(({ status }) => { counts[status]++; });

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Leads</h1>
        <p className="mt-1 text-sm text-slate-500">
          {leads.length} account{leads.length === 1 ? "" : "s"} created on the website that {leads.length === 1 ? "hasn't" : "haven't"} submitted an application yet.
        </p>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {STATUS_TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
              tab === t ? "bg-[var(--sd-ink)] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {t}
            <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${tab === t ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
              {counts[t]}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 max-w-sm">
        <Search size={14} className="text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search name, email, country, or ID…"
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Student ID</th>
                <th className="px-5 py-3 font-medium">Name</th>
                <th className="px-5 py-3 font-medium">Interested in</th>
                <th className="px-5 py-3 font-medium">Profile completion</th>
                <th className="px-5 py-3 font-medium">Follow-up status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(({ student, status, completion, preferences }) => (
                <tr
                  key={student.id}
                  onClick={() => navigate(`/staff/counsellor/students/${student.id}`)}
                  className="cursor-pointer hover:bg-slate-50"
                >
                  <td className="px-5 py-3">
                    <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-slate-500">
                      {formatStudentId(student.id)}
                    </span>
                  </td>
                  <td className="px-5 py-3">
                    <p className="font-medium text-slate-800">{student.name}</p>
                    <p className="text-xs text-slate-400">{student.email} · {student.country}</p>
                  </td>
                  <td className="px-5 py-3 text-slate-600">
                    {preferences && (preferences.fields.length > 0 || preferences.destinations.length > 0) ? (
                      <>
                        {preferences.fields.join(", ") || "Any subject"}
                        {preferences.destinations.length > 0 && ` — ${preferences.destinations.join(", ")}`}
                      </>
                    ) : (
                      <span className="text-slate-300">Not set yet</span>
                    )}
                  </td>
                  <td className="px-5 py-3" style={{ minWidth: 140 }}>
                    <div className="flex items-center gap-2">
                      <ProgressBar value={completion.percent} size="sm" />
                      <span className="shrink-0 text-[11px] text-slate-400">{completion.percent}%</span>
                    </div>
                  </td>
                  <td className="px-5 py-3">
                    <select
                      value={status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => { setLeadFollowUpStatus(student.id, e.target.value as LeadFollowUpStatus); forceTick((t) => t + 1); }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11.5px] font-medium text-slate-700"
                    >
                      {EDITABLE_STATUSES.map((s) => (
                        <option key={s} value={s}>{s}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-5 py-3">
                    <div className="flex flex-col items-start gap-1">
                      <button
                        onClick={(e) => { e.stopPropagation(); navigate(`/staff/counsellor/students/${student.id}`); }}
                        className="flex items-center gap-1 text-xs font-medium text-[#2955C4]"
                      >
                        View profile <ArrowUpRight size={12} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/staff/counsellor/students/${student.id}`, { state: { tab: "Applications" } });
                        }}
                        className="flex items-center gap-1 text-xs font-medium text-emerald-600 hover:text-emerald-700"
                      >
                        Start application <ArrowUpRight size={12} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <UserPlus size={22} className="text-slate-300" />
            <p className="text-sm text-slate-400">No leads match this view.</p>
          </div>
        )}
      </div>
    </div>
  );
}
