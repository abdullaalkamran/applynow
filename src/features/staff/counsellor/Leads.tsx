import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, UserPlus, ArrowUpRight, Briefcase, ChevronDown, ChevronUp, Phone } from "lucide-react";
import { Badge, BackButton } from "../../../components/ui";
import { ProfileStepsPanel } from "../../../components/ProfileStepsPanel";
import { loadLeads, loadLeadFollowUpStatus, setLeadFollowUpStatus } from "../../../data/leadsStore";
import { loadPreferences, loadPersonalInfo } from "../../../data/studentProfileDetailsStore";
import { formatStudentId } from "../../../utils/displayId";
import { AGENTS } from "../../../data/mockData";
import type { LeadFollowUpStatus } from "../../../types";

const STATUS_TABS: (LeadFollowUpStatus | "All")[] = ["All", "New", "Contacted", "Nurturing", "Not Interested"];
const EDITABLE_STATUSES: LeadFollowUpStatus[] = ["New", "Contacted", "Nurturing", "Not Interested"];

export default function Leads() {
  const navigate = useNavigate();
  const [tab, setTab] = useState<(typeof STATUS_TABS)[number]>("All");
  const [query, setQuery] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [, forceTick] = useState(0);

  const leads = loadLeads().map((student) => ({
    student,
    status: loadLeadFollowUpStatus(student.id),
    preferences: loadPreferences(student.id),
    phone: student.phone || loadPersonalInfo(student.id)?.phone || undefined,
    agent: student.agentId ? AGENTS.find((a) => a.id === student.agentId) : undefined,
  }));

  const filtered = leads.filter(({ student, status, agent }) => {
    if (tab !== "All" && status !== tab) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      student.name.toLowerCase().includes(q) ||
      student.email.toLowerCase().includes(q) ||
      student.country.toLowerCase().includes(q) ||
      formatStudentId(student.id).toLowerCase().includes(q) ||
      (agent?.name.toLowerCase().includes(q) ?? false)
    );
  });

  const counts: Record<(typeof STATUS_TABS)[number], number> = {
    All: leads.length, New: 0, Contacted: 0, Nurturing: 0, "Not Interested": 0,
  };
  leads.forEach(({ status }) => { counts[status]++; });

  return (
    <div>
      <BackButton fallback="/staff/counsellor" />
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
              tab === t ? "bg-[image:var(--sd-gradient)] text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
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
          placeholder="Search name, email, country, agent, or ID…"
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="space-y-3">
        {filtered.map(({ student, status, preferences, phone, agent }) => {
          const expanded = expandedId === student.id;
          return (
            <div key={student.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
              <div
                onClick={() => setExpandedId(expanded ? null : student.id)}
                className={`flex cursor-pointer flex-col gap-3 p-4 sm:flex-row sm:items-center sm:gap-4 ${expanded ? "bg-slate-50" : "hover:bg-slate-50"}`}
              >
                <div className="flex min-w-0 flex-1 items-start gap-2.5">
                  {expanded ? <ChevronUp size={14} className="mt-0.5 shrink-0 text-slate-400" /> : <ChevronDown size={14} className="mt-0.5 shrink-0 text-slate-400" />}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-1.5">
                      <p className="truncate font-medium text-slate-800">{student.name}</p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide text-slate-500">
                        {formatStudentId(student.id)}
                      </span>
                      {agent ? (
                        <Badge tone="violet">
                          <Briefcase size={11} /> {agent.name}
                        </Badge>
                      ) : (
                        <Badge tone="neutral">Direct</Badge>
                      )}
                    </div>
                    <p className="truncate text-xs text-slate-400">{student.email} · {student.country}</p>
                    <p className="mt-0.5 text-xs">
                      {phone ? (
                        <a
                          href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                          onClick={(e) => e.stopPropagation()}
                          className="font-medium text-slate-600 hover:text-[#2955C4]"
                        >
                          {phone}
                        </a>
                      ) : (
                        <span className="text-slate-300">No phone on file</span>
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-600">
                      {preferences && (preferences.fields.length > 0 || preferences.destinations.length > 0) ? (
                        <>
                          {preferences.fields.join(", ") || "Any subject"}
                          {preferences.destinations.length > 0 && ` — ${preferences.destinations.join(", ")}`}
                        </>
                      ) : (
                        <span className="text-slate-300">Interests not set yet</span>
                      )}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 sm:w-auto sm:shrink-0 sm:gap-3">
                  {phone && (
                    <a
                      href={`tel:${phone.replace(/[^+\d]/g, "")}`}
                      onClick={(e) => e.stopPropagation()}
                      title={`Call ${phone}`}
                      className="flex shrink-0 items-center gap-1.5 rounded-lg bg-emerald-50 px-2.5 py-1.5 text-[11.5px] font-semibold text-emerald-700 hover:bg-emerald-100"
                    >
                      <Phone size={13} /> Call
                    </a>
                  )}
                  <select
                    value={status}
                    onClick={(e) => e.stopPropagation()}
                    onChange={(e) => { setLeadFollowUpStatus(student.id, e.target.value as LeadFollowUpStatus); forceTick((t) => t + 1); }}
                    className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11.5px] font-medium text-slate-700 sm:w-auto"
                  >
                    {EDITABLE_STATUSES.map((s) => (
                      <option key={s} value={s}>{s}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 border-t border-slate-100 px-4 py-2.5">
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/staff/counsellor/students/${student.id}`); }}
                  className="flex items-center gap-1 text-xs font-medium text-[#2955C4]"
                >
                  Full profile <ArrowUpRight size={12} />
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

              {expanded && (
                <div className="border-t border-slate-100 bg-slate-50/60 px-4 py-4">
                  <ProfileStepsPanel studentId={student.id} editable />
                </div>
              )}
            </div>
          );
        })}
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-100 bg-white py-12 text-center shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <UserPlus size={22} className="text-slate-300" />
            <p className="text-sm text-slate-400">No leads match this view.</p>
          </div>
        )}
      </div>
    </div>
  );
}
