import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, FileText, PlaneTakeoff, AlertCircle, ArrowUp, ArrowDown, ListChecks,
  Zap, UserPlus, FilePlus2, CalendarPlus, Send, Mail as MailIcon, ChevronRight, GraduationCap,
} from "lucide-react";
import { Modal, Button } from "../../../components/ui";
import { SkylineArt } from "../../../components/ui/mobile";
import { staffContact } from "../../../utils/currentStaff";
import { getAllUniversities } from "../../../data/universityCatalogStore";
import { createApplication } from "../../../data/applicationsStore";
import { campusesFor, courseHasOpenIntake } from "../../../utils/universityFilter";
import { COUNSELLOR_ID, activeApplicationsFor, VISA_BUCKET_STATUSES } from "../../../utils/counsellorData";
import { loadAssignedStudents, addStudent } from "../../../data/counsellorStudentsStore";
import {
  loadMeetings, loadDoneMeetingIds, markMeetingDone, meetingStatus, formatMeetingTime, addMeeting, type Meeting,
} from "../../../data/counsellorMeetingsStore";
import { getThreadsList, markThreadRead } from "../../../data/messagesStore";
import { getStatTrends } from "../../../data/staffStatsSnapshotStore";
import { getCounsellorTasks, staffTaskTarget, type DisplayTask } from "../../../utils/taskBoard";
import type { Student, University } from "../../../types";

/** The open intake months for one course — course's own `intakes` subset when set, else the
 * university's full list, filtered down to the ones actually marked open. */
function openIntakesFor(university: University, course: University["courses"][number]): string[] {
  const months = course.intakes && course.intakes.length > 0 ? course.intakes : university.intakes;
  return months.filter((m) => !!university.intakeStatus?.[m]);
}

/** The first course with at least one open intake — undefined if none of them have one. */
function firstOpenCourse(university: University | undefined): University["courses"][number] | undefined {
  return university?.courses.find((c) => courseHasOpenIntake(university, c));
}

function greeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 18) return "Good afternoon";
  return "Good evening";
}

function isSameDay(a: Date, b: Date): boolean {
  return a.toDateString() === b.toDateString();
}

function dateKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** Same red/amber styling the Tasks page uses for a required document/next-step vs. a review task
 * — kept consistent here so a task looks the same whether it's seen on the Dashboard or the full
 * Tasks page. */
function taskRowTone(task: DisplayTask): { card: string; text: string; badge: string } {
  if ((task.source === "document" || task.source === "next-step" || task.source === "finance") && !task.done) {
    return { card: "bg-rose-50/60", text: "text-rose-700", badge: "bg-rose-100 text-rose-600" };
  }
  if (task.source === "review" && !task.done) {
    return { card: "bg-amber-50/60", text: "text-amber-800", badge: "bg-amber-100 text-amber-700" };
  }
  return { card: "", text: "text-slate-800", badge: "bg-slate-100 text-slate-500" };
}

// 3 days back through 10 days ahead — enough that the strip genuinely needs the horizontal
// scroll on mobile rather than always fitting on screen.
function buildDateStrip(): Date[] {
  const today = new Date();
  return Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 3 + i);
    return d;
  });
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
    <div className="flex flex-col items-center rounded-xl border border-slate-100 bg-white p-2.5 text-center shadow-[0_0_10px_rgba(0,0,0,0.05)]">
      <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
      <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
      <p className="w-full truncate text-[11px] text-slate-500">{label}</p>
      {trend === null ? (
        <p className="mt-0.5 text-[10px] font-medium text-slate-300">New</p>
      ) : (
        <p className={`mt-0.5 flex items-center justify-center gap-1 text-[10px] font-medium ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {trend >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />} {Math.abs(trend)}%
        </p>
      )}
    </div>
  );
}

export default function CounsellorDashboard() {
  const navigate = useNavigate();
  const counsellor = staffContact(COUNSELLOR_ID, "counsellor");
  const [, forceTick] = useState(0);
  const [addStudentOpen, setAddStudentOpen] = useState(false);
  const [createAppOpen, setCreateAppOpen] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [sendMessageOpen, setSendMessageOpen] = useState(false);
  const [selectedDate, setSelectedDate] = useState(() => new Date());
  const [dateStrip] = useState(buildDateStrip);

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

  const doneIds = loadDoneMeetingIds();
  // Not-done items first (most urgent — overdue, then happening now, then soonest — at the top),
  // completed ones pushed to the bottom instead of sitting wherever their original time slot falls.
  const TONE_RANK: Record<string, number> = { rose: 0, green: 1, slate: 2, neutral: 3 };
  const meetings = [...loadMeetings()].sort((a, b) => {
    const doneDiff = Number(doneIds.has(a.id)) - Number(doneIds.has(b.id));
    if (doneDiff !== 0) return doneDiff;
    const rankDiff = TONE_RANK[meetingStatus(a, doneIds).tone] - TONE_RANK[meetingStatus(b, doneIds).tone];
    if (rankDiff !== 0) return rankDiff;
    return a.time.localeCompare(b.time);
  });
  const messages = getThreadsList().slice(0, 5);

  // "Today's Task" used to only ever show scheduled meetings — a real task (next step, missing
  // document, pending review) never appeared here at all, and one with no due date especially
  // never had anywhere to show up since it doesn't belong to any specific day on this dashboard's
  // date strip. An undated task is always relevant, so it counts as "today" here; a dated one only
  // counts once it's actually due (today or overdue), the same rule the full Tasks page's calendar
  // view uses for its own "no due date yet" column.
  const todayKey = dateKey(new Date());
  const todaysOpenTasks = getCounsellorTasks(COUNSELLOR_ID).filter((t) => !t.done && (!t.dueDate || t.dueDate <= todayKey));
  const taskTarget = (t: DisplayTask) => staffTaskTarget(t, "/staff/counsellor/students");

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

  function openMessage(m: (typeof messages)[number]) {
    markThreadRead(m.threadId);
    navigate("/staff/counsellor/messages", { state: { counterpart: m.counterpart } });
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

      <div className="mb-4 grid grid-cols-4 gap-1.5 sm:gap-2.5">
        <StatCard icon={<Users size={14} className="text-[#2955C4]" />} tone="bg-[#E7EEFC]" value={assigned.length} label="My Students" trend={trends.students} />
        <StatCard icon={<FileText size={14} className="text-[#0F9D6D]" />} tone="bg-[#E1F5F0]" value={allActiveApps.length} label="Active Applications" trend={trends.applications} />
        <StatCard icon={<PlaneTakeoff size={14} className="text-[#6D3FBF]" />} tone="bg-[#F1EAFB]" value={visaCount} label="Visa in Process" trend={trends.visa} />
        <StatCard icon={<AlertCircle size={14} className="text-[#B8791C]" />} tone="bg-[#FDF0DC]" value={pendingCount} label="Pending Actions" trend={trends.pending} />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)] lg:col-span-2">
          <div className="flex flex-col gap-2 border-b border-slate-100 px-5 py-3.5 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2">
              <ListChecks size={15} className="shrink-0 text-slate-400" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-800">
                  Today's Task <span className="font-normal text-slate-400">— {selectedDate.toLocaleDateString(undefined, { weekday: "short", day: "numeric", month: "short" })}</span>
                </p>
                <p className="text-xs text-slate-400">Your scheduled tasks and important follow-ups.</p>
              </div>
            </div>
            <button onClick={() => navigate("/staff/counsellor/tasks")} className="flex shrink-0 items-center gap-1 text-xs font-medium text-[#2955C4]">
              View All Tasks <ChevronRight size={12} />
            </button>
          </div>

          {/* Horizontal, scrollable date strip — pick any nearby day; only today has real data. */}
          <div className="flex gap-1.5 overflow-x-auto border-b border-slate-100 px-5 py-3 no-scrollbar">
            {dateStrip.map((d) => {
              const active = isSameDay(d, selectedDate);
              const isToday = isSameDay(d, new Date());
              return (
                <button
                  key={d.toDateString()}
                  onClick={() => setSelectedDate(d)}
                  className={`flex shrink-0 flex-col items-center gap-0.5 rounded-lg px-2.5 py-1.5 text-[11px] ${
                    active ? "bg-[image:var(--sd-gradient)] text-white" : isToday ? "bg-slate-100 text-slate-800" : "text-slate-500 hover:bg-slate-50"
                  }`}
                >
                  <span className="font-medium">{d.toLocaleDateString(undefined, { weekday: "short" })}</span>
                  <span className={`font-semibold ${active ? "text-white" : "text-slate-700"}`}>{d.getDate()}</span>
                </button>
              );
            })}
          </div>

          <div className="max-h-80 divide-y divide-slate-50 overflow-y-auto">
            {isSameDay(selectedDate, new Date()) ? (
              meetings.length === 0 && todaysOpenTasks.length === 0 ? (
                <p className="px-5 py-6 text-sm text-slate-400">Nothing scheduled today.</p>
              ) : (
                <>
                  {meetings.map((m) => {
                    const status = meetingStatus(m, doneIds);
                    const openable = !!m.studentId;
                    const done = doneIds.has(m.id);
                    return (
                      <div
                        key={m.id}
                        onClick={openable ? () => navigate(`/staff/counsellor/students/${m.studentId}`) : undefined}
                        className={`flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4 ${done ? "opacity-60" : ""} ${openable ? "cursor-pointer hover:bg-slate-50" : ""}`}
                      >
                        <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                          <div className="w-16 shrink-0 text-xs font-medium text-slate-500">{formatMeetingTime(m.time)}</div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-sm font-medium text-slate-800">{m.title}</p>
                            <p className="truncate text-xs text-slate-400">{m.subtitle}</p>
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center justify-between gap-2 pl-[76px] sm:justify-end sm:pl-0">
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${TONE_CLASS[status.tone]}`}>{status.label}</span>
                          {!done && (
                            <button
                              onClick={(e) => { e.stopPropagation(); runMeetingAction(m); }}
                              className="w-20 shrink-0 rounded-lg border border-slate-200 px-3 py-1.5 text-center text-xs font-medium text-slate-600 hover:bg-slate-50"
                            >
                              {m.action}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  {todaysOpenTasks.map((t) => {
                    const tone = taskRowTone(t);
                    const target = taskTarget(t);
                    return (
                      <div
                        key={t.id}
                        onClick={target ? () => navigate(target.path, { state: target.state }) : undefined}
                        className={`flex flex-col gap-2 px-5 py-3 sm:flex-row sm:items-center sm:gap-4 ${tone.card} ${target ? "cursor-pointer hover:bg-slate-50" : ""}`}
                      >
                        <div className="flex min-w-0 items-center gap-3 sm:flex-1">
                          <div className="w-16 shrink-0 text-xs font-medium text-slate-500">
                            {t.dueDate ? (t.dueDate < todayKey ? "Overdue" : "Due today") : "Any time"}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className={`truncate text-sm font-medium ${tone.text}`}>{t.title}</p>
                            {t.subtitle && <p className="truncate text-xs text-slate-400">{t.subtitle}</p>}
                          </div>
                        </div>
                        <div className="flex shrink-0 items-center justify-end pl-[76px] sm:pl-0">
                          <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium ${tone.badge}`}>
                            {t.source === "next-step" ? "Next Step" : t.source === "review" ? "Review" : t.source === "document" ? "Document" : t.source === "finance" ? "Financial" : "Assigned"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </>
              )
            ) : (
              <p className="px-5 py-6 text-sm text-slate-400">No tasks scheduled for this day yet.</p>
            )}
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
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                    <p className="truncate text-xs text-slate-500">{primary!.nextAction}</p>
                  </div>
                  <ChevronRight size={14} className="shrink-0 text-slate-300" />
                </button>
              ))}
            {assigned.every((s) => activeApplicationsFor(s.id).length === 0) && (
              <p className="px-5 py-6 text-sm text-slate-400">No students with a running application right now.</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <p className="mb-3 text-sm font-semibold text-slate-800">Recent Messages</p>
            <div className="space-y-3">
              {messages.map((m) => {
                const student = m.counterpart.role === "student" ? assigned.find((s) => s.id === m.counterpart.id) : undefined;
                return (
                  <button key={m.threadId} onClick={() => openMessage(m)} className="flex w-full items-center gap-2.5 text-left">
                    <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${student?.avatarColor ?? "bg-slate-400"}`}>
                      {m.counterpart.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-semibold text-slate-800">{m.counterpart.name}</p>
                      <p className="truncate text-[11.5px] text-slate-500">{m.lastMessage.text}</p>
                    </div>
                    {m.unread > 0 && <span className="h-2 w-2 shrink-0 rounded-full bg-rose-500" />}
                  </button>
                );
              })}
              {messages.length === 0 && <p className="text-[12.5px] text-slate-400">No messages yet.</p>}
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
  const UNIVERSITIES = getAllUniversities();
  const [studentId, setStudentId] = useState(assigned[0]?.id ?? "");
  const [universityId, setUniversityId] = useState(UNIVERSITIES[0]?.id ?? "");
  const university = UNIVERSITIES.find((u) => u.id === universityId);
  const openCourses = university?.courses.filter((c) => courseHasOpenIntake(university, c)) ?? [];
  const [courseName, setCourseName] = useState(firstOpenCourse(university)?.name ?? "");
  const course = university?.courses.find((c) => c.name === courseName);
  const campuses = university && course ? campusesFor(university, course) : [];
  const [campus, setCampus] = useState(campuses[0]?.name ?? "");
  const openIntakes = university && course ? openIntakesFor(university, course) : [];
  const [intake, setIntake] = useState(openIntakes[0] ?? "");
  const student = assigned.find((s) => s.id === studentId);
  const canSubmit = !!student && !!university && !!course && courseHasOpenIntake(university, course) && !!campus && !!intake;

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
            const c = firstOpenCourse(u);
            setCourseName(c?.name ?? "");
            setCampus((u && c ? campusesFor(u, c) : [])[0]?.name ?? "");
            setIntake((u && c ? openIntakesFor(u, c) : [])[0] ?? "");
          }}
          options={UNIVERSITIES.map((u) => ({ value: u.id, label: u.name }))}
        />
        {university && (
          openCourses.length > 0 ? (
            <SelectField
              label="Course"
              value={courseName}
              onChange={(v) => {
                setCourseName(v);
                const c = university.courses.find((x) => x.name === v);
                setCampus((c ? campusesFor(university, c) : [])[0]?.name ?? "");
                setIntake((c ? openIntakesFor(university, c) : [])[0] ?? "");
              }}
              options={openCourses.map((c) => ({ value: c.name, label: c.name }))}
            />
          ) : (
            <p className="text-[11px] text-rose-500">No courses at this university currently have an open intake.</p>
          )
        )}
        {university && course && (
          <SelectField label="Campus" value={campus} onChange={setCampus} options={campuses.map((c) => ({ value: c.name, label: c.name }))} />
        )}
        {university && course && (
          openIntakes.length > 0 ? (
            <SelectField label="Intake" value={intake} onChange={setIntake} options={openIntakes.map((i) => ({ value: i, label: i }))} />
          ) : (
            <p className="text-[11px] text-rose-500">This course has no open intake right now.</p>
          )
        )}
        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={async () => {
            if (!student || !university || !course) return;
            await createApplication({ studentId: student.id, university: university.name, course: courseName, intake, country: university.country, campus });
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
