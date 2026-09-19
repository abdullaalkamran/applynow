import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { MessageCircle } from "lucide-react";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import {
  loadMeetings, loadDoneMeetingIds, markMeetingDone, meetingStatus, formatMeetingTime,
} from "../../../data/counsellorMeetingsStore";
import { loadStudentComments } from "../../../data/studentCommentsStore";
import { BackButton } from "../../../components/ui";

const TONE_CLASS: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
  neutral: "bg-slate-50 text-slate-400",
};

export default function CounsellorCounseling() {
  const navigate = useNavigate();
  const [, forceTick] = useState(0);
  const assigned = loadAssignedStudents();
  const sessions = loadMeetings().filter((m) => m.kind === "session");
  const doneIds = loadDoneMeetingIds();

  return (
    <div>
      <BackButton fallback="/staff/counsellor" />
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Counseling</h1>
        <p className="mt-1 text-sm text-slate-500">{sessions.length} session{sessions.length === 1 ? "" : "s"} scheduled today, grouped by student.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {assigned.map((s) => {
          const studentSessions = sessions.filter((m) => m.studentId === s.id);
          const latestComment = loadStudentComments(s.id)[0];
          if (studentSessions.length === 0 && !latestComment) return null;
          return (
            <div key={s.id} className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
                <div className="flex items-center gap-2.5">
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${s.avatarColor}`}>
                    {s.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <p className="text-sm font-semibold text-slate-800">{s.name}</p>
                </div>
                <button onClick={() => navigate(`/staff/counsellor/students/${s.id}`)} className="text-xs font-medium text-[#2955C4]">
                  Open case
                </button>
              </div>

              {studentSessions.length > 0 ? (
                <div className="divide-y divide-slate-50">
                  {studentSessions.map((m) => {
                    const status = meetingStatus(m, doneIds);
                    return (
                      <div key={m.id} className="flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-3">
                        <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                          <div className="w-16 shrink-0 text-xs font-medium text-slate-500">{formatMeetingTime(m.time)}</div>
                          <p className="min-w-0 flex-1 truncate text-sm text-slate-700">{m.title}</p>
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-2 pl-[76px] sm:justify-end sm:pl-0">
                          <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10.5px] font-medium ${TONE_CLASS[status.tone]}`}>{status.label}</span>
                          {!doneIds.has(m.id) && (
                            <button
                              onClick={() => { markMeetingDone(m.id); forceTick((t) => t + 1); }}
                              className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 hover:bg-slate-50"
                            >
                              Mark done
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="px-5 py-3 text-xs text-slate-400">No sessions scheduled today.</p>
              )}

              {latestComment && (
                <div className="border-t border-slate-100 px-5 py-3">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Latest case comment — {latestComment.performedBy.name}</p>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">{latestComment.notes}</p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {sessions.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-slate-200 py-14 text-center">
          <MessageCircle size={22} className="text-slate-300" />
          <p className="text-sm text-slate-400">No counseling sessions scheduled today.</p>
        </div>
      )}
    </div>
  );
}
