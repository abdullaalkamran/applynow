import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Bell, FileText, CheckCircle2, Clock, Bookmark, MessageCircle, Briefcase, ShieldCheck,
  ChevronRight, Check, Calendar, MapPin, AlertCircle, Wallet, ClipboardCheck,
  BookOpen, Plane, Landmark, Laptop, Wrench, HeartPulse, Palette, Scale, FlaskConical, GraduationCap,
  BarChart3,
} from "lucide-react";
import { SkylineArt, SupportRow, LogoBadge, Pill } from "../../components/ui/mobile";
import { DOCUMENTS, CURRENT_STUDENT_ID, COUNSELLORS, AGENTS } from "../../data/mockData";
import { getAllStudents } from "../../data/allStudentsStore";
import { getAllApplications } from "../../data/applicationsStore";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { loadUploadedDocs } from "../../data/applicationDocsStore";
import { buildChecklist, buildCoreChecklist } from "../../utils/documentChecklist";
import { shortlistedCount } from "../../data/shortlistStore";
import { getProfileCompletion } from "../../data/profileCompletion";
import { loadPreferences } from "../../data/studentProfileDetailsStore";
import { getCountryByName } from "../../data/countryRegistry";
import { countryStats, subjectStats } from "../../utils/universityFilter";
import { COUNTRIES } from "../../data/countries";
import { APPLICATION_STAGES, applicationStageIndex, applicationBucket, applicationStatusTone } from "../../utils/applicationStatus";
import { unreadNotificationCount } from "../../utils/notifications";
import { getStudentTasks, type DisplayTask } from "../../utils/taskBoard";
import { FinancialReadinessCard } from "../../components/FinancialReadinessCard";
import { useAuth } from "../../context/AuthContext";

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

/** Where tapping a "Your Next Steps" item should actually land — a document task goes straight to
 * the application's Documents tab (or the core Documents page, for a core-vault item), a next-step
 * task to that application's Overview, a finance task to any application's Overview (Financial
 * Readiness is one shared record now, not tied to a specific application — see
 * studentFinancialReadinessStore.ts — so there's no specific one to prefer), and anything else (a
 * manually assigned task with no application of its own) falls back to the Tasks page. */
function taskDestination(t: DisplayTask, fallbackApplicationId?: string): { path: string; state?: { tab: "Documents" } } {
  if (t.source === "document") {
    return t.applicationId ? { path: `/student/applications/${t.applicationId}`, state: { tab: "Documents" } } : { path: "/student/documents" };
  }
  if (t.source === "next-step" && t.applicationId) {
    return { path: `/student/applications/${t.applicationId}` };
  }
  if (t.source === "finance" && fallbackApplicationId) {
    return { path: `/student/applications/${fallbackApplicationId}` };
  }
  return { path: "/student/tasks" };
}

const QUICK_ACTIONS = [
  { icon: Search, tone: "blue" as const, title: "Find Programs", subtitle: "Explore 1000+ programs", path: "/student/search" },
  { icon: FileText, tone: "slate" as const, title: "Track Applications", subtitle: "Stay on top", path: "/student/applications" },
  { icon: MessageCircle, tone: "green" as const, title: "Ask AI Counsellor", subtitle: "Get personalized advice", path: "/student/counsellor" },
  { icon: Briefcase, tone: "violet" as const, title: "Manage Documents", subtitle: "Keep everything ready", path: "/student/documents" },
  { icon: ClipboardCheck, tone: "green" as const, title: "Interview Prep", subtitle: "Practice with AI feedback", path: "/student/interview-prep" },
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

// Same deterministic name→tone hash CountryOverview.tsx's CountryHero uses for its own SkylineArt
// fallback — duplicated here (not exported there) so a destination photo card always falls back to
// the same illustrated tone for a given country instead of a random one on every render.
const SKYLINE_TONES = ["violet", "amber", "teal", "rose"] as const;
function skylineToneFor(name: string): (typeof SKYLINE_TONES)[number] {
  const seed = [...name].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return SKYLINE_TONES[seed % SKYLINE_TONES.length];
}

// Purely decorative, rotating icon set for the "Study Guide" rows — one per destination, cycling
// through this fixed list rather than meaning anything topic-specific.
const GUIDE_ICON_TONES = ["violet", "green", "blue", "rose"] as const;
const GUIDE_ICONS = [BookOpen, Plane, Landmark, ShieldCheck];

// Same field-of-study → icon matcher CountryOverview.tsx's "Popular Study Areas" card uses —
// duplicated here (not exported there) for the "Recommended Subjects" row icons.
const SUBJECT_ICONS: { match: RegExp; icon: typeof BookOpen }[] = [
  { match: /business|management|finance|account/i, icon: Briefcase },
  { match: /computer|software|it\b|data|tech/i, icon: Laptop },
  { match: /engineer/i, icon: Wrench },
  { match: /health|medic|nursing|life science/i, icon: HeartPulse },
  { match: /art|design|humanit/i, icon: Palette },
  { match: /law|legal/i, icon: Scale },
  { match: /educat/i, icon: GraduationCap },
  { match: /science/i, icon: FlaskConical },
];
function subjectIcon(subject: string) {
  return (SUBJECT_ICONS.find((s) => s.match.test(subject)) ?? { icon: BookOpen }).icon;
}

/** Small circular "next" affordance — the one true precedent for this shape elsewhere in the app is
 * the round arrow button on Onboarding.tsx's hero (`rounded-full bg-[var(--sd-card)]
 * text-[var(--sd-ink)] shadow`), scaled down here for reuse inside cards/rows. */
function RoundIconButton({ icon }: { icon: React.ReactNode }) {
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sd-card)] text-[var(--sd-ink)] shadow-[0_0_8px_rgba(0,0,0,0.1)]">
      {icon}
    </span>
  );
}

const STEP_WIDTH = 58;

export default function Dashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  // Read fresh on every render (not a module-level snapshot) so this reflects whoever's actually
  // logged in — allStudentsStore's cache warms in the background right after login, and the shell
  // remounts this page once it lands (see syncCache.ts's useCacheSync).
  const student = getAllStudents().find((s) => s.id === CURRENT_STUDENT_ID);
  const financeCardRef = useRef<HTMLDivElement>(null);
  const [, forceTick] = useState(0);
  const [currentApplicationIndex, setCurrentApplicationIndex] = useState(0);
  // Starts empty and fills in on mount so the line visibly advances to the real current stage,
  // instead of just appearing already-filled.
  const [stepperFilled, setStepperFilled] = useState(false);
  useEffect(() => {
    const t = window.setTimeout(() => setStepperFilled(true), 150);
    return () => window.clearTimeout(t);
  }, []);

  const { percent, pendingSteps, requiredRemaining } = getProfileCompletion();
  const allApplications = getAllApplications();
  const universities = getAllUniversities();
  const missingCoreDocs = buildCoreChecklist(CURRENT_STUDENT_ID).filter((row) => !row.own);
  const coreDocsBlocked = missingCoreDocs.length > 0;
  const myApplications = allApplications.filter(
    (a) => a.studentId === CURRENT_STUDENT_ID && !["Withdrawn", "Rejected", "Deferred"].includes(a.status)
  );
  const activeApplications = [...myApplications].sort((a, b) => b.progress - a.progress);
  const offersCount = myApplications.filter((a) => applicationBucket(a.status) === "offer").length;
  const inProgressCount = myApplications.filter((a) => applicationBucket(a.status) === "inProgress").length;
  const savedProgramsCount = shortlistedCount();
  const unreadNotifications = unreadNotificationCount();
  // Capped at 3 so this stays a quick glance, not the full Tasks page — but a plain slice(0, 3)
  // meant Financial Readiness (tone "none", since it has no due date to be "soon"/"overdue" about)
  // regularly lost out to a pile of small per-document tasks and never actually appeared here even
  // while genuinely incomplete. It's pinned first when present so it's never silently crowded out.
  const openStudentTasks = getStudentTasks(CURRENT_STUDENT_ID).filter((t) => !t.done);
  const financeTask = openStudentTasks.find((t) => t.source === "finance");
  const nextStepTasks = financeTask
    ? [financeTask, ...openStudentTasks.filter((t) => t.id !== financeTask.id)].slice(0, 3)
    : openStudentTasks.slice(0, 3);

  const safeApplicationIndex = activeApplications.length > 0 ? currentApplicationIndex % activeApplications.length : 0;
  const primaryApplication = activeApplications[safeApplicationIndex];
  const primaryUniversity = primaryApplication ? universities.find((u) => u.name === primaryApplication.university) : undefined;

  useEffect(() => {
    if (activeApplications.length <= 1) return;
    const timer = window.setInterval(() => {
      setCurrentApplicationIndex((index) => (index + 1) % activeApplications.length);
    }, 4500);
    return () => window.clearInterval(timer);
  }, [activeApplications.length]);

  const outstandingDocs = myApplications.reduce((sum, app) => {
    const university = universities.find((u) => u.name === app.university);
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
  const recommended = [...universities]
    .filter((u) => u.scholarshipsAvailable && !appliedTo.has(u.name))
    .sort((a, b) => rankNumber(a.worldRank) - rankNumber(b.worldRank))[0];
  const recommendedCourse = recommended?.courses[0];

  // Real destinations to spotlight, ranked by real university count (countryStats(), same helper
  // Explore's "Countries" tab uses) — the student's own saved Preferences sort first since that's
  // an explicit choice, but only ever among countries that actually have universities on file.
  // Never padded with fabricated filler: both "Top Destinations" and "Study Guide" below render
  // however many of these (0-4) are real, and hide entirely when there are none.
  const preferredDestinations = loadPreferences()?.destinations ?? [];
  const realCountryStats = countryStats().filter((s) => s.universityCount > 0);
  const rankedCountryStats = [
    ...realCountryStats.filter((s) => preferredDestinations.includes(s.name)),
    ...realCountryStats.filter((s) => !preferredDestinations.includes(s.name)),
  ];
  const topDestinations = rankedCountryStats.slice(0, 4).map((s) => ({
    ...s,
    details: getCountryByName(s.name),
    flag: COUNTRIES.find((c) => c.name === s.name)?.flag,
  }));

  // Same idea as topDestinations above, for fields of study — the student's own saved Preferences
  // (Preferences.fields, minus the catch-all "Other") sort first, each ranked among themselves by
  // real university count, filled out with the catalog's next most-offered real subjects. Both
  // groups are already filtered to universityCount > 0 by subjectStats() itself.
  const preferredFields = (loadPreferences()?.fields ?? []).filter((f) => f !== "Other");
  const bySubjectPopularity = (a: { universityCount: number }, b: { universityCount: number }) => b.universityCount - a.universityCount;
  const realSubjectStats = subjectStats();
  const recommendedSubjects = [
    ...realSubjectStats.filter((s) => preferredFields.includes(s.name)).sort(bySubjectPopularity),
    ...realSubjectStats.filter((s) => !preferredFields.includes(s.name)).sort(bySubjectPopularity),
  ].slice(0, 4);

  // Only reachable once allStudentsStore's cache has actually resolved — brief on a fresh login,
  // matching the same trade-off every other migrated store makes (see syncCache.ts's doc comment).
  if (!student) {
    return <p className="p-5 text-sm text-slate-400">Loading your dashboard…</p>;
  }
  const initials = student.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const firstName = student.name.split(" ")[0];
  const myCounsellor = COUNSELLORS.find((c) => c.id === student.counsellorId);
  const myAgent = AGENTS.find((a) => a.id === student.agentId);

  // Nothing else on the home page — recommendations, applications, tasks — means anything until the
  // required parts of the profile are filled in (same gate as Explore/Apply); showing any of it
  // early just invites exploring/applying from a profile no one downstream can actually act on.
  if (requiredRemaining > 0) {
    const nextStep = pendingSteps.find((s) => s.required) ?? pendingSteps[0];
    return (
      <div className="px-5 pb-6 pt-6 lg:px-10 lg:pb-10 lg:pt-8">
        <div className="lg:mx-auto lg:max-w-6xl">
          <h1 className="text-[15px] font-bold text-slate-900">StudyOne</h1>
          <div className="mt-10 flex flex-col items-center px-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-rose-50 text-rose-600">
              <AlertCircle size={26} />
            </div>
            <h2 className="mt-4 text-[19px] font-bold text-slate-900">Welcome, {firstName} — let's finish your profile</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-slate-500">
              We need {requiredRemaining} more required step{requiredRemaining > 1 ? "s" : ""} before your dashboard, recommendations, and applications become available.
            </p>
            <button
              onClick={() => navigate(nextStep.path)}
              className="mt-5 rounded-xl bg-[image:var(--sd-gradient)] px-6 py-3 text-[13px] font-semibold text-white"
            >
              Complete Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

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
          <StatCard icon={<Bookmark size={16} />} tone="violet" value={savedProgramsCount} label="Saved Programs" onClick={() => navigate("/student/search?shortlisted=1")} />
        </div>

        <div className="lg:mt-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
          <div className="lg:col-span-2">
            {/* Required actions — next steps, rejected documents needing a re-upload, and any task
                a counsellor/agent has assigned — surfaced first, above the current application
                summary, since these are the things actually waiting on the student right now. */}
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-semibold text-slate-900">Your Next Steps</h2>
              <button onClick={() => navigate("/student/tasks")} className="text-[13px] font-medium text-[#2955C4]">
                View All
              </button>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]">
              {requiredRemaining > 0 && (
                <button
                  onClick={() => navigate((pendingSteps.find((s) => s.required) ?? pendingSteps[0]).path)}
                  className={`flex w-full items-center gap-3 px-4 py-3.5 text-left bg-rose-50/60 ${nextStepTasks.length > 0 ? "border-b border-slate-50" : ""}`}
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                    <AlertCircle size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-rose-700">Complete your profile</p>
                    <p className="truncate text-xs text-rose-500">
                      {requiredRemaining} required step{requiredRemaining > 1 ? "s" : ""} left — needed to explore and apply to programs
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-rose-300" />
                </button>
              )}
              {nextStepTasks.length === 0 && requiredRemaining === 0 ? (
                <p className="px-4 py-6 text-center text-sm text-slate-400">You're all caught up — no open tasks.</p>
              ) : (
                nextStepTasks.map((t, i) => {
                  const Icon = t.source === "document" ? FileText : t.source === "next-step" ? CheckCircle2 : t.source === "finance" ? Wallet : ShieldCheck;
                  // A next-step, document, or finance task is required by definition — it only
                  // exists while still outstanding (see taskBoard.ts) — so it's red regardless of
                  // due date, same as everywhere else in the app; a plain manually assigned task
                  // keeps the due-date-based tone since it isn't inherently "required" the same way.
                  const required = t.source === "document" || t.source === "next-step" || t.source === "finance";
                  const tone = required ? "rose" : t.tone === "overdue" ? "rose" : t.tone === "soon" ? "blue" : "slate";
                  return (
                    <button
                      key={t.id}
                      onClick={() => {
                        // Financial Readiness is filled in right on this page, below the Current
                        // Application section (see FinancialReadinessCard) — scroll to it rather
                        // than navigating away or popping up a modal over the page.
                        if (t.source === "finance") { financeCardRef.current?.scrollIntoView({ behavior: "smooth", block: "center" }); return; }
                        const dest = taskDestination(t, primaryApplication?.id);
                        navigate(dest.path, dest.state ? { state: dest.state } : undefined);
                      }}
                      className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${required ? "bg-rose-50/60" : ""} ${i !== nextStepTasks.length - 1 ? "border-b border-slate-50" : ""}`}
                    >
                      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full ${iconBg[tone]}`}>
                        <Icon size={16} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-sm font-medium ${required ? "text-rose-700" : "text-slate-800"}`}>{t.title}</p>
                        <p className={`truncate text-xs ${required ? "text-rose-500" : "text-slate-400"}`}>
                          {t.subtitle}
                          {t.dueDate && (
                            <span className={t.tone === "overdue" ? "font-medium text-rose-500" : ""}>
                              {" — Due "}{new Date(`${t.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronRight size={16} className={`shrink-0 ${required ? "text-rose-300" : "text-slate-300"}`} />
                    </button>
                  );
                })
              )}
            </div>

            {primaryApplication && (
              <div className="mt-6">
                <div className="overflow-hidden rounded-2xl border border-slate-100 bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                  <div
                    className="flex transition-transform duration-700 ease-out"
                    style={{ transform: `translateX(-${safeApplicationIndex * 100}%)` }}
                  >
                    {activeApplications.map((app, index) => {
                      const university = universities.find((u) => u.name === app.university);
                      const stageIndex = applicationStageIndex(app.status);
                      return (
                        <div key={app.id} className="w-full shrink-0 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Current Application</p>
                              <p className="mt-1 text-[11px] text-slate-400">
                                {activeApplications.length > 1 ? `${index + 1} of ${activeApplications.length} running applications` : "1 running application"}
                              </p>
                            </div>
                            <button
                              onClick={() => navigate(`/student/applications/${app.id}`)}
                              className="flex shrink-0 items-center gap-1 rounded-full bg-slate-50 px-3 py-1.5 text-[11px] font-medium text-[#2955C4]"
                            >
                              Details <ChevronRight size={13} />
                            </button>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <LogoBadge name={app.university} tone={university?.tone ?? "violet"} logoUrl={university?.logoUrl} className="h-11 w-11 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-semibold text-slate-900">{app.university}</p>
                              <p className="truncate text-xs text-slate-400">{app.course}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar size={11} className="text-slate-400" /> {app.intake}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={11} className="text-slate-400" /> {app.campus ?? "Main Campus"}
                                </span>
                              </div>
                            </div>
                            <Pill tone={applicationStatusTone(app.status)} className="hidden shrink-0 sm:inline-flex">
                              {app.status}
                            </Pill>
                          </div>

                          {coreDocsBlocked && (
                            <button
                              onClick={() => navigate("/student/documents")}
                              className="mt-3 flex w-full items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-left"
                            >
                              <AlertCircle size={14} className="shrink-0 text-amber-700" />
                              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-amber-900">
                                Upload core documents before this application can move forward
                              </span>
                              <ChevronRight size={13} className="shrink-0 text-amber-700" />
                            </button>
                          )}

                          <div className="mt-4 overflow-x-auto pb-1">
                            <div className="relative" style={{ width: APPLICATION_STAGES.length * STEP_WIDTH }}>
                              <div
                                className="absolute top-3 h-0.5 rounded-full bg-slate-200"
                                style={{ left: STEP_WIDTH / 2, width: (APPLICATION_STAGES.length - 1) * STEP_WIDTH }}
                              />
                              <div
                                className="absolute top-3 h-0.5 rounded-full bg-[#2955C4] transition-[width] duration-1000 ease-out"
                                style={{ left: STEP_WIDTH / 2, width: stepperFilled ? stageIndex * STEP_WIDTH : 0 }}
                              />
                              <div className="relative flex">
                                {APPLICATION_STAGES.map((stage, i) => {
                                  const done = i < stageIndex;
                                  const current = i === stageIndex;
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
                        </div>
                      );
                    })}
                  </div>
                </div>
                {activeApplications.length > 1 && (
                  <div className="mt-2 flex justify-center gap-1.5">
                    {activeApplications.map((app, index) => (
                      <button
                        key={app.id}
                        onClick={() => setCurrentApplicationIndex(index)}
                        aria-label={`Show application ${index + 1}`}
                        className={`h-1.5 rounded-full transition-all ${index === safeApplicationIndex ? "w-5 bg-[#2955C4]" : "w-1.5 bg-slate-200"}`}
                      />
                    ))}
                  </div>
                )}
              </div>
            )}

            {user && (
              <div ref={financeCardRef}>
                <FinancialReadinessCard
                  studentId={student.id}
                  actor={{ id: user.roleUserId, role: user.role, name: user.name }}
                  onSaved={() => forceTick((t) => t + 1)}
                />
              </div>
            )}

            <h2 className="text-[15px] font-semibold text-slate-900">Quick Actions</h2>
            <div className="mt-3 flex items-start justify-between gap-2">
              {QUICK_ACTIONS.map((a) => (
                <button key={a.title} onClick={() => navigate(a.path)} className="flex flex-col items-center gap-1.5">
                  <span className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full sm:h-16 sm:w-16 ${iconBg[a.tone]}`}>
                    <a.icon size={22} className="sm:hidden" />
                    <a.icon size={26} className="hidden sm:block" />
                  </span>
                  <span className="max-w-[64px] text-center text-[10.5px] font-medium leading-tight text-slate-600 sm:max-w-[76px] sm:text-[11.5px]">
                    {a.title}
                  </span>
                </button>
              ))}
            </div>

            {recommended && recommendedCourse && (
              <>
                <div className="mt-6 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-slate-900">Recommended</h2>
                  <button onClick={() => navigate("/student/search")} className="flex items-center gap-0.5 text-[13px] font-medium text-[#2955C4]">
                    See all <ChevronRight size={14} />
                  </button>
                </div>
                <button
                  onClick={() => navigate(`/student/universities/${recommended.id}`, { state: { selectedCourseName: recommendedCourse.name } })}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-3.5 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)]"
                >
                  <LogoBadge name={recommended.name} tone={recommended.tone} logoUrl={recommended.logoUrl} className="h-14 w-14 shrink-0 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[13.5px] font-semibold text-slate-900">{recommendedCourse.name}</p>
                    <p className="truncate text-xs text-slate-400">{recommended.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1">
                        <BarChart3 size={11} className="text-slate-400" /> {recommended.worldRank}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} className="text-slate-400" /> {recommended.openIntake}
                      </span>
                      {recommended.scholarshipsAvailable && (
                        <span className="inline-flex items-center gap-1 text-[#12805A]">
                          <ShieldCheck size={12} />
                        </span>
                      )}
                    </div>
                  </div>
                  <RoundIconButton icon={<ChevronRight size={16} />} />
                </button>
              </>
            )}

            {topDestinations.length > 0 && (
              <>
                <div className="mt-6 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-slate-900">Top Destinations</h2>
                  <button onClick={() => navigate("/student/search")} className="flex items-center gap-0.5 text-[13px] font-medium text-[#2955C4]">
                    See all <ChevronRight size={14} />
                  </button>
                </div>
                <div className="mt-3 grid grid-cols-4 gap-2 sm:gap-3">
                  {topDestinations.map((d) => (
                    <button
                      key={d.name}
                      onClick={() => navigate(`/student/countries/${encodeURIComponent(d.name)}`)}
                      aria-label={d.name}
                      className="relative aspect-[4/5] overflow-hidden rounded-2xl"
                    >
                      {d.details?.photoUrl ? (
                        <img src={d.details.photoUrl} alt={d.name} className="h-full w-full object-cover" />
                      ) : (
                        <SkylineArt tone={skylineToneFor(d.name)} className="h-full w-full" />
                      )}
                      {d.flag && (
                        <span className="absolute bottom-2 left-2 flex h-8 w-8 items-center justify-center rounded-full bg-white text-lg leading-none shadow">
                          {d.flag}
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {topDestinations.length > 0 && (
              <>
                <div className="mt-6 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-slate-900">Study Guide</h2>
                  <button onClick={() => navigate("/student/search")} className="flex items-center gap-0.5 text-[13px] font-medium text-[#2955C4]">
                    See all <ChevronRight size={14} />
                  </button>
                </div>
                {topDestinations.map((d, i) => {
                  const GuideIcon = GUIDE_ICONS[i % GUIDE_ICONS.length];
                  const tone = GUIDE_ICON_TONES[i % GUIDE_ICON_TONES.length];
                  return (
                    <button
                      key={d.name}
                      onClick={() => navigate(`/student/countries/${encodeURIComponent(d.name)}`)}
                      className="mt-3 flex w-full items-center gap-3.5 rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)]"
                    >
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${iconBg[tone]}`}>
                        <GuideIcon size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-slate-900">Studying in {d.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {d.universityCount} {d.universityCount === 1 ? "university" : "universities"}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">
                          {d.details?.whyThisCountry?.split("\n")[0] ?? `${d.courseCount} programs available`}
                        </p>
                      </div>
                      <RoundIconButton icon={<ChevronRight size={16} />} />
                    </button>
                  );
                })}
              </>
            )}

            {recommendedSubjects.length > 0 && (
              <>
                <div className="mt-6 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-slate-900">Recommended Subjects</h2>
                  <button onClick={() => navigate("/student/search")} className="flex items-center gap-0.5 text-[13px] font-medium text-[#2955C4]">
                    See all <ChevronRight size={14} />
                  </button>
                </div>
                {recommendedSubjects.map((s, i) => {
                  const SubjectIcon = subjectIcon(s.name);
                  const tone = GUIDE_ICON_TONES[i % GUIDE_ICON_TONES.length];
                  return (
                    <button
                      key={s.name}
                      onClick={() => navigate(`/student/subjects/${encodeURIComponent(s.name)}`)}
                      className="mt-3 flex w-full items-center gap-3.5 rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)]"
                    >
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${iconBg[tone]}`}>
                        <SubjectIcon size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-slate-900">{s.name}</p>
                        <p className="mt-1 text-xs text-slate-500">
                          {s.universityCount} {s.universityCount === 1 ? "university" : "universities"}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-500">offering this subject</p>
                      </div>
                      <RoundIconButton icon={<ChevronRight size={16} />} />
                    </button>
                  );
                })}
              </>
            )}

            {/* The urgent, required case is already surfaced at the top of "Your Next Steps" above —
                this is only the softer "finish the optional bits" nudge once nothing required is
                left, so the same message isn't shown twice. */}
            {pendingSteps.length > 0 && requiredRemaining === 0 && (
              <button
                onClick={() => navigate(pendingSteps[0].path)}
                className="mt-6 flex w-full items-center justify-between rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)]"
              >
                <span className="text-[12.5px] text-slate-600">
                  Profile {percent}% complete · finish up
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
