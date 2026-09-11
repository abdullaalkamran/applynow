import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { ListChecks, Mail as MailIcon, Check } from "lucide-react";
import { STUDENTS } from "../../../data/mockData";
import {
  loadMeetings, loadDoneMeetingIds, markMeetingDone, meetingStatus, formatMeetingTime, type Meeting,
} from "../../../data/counsellorMeetingsStore";

const TONE_CLASS: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
  neutral: "bg-slate-50 text-slate-400",
};

export default function CounsellorTasks() {
  const navigate = useNavigate();
  const [, forceTick] = useState(0);
  const meetings = loadMeetings();
  const doneIds = loadDoneMeetingIds();

  function runAction(meeting: Meeting) {
    if (meeting.studentId) {
      const student = STUDENTS.find((s) => s.id === meeting.studentId);
      if (meeting.action === "Email" && student) {
        window.location.assign(`mailto:${student.email}?subject=${encodeURIComponent(meeting.title)}`);
        return;
      }
      navigate(`/staff/counsellor/students/${meeting.studentId}`);
      return;
    }
    markMeetingDone(meeting.id);
    forceTick((t) => t + 1);
  }

  const open = meetings.filter((m) => !doneIds.has(m.id));
  const done = meetings.filter((m) => doneIds.has(m.id));

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Tasks</h1>
        <p className="mt-1 text-sm text-slate-500">{open.length} open task{open.length === 1 ? "" : "s"} today.</p>
      </div>

      <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-center gap-2 border-b border-slate-100 px-5 py-3.5">
          <ListChecks size={15} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-800">Today's Focus</p>
        </div>
        <div className="divide-y divide-slate-50">
          {[...open, ...done].map((m) => {
            const status = meetingStatus(m, doneIds);
            return (
              <div key={m.id} className="flex items-center gap-4 px-5 py-3.5">
                <div className="w-16 shrink-0 text-xs font-medium text-slate-500">{formatMeetingTime(m.time)}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-800">{m.title}</p>
                  <p className="truncate text-xs text-slate-400">{m.subtitle}</p>
                </div>
                <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${TONE_CLASS[status.tone]}`}>{status.label}</span>
                <button
                  onClick={() => runAction(m)}
                  disabled={doneIds.has(m.id)}
                  className="flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
                >
                  {m.action === "Email" ? <MailIcon size={12} /> : doneIds.has(m.id) ? <Check size={12} /> : null}
                  {doneIds.has(m.id) ? "Done" : m.action}
                </button>
              </div>
            );
          })}
          {meetings.length === 0 && <p className="px-5 py-6 text-sm text-slate-400">No tasks scheduled.</p>}
        </div>
      </div>
    </div>
  );
}
