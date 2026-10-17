import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, Bell, FileText, CheckCircle2, MessageCircle, Briefcase, ShieldCheck,
  ChevronRight, Check, Calendar, MapPin, AlertCircle, Wallet, ClipboardCheck,
  BookOpen, Plane, Landmark, Laptop, Wrench, HeartPulse, Palette, Scale, FlaskConical, GraduationCap,
  BarChart3, Clock3, ListChecks,
} from "lucide-react";
import { CountryBadge } from "../../components/ui/CountryBadge";
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
import { APPLICATION_STAGES, applicationStageIndex, applicationBucket, applicationStatusTone } from "../../utils/applicationStatus";
import { unreadNotificationCount } from "../../utils/notifications";
import { getStudentTasks, type DisplayTask } from "../../utils/taskBoard";
import { FinancialReadinessCard } from "../../components/FinancialReadinessCard";
import { useAuth } from "../../context/AuthContext";

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
  { icon: ListChecks, tone: "slate" as const, title: "Tasks", subtitle: "Everything left to do", path: "/student/tasks" },
  { icon: ClipboardCheck, tone: "green" as const, title: "Interview Prep", subtitle: "Practice with AI feedback", path: "/student/interview-prep" },
];

// Next-step status colours — the one colour kept in the monochrome app: red = required / overdue, amber = waiting on
// review or due soon.
const STEP_TONE = {
  red: { title: "text-red-700", sub: "text-red-600/80", icon: "text-red-600", chevron: "text-red-400" },
  amber: { title: "text-amber-700", sub: "text-amber-700/80", icon: "text-amber-600", chevron: "text-amber-500" },
  none: { title: "text-neutral-800", sub: "text-neutral-500", icon: "text-neutral-900", chevron: "text-neutral-400" },
} as const;

// Raised round surfaces, black line icons — monochrome; the tone only used to pick a colour before.
const iconBg: Record<string, string> = {
  blue: "bg-[var(--sd-card)] text-neutral-900 shadow-neu-sm",
  green: "bg-[var(--sd-card)] text-neutral-900 shadow-neu-sm",
  violet: "bg-[var(--sd-card)] text-neutral-900 shadow-neu-sm",
  rose: "bg-[var(--sd-card)] text-neutral-900 shadow-neu-sm",
  slate: "bg-[var(--sd-card)] text-neutral-500 shadow-neu-sm",
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
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sd-card)] text-[var(--sd-ink)] shadow-neu-sm">
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
  // Proof documents for a bank that now holds the student's funds (Bank Statement / Solvency Certificate) are the most
  // time-sensitive of the document tasks, so they rank right after Financial Readiness itself.
  const isBankProofTask = (t: { title: string }) => /^(Re-upload|Upload) (Bank Statement|Solvency Certificate) —/.test(t.title);
  const bankProofTasks = openStudentTasks.filter(isBankProofTask);
  const orderedTasks = [
    ...(financeTask ? [financeTask] : []),
    ...bankProofTasks,
    ...openStudentTasks.filter((t) => t.id !== financeTask?.id && !isBankProofTask(t)),
  ];
  const nextStepTasks = orderedTasks.slice(0, 3);

  const safeApplicationIndex = activeApplications.length > 0 ? currentApplicationIndex % activeApplications.length : 0;
  const primaryApplication = activeApplications[safeApplicationIndex];

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

  // Documents the student has uploaded that are still waiting for the counsellor to verify them.
  const pendingVerification = myApplications.reduce((sum, app) => {
    const university = universities.find((u) => u.name === app.university);
    const docs = [
      ...DOCUMENTS.filter((d) => d.studentId === CURRENT_STUDENT_ID && d.applicationId === app.id),
      ...loadUploadedDocs(app.id),
    ];
    return sum + buildChecklist(university, app.studentId, app.id, docs).filter((r) => r.own?.status === "uploaded").length;
  }, buildCoreChecklist(CURRENT_STUDENT_ID).filter((r) => r.own?.status === "uploaded").length);

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
    return <p className="p-5 text-sm text-neutral-400">Loading your dashboard…</p>;
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
          <h1 className="text-[15px] font-bold text-neutral-900">UnifinderAi</h1>
          <div className="mt-10 flex flex-col items-center px-4 py-16 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--sd-card)] shadow-neu-inset-sm text-neutral-900">
              <AlertCircle size={26} />
            </div>
            <h2 className="mt-4 text-xl font-bold text-neutral-900">Welcome, {firstName} — let's finish your profile</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-neutral-500">
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
    <div className="profile-compact px-5 pb-6 pt-6 lg:px-10 lg:pb-10 lg:pt-8">
      <div className="lg:mx-auto lg:max-w-6xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-[15px] font-bold text-neutral-900">UnifinderAi</h1>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/student/search")}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-600 shadow-neu-sm"
            >
              <Search size={16} />
            </button>
            <button
              onClick={() => navigate("/student/notifications")}
              aria-label={unreadNotifications > 0 ? `Notifications, ${unreadNotifications} unread` : "Notifications"}
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-600 shadow-neu-sm"
            >
              <Bell size={16} />
              {unreadNotifications > 0 && (
                <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-neutral-900 px-1 text-[11px] font-semibold text-white">
                  {unreadNotifications > 9 ? "9+" : unreadNotifications}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate("/student/profile")}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-neutral-900 text-xs font-semibold text-white shadow-neu-dark"
            >
              {initials}
            </button>
          </div>
        </div>

        <div className="mt-5 grid grid-cols-4 gap-2 sm:gap-3">
          <StatCard value={myApplications.length} label="Applications" onClick={() => navigate("/student/applications")} />
          <StatCard value={offersCount} label="Offers" onClick={() => navigate("/student/applications")} />
          <StatCard value={inProgressCount} label="In Progress" onClick={() => navigate("/student/applications")} />
          <StatCard value={savedProgramsCount} label="Saved Programs" onClick={() => navigate("/student/search?shortlisted=1")} />
        </div>

        <div className="mt-6 lg:grid lg:grid-cols-3 lg:items-start lg:gap-6">
          <div className="lg:col-span-2">
            {/* Required actions — next steps, rejected documents needing a re-upload, and any task
                a counsellor/agent has assigned — surfaced first, above the current application
                summary, since these are the things actually waiting on the student right now. */}
            <div className="flex items-center justify-between">
              <h2 className="text-[15px] font-bold text-neutral-900">Your Next Steps</h2>
              <button onClick={() => navigate("/student/tasks")} className="text-[13px] font-medium text-neutral-900">
                View All
              </button>
            </div>

            <div className="mt-3 overflow-hidden rounded-2xl border border-transparent bg-[var(--sd-card)] shadow-neu">
              {requiredRemaining > 0 && (
                <button
                  onClick={() => navigate((pendingSteps.find((s) => s.required) ?? pendingSteps[0]).path)}
                  className={`flex w-full items-center gap-3 px-3.5 py-3 text-left min-[400px]:px-4 min-[400px]:py-3.5 ${nextStepTasks.length > 0 ? "border-b border-neutral-50" : ""}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sd-card)] shadow-neu-sm text-red-600 min-[400px]:h-10 min-[400px]:w-10">
                    <AlertCircle size={16} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13px] font-semibold leading-snug text-red-700">Complete your profile</p>
                    <p className="text-[11px] leading-snug text-red-600/80">
                      {requiredRemaining} required step{requiredRemaining > 1 ? "s" : ""} left — needed to explore and apply to programs
                    </p>
                  </div>
                  <ChevronRight size={16} className="shrink-0 text-red-400" />
                </button>
              )}
              {nextStepTasks.length === 0 && requiredRemaining === 0 && pendingVerification === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-neutral-500">You're all caught up — no open tasks.</p>
              ) : (
                nextStepTasks.map((t, i) => {
                  const Icon = t.source === "document" ? FileText : t.source === "next-step" ? CheckCircle2 : t.source === "finance" ? Wallet : ShieldCheck;
                  // A next-step, document, or finance task is required by definition — it only
                  // exists while still outstanding (see taskBoard.ts) — so it's red regardless of
                  // due date, same as everywhere else in the app; a plain manually assigned task
                  // keeps the due-date-based tone since it isn't inherently "required" the same way.
                  const required = t.source === "document" || t.source === "next-step" || t.source === "finance";
                  const tone = required ? "rose" : t.tone === "overdue" ? "rose" : t.tone === "soon" ? "blue" : "slate";
                  // A bank has been added and the step is just waiting on the funds to mature — amber, not an action the student owes.
                  const waiting = t.source === "finance" && t.title.startsWith("Financial Readiness in progress");
                  const st = waiting ? STEP_TONE.amber : required || t.tone === "overdue" ? STEP_TONE.red : t.tone === "soon" ? STEP_TONE.amber : STEP_TONE.none;
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
                      className={`flex w-full items-center gap-3 px-3.5 py-3 text-left min-[400px]:px-4 ${i !== nextStepTasks.length - 1 ? "border-b border-neutral-50" : ""}`}
                    >
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full min-[400px]:h-10 min-[400px]:w-10 ${iconBg[tone]}`}>
                        <Icon size={16} className={st.icon} />
                      </div>
                      <div className="min-w-0 flex-1">
                        {/* One line: the title, then any extra detail (university, rejection reason, due date) in a lighter weight. */}
                        <p className={`line-clamp-2 text-[13px] leading-snug ${st.title}`}>
                          <span className="font-medium">{t.title}</span>
                          {t.subtitle && <span className={`text-[11px] ${st.sub}`}> · {t.subtitle}</span>}
                          {t.dueDate && (
                            <span className={`text-[11px] ${t.tone === "overdue" ? "font-medium text-red-700" : st.sub}`}>
                              {" — Due "}{new Date(`${t.dueDate}T00:00:00`).toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                            </span>
                          )}
                        </p>
                      </div>
                      <ChevronRight size={16} className={`shrink-0 ${st.chevron}`} />
                    </button>
                  );
                })
              )}
              {pendingVerification > 0 && (
                <button
                  onClick={() => navigate("/student/documents")}
                  className={`flex w-full items-center gap-3 px-3.5 py-3 text-left min-[400px]:px-4 ${nextStepTasks.length > 0 || requiredRemaining > 0 ? "border-t border-neutral-50" : ""}`}
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-[var(--sd-card)] shadow-neu-sm min-[400px]:h-10 min-[400px]:w-10">
                    <Clock3 size={16} className="text-amber-600" />
                  </div>
                  <p className="min-w-0 flex-1 text-[13px] leading-snug text-amber-700">
                    <span className="font-medium">Awaiting verification</span>
                    <span className="text-[11px] text-amber-700/80"> · {pendingVerification} document{pendingVerification > 1 ? "s" : ""}</span>
                  </p>
                  <ChevronRight size={16} className="shrink-0 text-amber-500" />
                </button>
              )}
            </div>

            {primaryApplication && (
              <div className="mt-6">
                <div className="overflow-hidden rounded-2xl border border-transparent bg-[var(--sd-card)] shadow-neu">
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
                              <p className="text-[11px] font-semibold uppercase tracking-wide text-neutral-400">Current Application</p>
                              <p className="mt-1 text-[11px] text-neutral-400">
                                {activeApplications.length > 1 ? `${index + 1} of ${activeApplications.length} running applications` : "1 running application"}
                              </p>
                            </div>
                            <button
                              onClick={() => navigate(`/student/applications/${app.id}`)}
                              className="flex shrink-0 items-center gap-1 rounded-full bg-neutral-50 px-3 py-1.5 text-[11px] font-medium text-neutral-900"
                            >
                              Details <ChevronRight size={13} />
                            </button>
                          </div>
                          <div className="mt-3 flex items-center gap-3">
                            <LogoBadge name={app.university} tone={university?.tone ?? "violet"} logoUrl={university?.logoUrl} className="h-11 w-11 shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-[14px] font-semibold text-neutral-900">{app.university}</p>
                              <p className="truncate text-xs text-neutral-400">{app.course}</p>
                              <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                                <span className="inline-flex items-center gap-1">
                                  <Calendar size={11} className="text-neutral-400" /> {app.intake}
                                </span>
                                <span className="inline-flex items-center gap-1">
                                  <MapPin size={11} className="text-neutral-400" /> {app.campus ?? "Main Campus"}
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
                              className="mt-3 flex w-full items-center gap-2 rounded-xl border border-transparent bg-[var(--sd-card)] shadow-neu-inset-sm px-3 py-2 text-left"
                            >
                              <AlertCircle size={14} className="shrink-0 text-neutral-700" />
                              <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-neutral-800">
                                Upload core documents before this application can move forward
                              </span>
                              <ChevronRight size={13} className="shrink-0 text-neutral-700" />
                            </button>
                          )}

                          <div className="mt-4 overflow-x-auto pb-1">
                            <div className="relative" style={{ width: APPLICATION_STAGES.length * STEP_WIDTH }}>
                              <div
                                className="absolute top-3 h-0.5 rounded-full bg-neutral-200"
                                style={{ left: STEP_WIDTH / 2, width: (APPLICATION_STAGES.length - 1) * STEP_WIDTH }}
                              />
                              <div
                                className="absolute top-3 h-0.5 rounded-full bg-neutral-900 transition-[width] duration-1000 ease-out"
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
                                            done ? "bg-neutral-900 text-white" : current ? "bg-[image:var(--sd-gradient)] text-white" : "bg-neutral-100"
                                          }`}
                                        >
                                          {done ? <Check size={12} /> : current ? <span className="h-1.5 w-1.5 rounded-full bg-white" /> : null}
                                        </div>
                                      </div>
                                      <p className={`mt-1.5 text-center text-[11px] leading-tight ${current ? "font-semibold text-[var(--sd-ink)]" : done ? "text-neutral-500" : "text-neutral-300"}`}>
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
                        className={`h-1.5 rounded-full transition-all ${index === safeApplicationIndex ? "w-5 bg-neutral-900" : "w-1.5 bg-neutral-200"}`}
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

            <h2 className="mt-8 text-[15px] font-bold text-neutral-900">Quick Actions</h2>
            {/* Six actions: a 3 × 2 grid on phones, one row from tablet width up. */}
            <div className="mt-4 grid grid-cols-3 gap-x-2 gap-y-4 pb-2 sm:grid-cols-6 sm:gap-x-3">
              {QUICK_ACTIONS.map((a) => (
                <button key={a.title} onClick={() => navigate(a.path)} className="group flex min-w-0 flex-col items-center gap-2">
                  <span className="neu-hover flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-2xl bg-[var(--sd-card)] text-neutral-900 shadow-neu sm:h-16 sm:w-16">
                    <a.icon size={24} strokeWidth={1.7} />
                  </span>
                  <span className="w-full text-center text-[11px] font-medium leading-tight tracking-tight text-neutral-600">
                    {a.title}
                  </span>
                </button>
              ))}
            </div>

            {recommended && recommendedCourse && (
              <>
                <div className="mt-6 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-neutral-900">Recommended</h2>
                  <button onClick={() => navigate("/student/search")} className="flex items-center gap-0.5 text-[13px] font-medium text-neutral-900">
                    See all <ChevronRight size={14} />
                  </button>
                </div>
                <button
                  onClick={() => navigate(`/student/universities/${recommended.id}`, { state: { selectedCourseName: recommendedCourse.name } })}
                  className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-transparent bg-[var(--sd-card)] p-3.5 text-left shadow-neu"
                >
                  <LogoBadge name={recommended.name} tone={recommended.tone} logoUrl={recommended.logoUrl} className="h-14 w-14 shrink-0 text-sm" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14px] font-semibold text-neutral-900">{recommendedCourse.name}</p>
                    <p className="truncate text-xs text-neutral-400">{recommended.name}</p>
                    <div className="mt-1.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] text-neutral-500">
                      <span className="inline-flex items-center gap-1">
                        <BarChart3 size={11} className="text-neutral-400" /> {recommended.worldRank}
                      </span>
                      <span className="inline-flex items-center gap-1">
                        <Calendar size={11} className="text-neutral-400" /> {recommended.openIntake}
                      </span>
                      {recommended.scholarshipsAvailable && (
                        <span className="inline-flex items-center gap-1 text-neutral-800">
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
                  <h2 className="text-[15px] font-semibold text-neutral-900">Top Destinations</h2>
                  <button onClick={() => navigate("/student/search")} className="flex items-center gap-0.5 text-[13px] font-medium text-neutral-900">
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
                      <CountryBadge name={d.name} className="absolute bottom-2 left-2 h-8 w-8 text-[17px]" />
                    </button>
                  ))}
                </div>
              </>
            )}

            {topDestinations.length > 0 && (
              <>
                <div className="mt-6 flex items-center justify-between">
                  <h2 className="text-[15px] font-semibold text-neutral-900">Study Guide</h2>
                  <button onClick={() => navigate("/student/search")} className="flex items-center gap-0.5 text-[13px] font-medium text-neutral-900">
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
                      className="mt-3 flex w-full items-center gap-3.5 rounded-2xl border border-transparent bg-[var(--sd-card)] p-4 text-left shadow-neu"
                    >
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${iconBg[tone]}`}>
                        <GuideIcon size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-[14px] font-semibold text-neutral-900">Studying in {d.name}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {d.universityCount} {d.universityCount === 1 ? "university" : "universities"}
                        </p>
                        <p className="mt-0.5 line-clamp-1 text-xs text-neutral-500">
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
                  <h2 className="text-[15px] font-semibold text-neutral-900">Recommended Subjects</h2>
                  <button onClick={() => navigate("/student/search")} className="flex items-center gap-0.5 text-[13px] font-medium text-neutral-900">
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
                      className="mt-3 flex w-full items-center gap-3.5 rounded-2xl border border-transparent bg-[var(--sd-card)] p-4 text-left shadow-neu"
                    >
                      <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full ${iconBg[tone]}`}>
                        <SubjectIcon size={24} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-semibold text-neutral-900">{s.name}</p>
                        <p className="mt-1 text-xs text-neutral-500">
                          {s.universityCount} {s.universityCount === 1 ? "university" : "universities"}
                        </p>
                        <p className="mt-0.5 text-xs text-neutral-500">offering this subject</p>
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
                className="mt-6 flex w-full items-center justify-between rounded-2xl border border-transparent bg-[var(--sd-card)] p-4 text-left shadow-neu"
              >
                <span className="text-[13px] text-neutral-600">
                  Profile {percent}% complete · finish up
                  {outstandingDocs > 0 ? ` · ${outstandingDocs} document${outstandingDocs > 1 ? "s" : ""} needed` : ""}
                </span>
                <ChevronRight size={14} className="shrink-0 text-neutral-300" />
              </button>
            )}
          </div>

          <div className="lg:col-span-1">
            {(myCounsellor || myAgent) && (
              <>
                <h2 className="mt-6 text-[15px] font-bold text-neutral-900 lg:mt-0">Your Support Team</h2>
                <div className="mt-3 overflow-hidden rounded-2xl bg-[var(--sd-card)] shadow-neu">
                  {myCounsellor && <SupportRow contact={myCounsellor} onChat={() => navigate("/student/messages")} />}
                  {myCounsellor && myAgent && <div className="border-t border-neutral-50" />}
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

function StatCard({ value, label, onClick }: { value: number; label: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-col items-center justify-start rounded-2xl border border-transparent bg-[var(--sd-card)] px-1.5 py-3 text-center shadow-neu sm:p-3.5">
      {/* Fixed two-line label slot on phones so the numbers line up across all four tiles. */}
      <p className="text-xl font-bold leading-none text-neutral-900">{value}</p>
      <span className="mt-1.5 flex min-h-[2.3em] items-start justify-center text-[11px] leading-tight text-neutral-500 sm:min-h-0">{label}</span>
    </button>
  );
}
