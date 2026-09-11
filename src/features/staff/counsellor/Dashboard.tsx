import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, FileText, PlaneTakeoff, AlertCircle, ArrowUp, ArrowDown, ListChecks,
  Zap, UserPlus, FilePlus2, CalendarPlus, Send, Mail as MailIcon, ChevronRight, GraduationCap, CalendarDays,
} from "lucide-react";
import { Modal, Button } from "../../../components/ui";
import { SkylineArt } from "../../../components/ui/mobile";
import { COUNSELLORS, UNIVERSITIES } from "../../../data/mockData";
import { createApplication } from "../../../data/applicationsStore";
import { COUNSELLOR_ID, activeApplicationsFor, VISA_BUCKET_STATUSES } from "../../../utils/counsellorData";
import { loadAssignedStudents, addStudent } from "../../../data/counsellorStudentsStore";
import {
  loadMeetings, loadDoneMeetingIds, markMeetingDone, meetingStatus, formatMeetingTime, addMeeting, type Meeting,
} from "../../../data/counsellorMeetingsStore";
import { getStaffMessages, markMessageRead } from "../../../data/counsellorMessagesStore";
import { getStatTrends } from "../../../data/staffStatsSnapshotStore";
import type { Student } from "../../../types";

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

const TONE_CLASS: Record<string, string> = {
  green: "bg-emerald-50 text-emerald-700",
  rose: "bg-rose-50 text-rose-600",
  slate: "bg-slate-100 text-slate-600",
  neutral: "bg-slate-50 text-slate-400",
};

function StatCard({
  icon, tone, value, label, trend,
}: { icon: React.ReactNode; tone: string; value: number; label: string; trend: number | null }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
      <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${tone}`}>{icon}</div>
      <p className="mt-3 text-2xl font-bold text-slate-900">{value}</p>
      <p className="text-xs text-slate-500">{label}</p>
      {trend === null ? (
        <p className="mt-1 text-[11px] font-medium text-slate-300">New</p>
      ) : (
        <p className={`mt-1 flex items-center gap-1 text-[11px] font-medium ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {trend >= 0 ? <ArrowUp size={11} /> : <ArrowDown size={11} />} {Math.abs(trend)}% vs yesterday
        </p>
      )}
    </div>
  );
}

export default function CounsellorDashboard() {
  const navigate = useNavigate();
  const counsellor = COUNSELLORS.find((c) => c.id === COUNSELLOR_ID)!;
  const [, forceTick] = useState(0);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [createAppOpen, setCreateAppOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);

  const assigned = loadAssignedStudents();
  const allActiveApps = assigned.flatMap((s) => activeApplicationsFor(s.id));
  const visaCount = allActiveApps.filter((a) => VISA_BUCKET_STATUSES.has(a.status)).length;
  const pendingCount = allActiveApps.filter((a) => a.waitingOn === "staff").length;

  const trends = getStatTrends({
    students: assigned.length,
    applications: allActiveApps.length,
    visa: visaCount,
    pending: pendingCount,
  });

  const meetings = loadMeetings();
  const doneIds = loadDoneMeetingIds();
  const messages = getStaffMessages();

  function runMeetingAction(m: Meeting) {
    if (m.studentId) {
      if (m.action === "Email") {
        const student = assigned.find((s) => s.id === m.studentId);
        if (student) window.location.assign(`mailto:${student.email}?subject=${encodeURIComponent(m.title)}`);
        return;
      }
      navigate(`/staff/counsellor/students/${m.studentId}`);
      return;
    }
    markMeetingDone(m.id);
    forceTick((t) => t + 1);
  }

  function openMessage(id: string, studentId: string) {
    markMessageRead(id);
    navigate(`/staff/counsellor/students/${studentId}`);
  }

  return (
    <div>
      <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h1 className="text-[26px] font-bold text-slate-900">
            {greeting()}, {counsellor.name.split(" ")[0]}! <span>👋</span>
          </h1>
          <p className="mt-1 text-sm text-slate-500">Here's what's important today.</p>
        </div>
        <div className="hidden text-center italic text-slate-400 md:block">
          <p className="text-sm">"Empowering students</p>
          <p className="text-sm">to go further."</p>
          <div className="mx-auto mt-1 h-px w-10 bg-slate-300" />
        </div>
        <div className="relative hidden h-20 w-40 shrink-0 overflow-hidden rounded-2xl lg:block">
          <SkylineArt tone="teal" className="h-full w-full" />
          <div className="absolute inset-0 flex items-center justify-center bg-[var(--sd-ink)]/15 p-2 text-center text-[10px] font-semibold leading-tight text-white">
            New Opportunities
            <br />
            Brighter Futures
          </div>
        </div>
      </div>

      <div className="mb-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard icon={<Users size={18} className="text-[#2955C4]" />} tone="bg-[#E7EEFC]" value={assigned.length} label="My Students" trend={trends.students} />
        <StatCard icon={<FileText size={18} className="text-[#0F9D6D]" />} tone="bg-[#E1F5F0]" value={allActiveApps.length} label="Active Applications" trend={trends.applications} />
        <StatCard icon={<PlaneTakeoff size={18} className="text-[#6D3FBF]" />} tone="bg-[#F1EAFB]" value={visaCount} label="Visa in Process" trend={trends.visa} />
        <StatCard icon={<AlertCircle size={18} className="text-[#B8791C]" />} tone="bg-[#FDF0DC]" value={pendingCount} label="Pending Actions" trend={trends.pending} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)] lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <ListChecks size={15} className="text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-800">Today's Focus</p>
                <p className="text-xs text-slate-400">Your scheduled tasks and important follow-ups.</p>
              </div>
            </div>
            <button onClick={() => navigate("/staff/counsellor/tasks")} className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#2955C4]">
              View All Tasks <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {meetings.slice(0, 5).map((m) => {
              const status = meetingStatus(m, doneIds);
              return (
                <div key={m.id} className="flex items-center gap-4 px-5 py-3">
                  <div className="w-16 shrink-0 text-xs font-medium text-slate-500">{formatMeetingTime(m.time)}</div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{m.title}</p>
                    <p className="truncate text-xs text-slate-400">{m.subtitle}</p>
                  </div>
                  <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${TONE_CLASS[status.tone]}`}>{status.label}</span>
                  <button
                    onClick={() => runMeetingAction(m)}
                    disabled={doneIds.has(m.id)}
                    className="w-20 shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-50 disabled:cursor-default disabled:opacity-40"
                  >
                    {doneIds.has(m.id) ? "Done" : m.action}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center gap-2">
              <Zap size={15} className="text-slate-400" />
              <p className="text-sm font-semibold text-slate-800">Quick Actions</p>
            </div>
            <div className="grid grid-cols-2 gap-2.5">
              <QuickAction icon={<UserPlus size={16} />} label="Add New Student" onClick={() => setAddStudentOpen(true)} />
              <QuickAction icon={<FilePlus2 size={16} />} label="Create Application" onClick={() => setCreateAppOpen(true)} />
              <QuickAction icon={<CalendarPlus size={16} />} label="Schedule Meeting" onClick={() => setScheduleOpen(true)} />
              <QuickAction icon={<Send size={16} />} label="Send Message" onClick={() => setSendMessageOpen(true)} />
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)] lg:col-span-2">
          <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
            <div className="flex items-center gap-2">
              <Users size={15} className="text-slate-400" />
              <div>
                <p className="text-sm font-semibold text-slate-800">My Students</p>
                <p className="text-xs text-slate-400">Recent activity from your students.</p>
              </div>
            </div>
            <button onClick={() => navigate("/staff/counsellor/students")} className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#2955C4]">
              View All Students <ChevronRight size={12} />
            </button>
          </div>
          <div className="divide-y divide-slate-50">
            {assigned
              .map((s) => ({ student: s, primary: [...activeApplicationsFor(s.id)].sort((a, b) => b.progress - a.progress)[0] }))
              .filter(({ primary }) => !!primary)
              .map(({ student: s, primary }) => (
                <button
                  key={s.id}
                  onClick={() => navigate(`/staff/counsellor/students/${s.id}`)}
                  className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50"
                >
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${s.avatarColor}`}>
                    {s.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </div>
                  <p className="w-40 shrink-0 truncate text-sm font-medium text-slate-800">{s.name}</p>
                  <p className="min-w-0 flex-1 truncate text-sm text-slate-500">{primary!.nextAction}</p>
                  <ChevronRight size={14} className="shrink-0 text-slate-300" />
                </button>
              ))}
            {assigned.every((s) => activeApplicationsFor(s.id).length === 0) && (
              <p className="px-5 py-6 text-sm text-slate-400">No students with a running application right now.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <WeekCalendarCard meetings={meetings} doneIds={doneIds} onOpenTasks={() => navigate("/staff/counsellor/tasks")} />

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <p className="mb-3 text-sm font-semibold text-slate-800">Recent Messages</p>
            <div className="space-y-3">
              {messages.map((m) => {
                const student = assigned.find((s) => s.id === m.studentId);
                if (!student) return null;
                return (
                  <button key={m.id} onClick={() => openMessage(m.id, m.studentId)} className="flex w-full items-center gap-2.5 text-left">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${student.avatarColor}`}>
                      {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <p className="truncate text-[12.5px] font-semibold text-slate-800">{student.name}</p>
                        <span className="shrink-0 text-[10px] text-slate-400">{m.time}</span>
                      </div>
                      <p className="truncate text-[11.5px] text-slate-500">{m.preview}</p>
                    </div>
                    {m.unread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 p-5 text-white">
            <GraduationCap size={22} />
            <p className="mt-2 text-[13.5px] font-semibold leading-snug">Make global education accessible for every student.</p>
          </div>
        </div>
      </div>

      {addStudentOpen && <AddStudentModal onClose={() => setAddStudentOpen(false)} onAdded={() => forceTick((t) => t + 1)} />}
      {createAppOpen && <CreateApplicationModal assigned={assigned} onClose={() => setCreateAppOpen(false)} onCreated={() => forceTick((t) => t + 1)} />}
      {scheduleOpen && <ScheduleMeetingModal assigned={assigned} onClose={() => setScheduleOpen(false)} onAdded={() => forceTick((t) => t + 1)} />}
      {sendMessageOpen && <SendMessageModal assigned={assigned} onClose={() => setSendMessageOpen(false)} />}
    </div>
  );
}

const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function WeekCalendarCard({
  meetings, doneIds, onOpenTasks,
}: { meetings: Meeting[]; doneIds: Set<string>; onOpenTasks: () => void }) {
  const today = new Date();
  const mondayOffset = (today.getDay() + 6) % 7;
  const monday = new Date(today);
  monday.setDate(today.getDate() - mondayOffset);
  const weekDays = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });
  const [selected, setSelected] = useState(today.toDateString());
  const isToday = selected === today.toDateString();

  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <CalendarDays size={15} className="text-slate-400" />
          <p className="text-sm font-semibold text-slate-800">
            {new Date(selected).toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}
          </p>
        </div>
        <button onClick={onOpenTasks} className="flex items-center gap-1 text-xs font-medium text-[#2955C4]">
          View Tasks <ChevronRight size={12} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {weekDays.map((d, i) => {
          const active = d.toDateString() === selected;
          const isTodayCol = d.toDateString() === today.toDateString();
          return (
            <button
              key={d.toDateString()}
              onClick={() => setSelected(d.toDateString())}
              className={`flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] ${
                active ? "bg-[var(--sd-ink)] text-white" : isTodayCol ? "bg-slate-100 text-slate-800" : "text-slate-500 hover:bg-slate-50"
              }`}
            >
              <span className="font-medium">{DAY_LABELS[i]}</span>
              <span className={`font-semibold ${active ? "text-white" : "text-slate-700"}`}>{d.getDate()}</span>
            </button>
          );
        })}
      </div>

      <div className="mt-4 space-y-2.5">
        {isToday ? (
          meetings.length === 0 ? (
            <p className="text-xs text-slate-400">Nothing scheduled today.</p>
          ) : (
            meetings.map((m) => (
              <div key={m.id} className="flex items-center gap-2.5">
                <span className={`h-2 w-2 shrink-0 rounded-full ${doneIds.has(m.id) ? "bg-slate-300" : "bg-[#2955C4]"}`} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[12.5px] font-medium text-slate-700">
                    <span className="text-slate-400">{formatMeetingTime(m.time)}</span> · {m.title}
                  </p>
                  <p className="truncate text-[11px] text-slate-400">{m.subtitle}</p>
                </div>
              </div>
            ))
          )
        ) : (
          <p className="text-xs text-slate-400">No meetings scheduled for this day yet.</p>
        )}
      </div>
    </div>
  );
}

function QuickAction({ icon, label, onClick }: { icon: React.ReactNode; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 p-3 text-left hover:bg-slate-100">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-white text-slate-600 shadow-sm">{icon}</span>
      <span className="text-[12.5px] font-medium text-slate-700">{label}</span>
    </button>
  );
}

function AddStudentModal({ onClose, onAdded }: { onClose: () => void; onAdded: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [country, setCountry] = useState("");
  const canSubmit = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email) && country.trim().length > 1;

  return (
    <Modal title="Add new student" onClose={onClose}>
      <div className="space-y-3">
        <ModalField label="Full name" value={name} onChange={setName} placeholder="e.g. Amara Chen" />
        <ModalField label="Email" value={email} onChange={setEmail} placeholder="amara.chen@email.com" />
        <ModalField label="Country" value={country} onChange={setCountry} placeholder="e.g. Kenya" />
        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={() => { addStudent(name.trim(), email.trim(), country.trim()); onAdded(); onClose(); }}
        >
          Add student
        </Button>
      </div>
    </Modal>
  );
}

function CreateApplicationModal({
  assigned, onClose, onCreated,
}: { assigned: Student[]; onClose: () => void; onCreated: () => void }) {
  const [studentId, setStudentId] = useState(assigned[0]?.id ?? "");
  const [universityId, setUniversityId] = useState(UNIVERSITIES[0]?.id ?? "");
  const university = UNIVERSITIES.find((u) => u.id === universityId);
  const [courseName, setCourseName] = useState(university?.courses[0]?.name ?? "");
  const [intake, setIntake] = useState(university?.openIntake ?? "");
  const student = assigned.find((s) => s.id === studentId);
  const canSubmit = !!student && !!university && !!courseName && !!intake;

  return (
    <Modal title="Create application" onClose={onClose}>
      <div className="space-y-3">
        <SelectField label="Student" value={studentId} onChange={setStudentId} options={assigned.map((s) => ({ value: s.id, label: s.name }))} />
        <SelectField
          label="University"
          value={universityId}
          onChange={(v) => {
            setUniversityId(v);
            const u = UNIVERSITIES.find((x) => x.id === v);
            setCourseName(u?.courses[0]?.name ?? "");
            setIntake(u?.openIntake ?? "");
          }}
          options={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
        />
        {university && (
          <SelectField label="Course" value={courseName} onChange={setCourseName} options={university.courses.map((c) => ({ value: c.name, label: c.name }))} />
        )}
        <ModalField label="Intake" value={intake} onChange={setIntake} placeholder="e.g. September 2027" />
        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={() => {
            if (!student || !university) return;
            createApplication({ studentId: student.id, university: university.name, course: courseName, intake, country: university.country, campus: "Main Campus" });
            onCreated();
            onClose();
          }}
        >
          Create application
        </Button>
      </div>
    </Modal>
  );
}

function ScheduleMeetingModal({
  assigned, onClose, onAdded,
}: { assigned: Student[]; onClose: () => void; onAdded: () => void }) {
  const [title, setTitle] = useState("");
  const [studentId, setStudentId] = useState(assigned[0]?.id ?? "");
  const [time, setTime] = useState("09:00");
  const student = assigned.find((s) => s.id === studentId);
  const canSubmit = title.trim().length > 1 && !!time;

  return (
    <Modal title="Schedule meeting" onClose={onClose}>
      <div className="space-y-3">
        <ModalField label="Title" value={title} onChange={setTitle} placeholder="e.g. Offer discussion" />
        <SelectField label="Student" value={studentId} onChange={setStudentId} options={assigned.map((s) => ({ value: s.id, label: s.name }))} />
        <label className="block text-xs font-medium text-slate-500">
          Time
          <input
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[var(--sd-ink)] focus:outline-none"
          />
        </label>
        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={() => {
            addMeeting({ time, title: title.trim(), subtitle: student?.name ?? "Counsellor Team", studentId: student?.id, action: student ? "Prepare" : "Join", kind: student ? "session" : "task" });
            onAdded();
            onClose();
          }}
        >
          Schedule
        </Button>
      </div>
    </Modal>
  );
}

function SendMessageModal({ assigned, onClose }: { assigned: Student[]; onClose: () => void }) {
  const [studentId, setStudentId] = useState(assigned[0]?.id ?? "");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const student = assigned.find((s) => s.id === studentId);
  const canSubmit = !!student && subject.trim().length > 1;

  return (
    <Modal title="Send message" onClose={onClose}>
      <div className="space-y-3">
        <SelectField label="Student" value={studentId} onChange={setStudentId} options={assigned.map((s) => ({ value: s.id, label: s.name }))} />
        <ModalField label="Subject" value={subject} onChange={setSubject} placeholder="e.g. Next steps on your application" />
        <label className="block text-xs font-medium text-slate-500">
          Message
          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={4}
            className="mt-1 w-full resize-none rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[var(--sd-ink)] focus:outline-none"
          />
        </label>
        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={() => {
            if (!student) return;
            window.location.assign(`mailto:${student.email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`);
            onClose();
          }}
        >
          <MailIcon size={14} /> Send via email
        </Button>
      </div>
    </Modal>
  );
}

function ModalField({
  label, value, onChange, placeholder,
}: { label: string; value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[var(--sd-ink)] focus:outline-none"
      />
    </label>
  );
}

function SelectField({
  label, value, onChange, options,
}: { label: string; value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}
