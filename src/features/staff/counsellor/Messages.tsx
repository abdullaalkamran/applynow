import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { STUDENTS } from "../../../data/mockData";
import { getStaffMessages, markMessageRead, type StaffMessage } from "../../../data/counsellorMessagesStore";

export default function CounsellorMessages() {
  const navigate = useNavigate();
  const [, forceTick] = useState(0);
  const messages = getStaffMessages();

  function open(m: StaffMessage) {
    markMessageRead(m.id);
    forceTick((t) => t + 1);
    navigate(`/staff/counsellor/students/${m.studentId}`);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-xl font-semibold text-slate-900">Messages</h1>
        <p className="mt-1 text-sm text-slate-500">Recent activity from your students.</p>
      </div>

      <div className="divide-y divide-slate-50 rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        {messages.map((m) => {
          const student = STUDENTS.find((s) => s.id === m.studentId);
          if (!student) return null;
          return (
            <button key={m.id} onClick={() => open(m)} className="flex w-full items-center gap-3 px-5 py-3.5 text-left hover:bg-slate-50">
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${student.avatarColor}`}>
                {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <p className="truncate text-sm font-semibold text-slate-800">{student.name}</p>
                  <span className="shrink-0 text-xs text-slate-400">{m.time}</span>
                </div>
                <p className="truncate text-xs text-slate-500">{m.preview}</p>
              </div>
              {m.unread > 0 && (
                <span className="flex h-5 min-w-[20px] shrink-0 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                  {m.unread}
                </span>
              )}
            </button>
          );
        })}
        {messages.length === 0 && <p className="px-5 py-6 text-sm text-slate-400">No messages yet.</p>}
      </div>
    </div>
  );
}
