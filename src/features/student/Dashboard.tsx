import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Bell, FileText, CheckCircle2, Clock, Bookmark, MessageCircle, Briefcase, ShieldCheck,
  ChevronRight, Check, TrendingUp, Calendar, Award,
} from "lucide-react";
import { SkylineArt, SupportRow, LogoBadge } from "../../components/ui/mobile";
import { STUDENTS, UNIVERSITIES, DOCUMENTS, CURRENT_STUDENT_ID, COUNSELLORS, AGENTS } from "../../data/mockData";
import { getAllApplications } from "../../data/applicationsStore";
import { loadUploadedDocs } from "../../data/applicationDocsStore";
import { buildChecklist, buildCoreChecklist } from "../../utils/documentChecklist";
import { shortlistedCount } from "../../data/shortlistStore";
import { getProfileCompletion } from "../../data/profileCompletion";
import { APPLICATION_STAGES, applicationStageIndex, applicationBucket } from "../../utils/applicationStatus";
import { unreadNotificationCount } from "../../utils/notifications";
import { getStudentTasks } from "../../utils/taskBoard";

const student = STUDENTS.find((s) => s.id === CURRENT_STUDENT_ID)!;
const initials = student.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
const firstName = student.name.split(" ")[0];
const myCounsellor = COUNSELLORS.find((c) => c.id === student.counsellorId);
const myAgent = AGENTS.find((a) => a.id === student.agentId);

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

const QUICK_ACTIONS = [
  { icon: Search, tone: "blue" as const, title: "Find Programs", subtitle: "Explore 1000+ programs", path: "/student/search" },
  { icon: FileText, tone: "slate" as const, title: "Track Applications", subtitle: "Stay on top", path: "/student/applications" },
  { icon: MessageCircle, tone: "green" as const, title: "Ask AI Counsellor", subtitle: "Get personalized advice", path: "/student/counsellor" },
  { icon: Briefcase, tone: "violet" as const, title: "Manage Documents", subtitle: "Keep everything ready", path: "/student/documents" },
];

const iconBg: Record<string, string> = {
  blue: "bg-[#E7EEFC] text-[#2955C4]",
  green: "bg-[#E3F6EC] text-[#12805A]",
  violet: "bg-[#F1EAFB] text-[#6D3FBF]",
  rose: "bg-[#FCEAE8] text-[#D8473C]",
  slate: "bg-slate-100 text-slate-500",
};

function rankNumber(rank: string) {
  return parseInt(rank.replace(/\D/g, ""), 10) || Infinity;
}

const STEP_WIDTH = 58;

export default function Dashboard() {
  const navigate = useNavigate();
  // Starts empty and fills in on mount so the line visibly advances to the real current stage,
  // instead of just appearing already-filled.
  const [stepperFilled, setStepperFilled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setStepperFilled(true), 150);
    return () => window.clearTimeout(t);
  }, []);

  const { percent, pendingSteps, requiredRemaining } = getProfileCompletion();
  const allApplications = getAllApplications();
  const myApplications = allApplications.filter(
    (a) => a.studentId === CURRENT_STUDENT_ID && !["Withdrawn", "Rejected", "Deferred"].includes(a.status)
  );
  const offersCount = myApplications.filter((a) => applicationBucket(a.status) === "offer").length;
  const inProgressCount = myApplications.filter((a) => applicationBucket(a.status) === "inProgress").length;
  const savedProgramsCount = shortlistedCount();
  const unreadNotifications = unreadNotificationCount();
  const nextStepTasks = getStudentTasks(CURRENT_STUDENT_ID).filter((t) => !t.done).slice(0, 3);

  const primaryApplication = [...myApplications].sort((a, b) => b.progress - a.progress)[0];
  const primaryUniversity = primaryApplication ? UNIVERSITIES.find((u) => u.name === primaryApplication.university) : undefined;
  const currentStageIdx = primaryApplication ? applicationStageIndex(primaryApplication.status) : 0;

  const outstandingDocs = myApplications.reduce((sum, app) => {
    const university = UNIVERSITIES.find((u) => u.name === app.university);
    if (!university) return sum;
    const docs = [
      ...DOCUMENTS.filter((d) => d.studentId === CURRENT_STUDENT_ID && d.applicationId === app.id),
      ...loadUploadedDocs(app.id),
    ];
    const missing = buildChecklist(university, app.studentId, app.id, docs).filter((r) => !r.own && !r.reused).length;
    return sum + missing;
  }, buildCoreChecklist(CURRENT_STUDENT_ID).filter((r) => !r.own).length);

  // A real, unapplied-to university with a scholarship on offer, best-ranked first — not a
  // fabricated example.
  const appliedTo = new Set(myApplications.map((a) => a.university));
  const recommended = [...UNIVERSITIES]
    .filter((u) => u.scholarshipsAvailable && !appliedTo.has(u.name))
    .sort((a, b) => rankNumber(a.worldRank) - rankNumber(b.worldRank))[0];
  const recommendedCourse = recommended?.courses[0];

  return (
    <div className="px-5 pb-6 pt-6 lg:px-10 lg:pb-10 lg:pt-8">
      <div className="lg:mx-auto lg:max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-bold text-slate-900">StudyOne</h1>
            <p className="text-[11px] text-slate-400">Global Education. A Brighter You.</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/student/search")}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
            >
              <Search size={16} />
            </button>
            <button
              onClick={() => navigate("/student/notifications")}
              aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
            >
              <Bell size={16} />
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate("/student/profile")}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
            >
              {initials}
            </button>
          </div>
        </div>

        <div className="relative mt-5 overflow-hidden">
          <div className="pointer-events-none absolute -right-6 -top-2 h-28 w-28 shrink-0 overflow-hidden rounded-full opacity-90 sm:h-36 sm:w-36">
            <SkylineArt tone={primaryUniversity?.tone ?? "violet"} className="h-full w-full" />
            <div className="absolute inset-0 flex items-center justify-center bg-[var(--sd-ink)]/10 p-3 text-center text-[8px] font-medium italic leading-tight tracking-wide text-white">
              A brighter you abroad
            </div>
          </div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">{greeting()}</p>
          <h2 className="mt-1 max-w-[65%] text-[34px] font-bold leading-none text-slate-900 sm:text-[40px]">{firstName}</h2>
          <p className="mt-2 max-w-[70%] text-[13px] text-slate-500">You're one step closer to your global future.</p>
        </div>

        <div className="mt-6 grid grid-cols-4 gap-2 sm:gap-3">
          <StatCard icon={<FileText size={16} />} tone="blue" value={myApplications.length} label="Applications" onClick={() => navigate("/student/applications")} />
          <StatCard icon={<CheckCircle2 size={16} />} tone="green" value={offersCount} label="Offers" onClick={() => navigate("/student/applications")} />
          <StatCard icon={<Clock size={16} />} tone="slate" value={inProgressCount} label="In Progress" onClick={() => navigate("/student/applications")} />
          <StatCard icon={<Bookmark size={16} />} tone="violet" value={savedProgramsCount} label="Saved Programs" onClick={() => navigate("/student/search")} />
        </div>

        <div className="lg:mt-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
          <div className="lg:col-span-2">
            {primaryApplication && (
              <button
                onClick={() => navigate(`/student/applications/${primaryApplication.id}`)}
                className="mt-5 block w-full rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)] lg:mt-0"
              >
                <div className="flex items-center justify-between">
                  <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Current Application</p>
                  <ChevronRight size={15} className="text-slate-300" />
                </div>
                <div className="mt-2 flex items-center gap-3">
                  <LogoBadge name={primaryApplication.university} tone={primaryUniversity?.tone ?? "violet"} className="h-11 w-11 shrink-0" />
                  <div className="min-w-0">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{primaryApplication.university}</p>
                    <p className="truncate text-xs text-slate-400">{primaryApplication.course}</p>
                  </div>
                </div>

                <div className="mt-4 overflow-x-auto pb-1">
                  <div className="relative" style={{ width: APPLICATION_STAGES.length * STEP_WIDTH }}>
                    <div
                      className="absolute top-3 h-0.5 rounded-full bg-slate-200"
                      style={{ left: STEP_WIDTH / 2, width: (APPLICATION_STAGES.length - 1) * STEP_WIDTH }}
                    />
                    <div
                      className="absolute top-3 h-0.5 rounded-full bg-[#2955C4] transition-[width] duration-1000 ease-out"
                      style={{ left: STEP_WIDTH / 2, width: stepperFilled ? currentStageIdx * STEP_WIDTH : 0 }}
                    />
                    <div className="relative flex">
                      {APPLICATION_STAGES.map((stage, i) => {
                        const done = i < currentStageIdx;
                        const current = i === currentStageIdx;
                        return (
                          <div key={stage} className="flex shrink-0 flex-col items-center" style={{ width: STEP_WIDTH }}>
                            <div className="relative flex h-6 w-6 shrink-0 items-center justify-center">
                              {current && <span className="absolute inset-0 -z-10 animate-ping rounded-full bg-[var(--sd-ink)]/40" />}
                              <div
                                className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full transition-colors duration-500 ${
                                  done ? "bg-[#2955C4] text-white" : current ? "bg-[image:var(--sd-gradient)] text-white" : "bg-slate-100"
                                }`}
                              >
                                {done ? <Check size={12} /> : current ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                              </div>
                            </div>
                            <p className={`mt-1.5 text-center text-[9.5px] leading-tight ${current ? "font-semibold text-[var(--sd-ink)]" : done ? "text-slate-500" : "text-slate-300"}`}>
                              {stage.replace("Application ", "").replace(" Verified", "").replace(" Application", "")}
                            </p>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              </button>
            )}

            <div className="mt-6 flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-900">Your Next Steps</h2>
              <button onClick={() => navigate("/student/tasks")} className="text-[13px] font-medium text-[#2955C4]">
                View All
              </button>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]">
              {nextStepTasks.length === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">You're all caught up — no open tasks.</p>
              ) : (
                nextStepTasks.map((t, i) => {
                  const Icon = t.source === "document" ? FileText : t.source === "next-step" ? CheckCircle2 : ShieldCheck;
                  const tone = t.tone === "overdue" ? "rose" : t.tone === "soon" ? "blue" : "slate";
                  return (
                    <button
                      key={t.id}
                      onClick={() => navigate("/student/tasks")}
                      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${i !== nextStepTasks.length - 1 ? "border-b border-slate-50" : ""}`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg[tone]}`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
                        <p className="truncate text-xs text-slate-400">
                          {t.subtitle}
                          {t.dueDate && (
                            <span className={t.tone === "overdue" ? "font-medium text-rose-500" : ""}>
                              {" — Due "}{new Date(`${t.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronRight size={16} className="shrink-0 text-slate-300" />
                    </button>
                  );
                })
              )}
            </div>

            <h2 className="mt-6 text-[15px] font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
              {QUICK_ACTIONS.map((a) => (
                <button
                  key={a.title}
                  onClick={() => navigate(a.path)}
                  className="rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-2 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)] sm:p-4"
                >
                  <div className={`flex h-7 w-7 items-center justify-center rounded-full sm:h-10 sm:w-10 ${iconBg[a.tone]}`}>
                    <a.icon size={14} className="sm:hidden" />
                    <a.icon size={18} className="hidden sm:block" />
                  </div>
                  <p className="mt-2 text-[10.5px] font-semibold leading-tight text-slate-900 sm:mt-3 sm:text-[13px]">{a.title}</p>
                  <p className="mt-0.5 hidden text-[11px] text-slate-400 sm:block">{a.subtitle}</p>
                  <ChevronRight size={13} className="mt-2 hidden text-slate-300 sm:block" />
                </button>
              ))}
            </div>

            {recommended && recommendedCourse && (
              <>
                <div className="mt-6 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-slate-900">Recommended for You</h2>
                  <button onClick={() => navigate("/student/search")} className="text-[13px] font-medium text-[#2955C4]">
                    View All
                  </button>
                </div>
                <button
                  onClick={() => navigate(`/student/universities/${recommended.id}`, { state: { selectedCourseName: recommendedCourse.name } })}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-3 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)]"
                >
                  <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl">
                    <SkylineArt tone={recommended.tone} className="h-full w-full" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-slate-900">{recommendedCourse.name}</p>
                    <p className="truncate text-xs text-slate-400">{recommended.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <TrendingUp size={11} className="text-slate-400" /> {recommended.worldRank}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} className="text-slate-400" /> {recommended.openIntake}
                      </span>
                      <span className="inline-flex items-center gap-1 text-[#12805A]">
                        <Award size={11} /> Scholarships Available
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-slate-300" />
                </button>
              </>
            )}

            {pendingSteps.length > 0 && (
              <button
                onClick={() => navigate(pendingSteps[0].path)}
                className="mt-6 flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)]"
              >
                <span className="text-[12.5px] text-slate-600">
                  Profile {percent}% complete
                  {requiredRemaining > 0 ? ` · ${requiredRemaining} required step${requiredRemaining > 1 ? "s" : ""} left` : " · finish up"}
                  {outstandingDocs > 0 ? ` · ${outstandingDocs} document${outstandingDocs > 1 ? "s" : ""} needed` : ""}
                </span>
                <ChevronRight size={14} className="shrink-0 text-slate-300" />
              </button>
            )}
          </div>

          <div className="lg:col-span-1">
            {(myCounsellor || myAgent) && (
              <>
                <h2 className="mt-6 text-[15px] font-semibold text-slate-900 lg:mt-0">Your Support Team</h2>
                <div className="mt-3 overflow-hidden rounded-2xl bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                  {myCounsellor && <SupportRow contact={myCounsellor} onChat={() => navigate("/student/messages")} />}
                  {myCounsellor && myAgent && <div className="border-t border-slate-50" />}
                  {myAgent && <SupportRow contact={myAgent} onChat={() => navigate("/student/messages")} />}
                </div>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  icon, tone, value, label, onClick,
}: { icon: React.ReactNode; tone: keyof typeof iconBg; value: number; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-2 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)] sm:p-3.5">
      <div className={`flex h-7 w-7 items-center justify-center rounded-full sm:h-9 sm:w-9 ${iconBg[tone]}`}>{icon}</div>
      <p className="mt-2 text-[17px] font-bold leading-none text-slate-900 sm:mt-2.5 sm:text-[22px]">{value}</p>
      <div className="mt-1 flex items-start justify-between gap-0.5">
        <span className="text-[9.5px] leading-tight text-slate-500 sm:text-[11.5px]">{label}</span>
        <ChevronRight size={11} className="mt-0.5 hidden shrink-0 text-slate-300 sm:block" />
      </div>
    </button>
  );
}
