import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Check, ChevronRight, ListChecks } from "lucide-react";
import { COUNSELLORS } from "../../../data/mockData";
import { SkylineArt } from "../../../components/ui/mobile";
import { COUNSELLOR_ID, activeApplicationsFor, missingDocsCountFor } from "../../../utils/counsellorData";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import {
  loadMeetings, loadDoneMeetingIds, markMeetingDone, meetingStatus, formatMeetingTime,
} from "../../../data/counsellorMeetingsStore";
import { loadNextSteps, toggleNextStepDone } from "../../../data/applicationNextStepsStore";
import { formatStudentId } from "../../../utils/displayId";

const TONE_CLASS: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
  neutral: "bg-slate-50 text-slate-400",
};

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

export default function CounsellorCaseQueue() {
  const navigate = useNavigate();
  const counsellor = COUNSELLORS.find((c) => c.id === COUNSELLOR_ID)!;
  const assigned = loadAssignedStudents();
  const [, forceTick] = useState(0);

  const meetings = loadMeetings();
  const doneIds = loadDoneMeetingIds();
  const atRiskCount = assigned.filter((s) => s.riskFlag && s.riskFlag !== "none").length;

  const applicationSteps = assigned.flatMap((s) =>
    activeApplicationsFor(s.id).flatMap((app) =>
      loadNextSteps(app.id).map((ns) => ({ ...ns, studentId: s.id, studentName: s.name, university: app.university, applicationId: app.id }))
    )
  );

  return (
    <div>
      <div className="relative mb-6 overflow-hidden rounded-3xl border border-slate-100 bg-[var(--sd-card)] p-6 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="pointer-events-none absolute -right-8 -top-8 hidden h-40 w-40 overflow-hidden rounded-full opacity-90 sm:block">
          <SkylineArt tone="violet" className="h-full w-full" />
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--sd-ink)]/10 p-3 text-center text-[8.5px] font-medium italic leading-tight tracking-wide text-white">
            Guiding {assigned.length} journey{assigned.length === 1 ? "" : "s"}
          </div>
        </div>
        <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{greeting()}</p>
        <h1 className="mt-1 text-[32px] font-bold leading-none text-slate-900">{counsellor.name.split(" ")[0]}</h1>
        <p className="mt-2 max-w-md text-sm text-slate-500">
          {assigned.length} student{assigned.length === 1 ? "" : "s"} counting on you today
          {atRiskCount > 0 ? ` — ${atRiskCount} need${atRiskCount === 1 ? "s" : ""} close attention.` : "."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)] lg:col-span-2">
          <div className="border-b border-slate-100 px-5 py-3.5">
            <p className="text-sm font-semibold text-slate-800">Student List</p>
            <p className="text-xs text-slate-400">Tap a student to open their full profile.</p>
          </div>
          <div className="divide-y divide-slate-50">
            {assigned.map((s) => {
              const missing = missingDocsCountFor(s.id);
              const sApps = activeApplicationsFor(s.id);
              return (
                <button
                  key={s.id}
                  onClick={() => navigate(`/staff/counsellor/students/${s.id}`)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${s.avatarColor}`}>
                    {s.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5">
                      <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                      <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[9.5px] font-semibold tracking-wide text-slate-500">
                        {formatStudentId(s.id)}
                      </span>
                    </div>
                    <p className="truncate text-xs text-slate-400">{s.country} · {sApps.length} active</p>
                  </div>
                  {s.riskFlag && s.riskFlag !== "none" && (
                    <span className={`h-2 w-2 shrink-0 rounded-full ${s.riskFlag === "high" ? "bg-rose-500" : "bg-amber-500"}`} />
                  )}
                  {missing > 0 && (
                    <span className="shrink-0 rounded-full bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">{missing}</span>
                  )}
                  <ChevronRight size={14} className="shrink-0 text-slate-300" />
                </button>
              );
            })}
            {assigned.length === 0 && <p className="px-5 py-6 text-center text-sm text-slate-400">No students assigned yet.</p>}
          </div>
        </div>

        <div className="rounded-2xl border border-slate-100 bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
            <ListChecks size={15} className="text-slate-400" />
            <p className="text-sm font-semibold text-slate-800">To Do List</p>
          </div>
          <div className="divide-y divide-slate-50">
            {meetings.map((m) => {
              const status = meetingStatus(m, doneIds);
              const done = doneIds.has(m.id);
              return (
                <div key={m.id} className="flex items-center gap-3 px-5 py-3">
                  <button
                    onClick={() => { markMeetingDone(m.id); forceTick((t) => t + 1); }}
                    disabled={done}
                    aria-label={done ? `${m.title} complete` : `Mark ${m.title} done`}
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                      done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                    }`}
                  >
                    {done && <Check size={11} />}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p className={`truncate text-[12.5px] font-medium ${done ? "text-slate-400 line-through" : "text-slate-700"}`}>{m.title}</p>
                    <p className="truncate text-[11px] text-slate-400">{formatMeetingTime(m.time)} · {m.subtitle}</p>
                  </div>
                  {!done && <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${TONE_CLASS[status.tone]}`}>{status.label}</span>}
                </div>
              );
            })}
            {applicationSteps.map((ns) => (
              <div
                key={ns.id}
                role="button"
                tabIndex={0}
                onClick={() => navigate(`/staff/counsellor/students/${ns.studentId}`, { state: { tab: "Applications", appId: ns.applicationId } })}
                onKeyDown={(e) => {
                  if (e.key === "Enter") navigate(`/staff/counsellor/students/${ns.studentId}`, { state: { tab: "Applications", appId: ns.applicationId } });
                }}
                className="flex w-full cursor-pointer items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
              >
                <button
                  onClick={(e) => { e.stopPropagation(); toggleNextStepDone(ns.applicationId, ns.id); forceTick((t) => t + 1); }}
                  aria-label={ns.done ? `Mark "${ns.title}" not done` : `Mark "${ns.title}" done`}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                    ns.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                  }`}
                >
                  {ns.done && <Check size={11} />}
                </button>
                <div className="min-w-0 flex-1">
                  <p className={`truncate text-[12.5px] font-medium ${ns.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{ns.title}</p>
                  <p className="truncate text-[11px] text-slate-400">{ns.studentName} · {ns.university}</p>
                </div>
              </div>
            ))}
            {meetings.length === 0 && applicationSteps.length === 0 && (
              <p className="px-5 py-6 text-center text-sm text-slate-400">Nothing on your list today.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
