import { Logo } from "../components/Logo";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutGrid, Users, UserPlus, FileText, MessageCircle, Landmark, ShieldCheck, ListChecks, Mail, BarChart3, FolderOpen, Settings,
  Lightbulb, ArrowRight, X, LogOut, Sparkles, Globe2, Bell, MoreHorizontal,
} from "lucide-react";
import { useRole } from "../context/RoleContext";
import { useAuth } from "../context/AuthContext";
import { loadDoneMeetingIds, loadMeetings } from "../data/counsellorMeetingsStore";
import { loadLeads, loadLeadFollowUpStatus } from "../data/leadsStore";
import { loadAssignedStudents } from "../data/counsellorStudentsStore";
import { activeApplicationsFor } from "../utils/counsellorData";
import { isSeenByCounsellor } from "../data/counsellorSeenApplicationsStore";
import { AIAssistantWidget } from "../components/ui/AIAssistantWidget";
import { useCacheSync } from "../utils/syncCache";
import { useScrollToTopOnNavigate } from "../utils/useScrollToTopOnNavigate";
import { unreadMessageCount } from "../data/messagesStore";
import { unreadInboxCount } from "../data/inboxStore";

interface NavEntry {
  label: string;
  path?: string;
  icon: typeof Users;
  badge?: number;
}

const GUIDE_TIPS = [
  "Open with a genuine check-in before diving into application status — students remember how they felt in a session more than what was said.",
  "Flag document blockers the moment you see them; a same-day nudge prevents a week-long stall.",
  "When a student is on the risk watchlist, lead with reassurance and a concrete next step, not just the flag itself.",
  "Celebrate offers out loud — a quick congratulatory message meaningfully improves conversion to deposit.",
];

export default function CounsellorShell() {
  const cacheTick = useCacheSync();
  const scrollRef = useScrollToTopOnNavigate<HTMLElement>();
  const navigate = useNavigate();
  const { currentUser } = useRole();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Messages now reads the real direct-messaging system (see messagesStore.ts) instead of fake
  // seed data — comments posted elsewhere also fan out into this count (see applications.js).
  const unreadMessages = unreadMessageCount();
  const unreadAlerts = unreadInboxCount();
  const doneIds = loadDoneMeetingIds();
  const openTasks = loadMeetings().filter((m) => !doneIds.has(m.id)).length;
  const newLeads = loadLeads().filter((s) => loadLeadFollowUpStatus(s.id) === "New").length;
  // Mirrors CounsellorApplications.tsx's isNewSubmission() — a student-submitted application the
  // counsellor hasn't opened yet. Kept in sync via cacheTick (applications) and the same
  // localStorage seen-list markSeenByCounsellor() writes to when they open one.
  const newApplications = loadAssignedStudents()
    .flatMap((s) => activeApplicationsFor(s.id))
    .filter((a) => a.source === "student" && !isSeenByCounsellor(a.id)).length;

  const navItems: NavEntry[] = [
    { label: "Dashboard", path: "/staff/counsellor", icon: LayoutGrid },
    { label: "AI Agent", path: "/staff/counsellor/assistant", icon: Sparkles },
    { label: "Leads", path: "/staff/counsellor/leads", icon: UserPlus, badge: newLeads },
    { label: "External Portals", path: "/staff/counsellor/portals", icon: Globe2 },
    { label: "My Students", path: "/staff/counsellor/students", icon: Users },
    { label: "Applications", path: "/staff/counsellor/applications", icon: FileText, badge: newApplications },
    { label: "Counseling", path: "/staff/counsellor/counseling", icon: MessageCircle },
    { label: "University Partners", path: "/staff/counsellor/partners", icon: Landmark },
    { label: "Visa & Compliance", path: "/staff/counsellor/visa-compliance", icon: ShieldCheck },
    { label: "Tasks", path: "/staff/counsellor/tasks", icon: ListChecks, badge: openTasks },
    { label: "Messages", path: "/staff/counsellor/messages", icon: Mail, badge: unreadMessages },
    { label: "Reports", path: "/staff/counsellor/reports", icon: BarChart3 },
    { label: "Resources", path: "/staff/counsellor/resources", icon: FolderOpen },
    { label: "Settings", path: "/staff/counsellor/settings", icon: Settings },
  ];

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  function renderNavList(onNavigate?: () => void) {
    return (
      <nav className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto px-1 py-1">
        {navItems.map((item) =>
          item.path ? (
            <NavLink
              key={item.label}
              to={item.path}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-2xl px-4 py-2.5 text-[13.5px] font-semibold transition-all duration-200 ${
                  isActive ? "bg-neutral-900 text-white shadow-neu-dark" : "text-neutral-600 hover:text-neutral-900 hover:shadow-neu-inset-sm"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  <item.icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {!!item.badge && (
                    <span className={`flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${isActive ? "bg-white text-neutral-900" : "bg-neutral-900 text-white"}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ) : (
            <div key={item.label} className="flex cursor-default items-center gap-3 rounded-2xl px-4 py-2.5 text-[13.5px] font-semibold text-neutral-300">
              <item.icon size={17} />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="rounded-full bg-[var(--sd-card)] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-neutral-400 shadow-neu-inset-sm">Soon</span>
            </div>
          )
        )}
      </nav>
    );
  }

  return (
    <div className="neu-theme flex h-dvh min-w-0 bg-[var(--sd-bg)]">
      <aside className="hidden h-dvh w-64 shrink-0 flex-col bg-[var(--sd-card)] px-4 py-6 shadow-[10px_0_22px_var(--neu-dark)] md:flex">
        <div className="px-2 pb-5">
          <Logo className="h-8" />
          <p className="mt-1 text-[11px] leading-tight text-neutral-500">Counsellor Portal</p>
        </div>

        {renderNavList()}

        <div className="mt-3 rounded-2xl bg-neutral-900 p-4 shadow-neu-dark">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
            <Lightbulb size={16} />
          </div>
          <p className="mt-3 text-[14px] font-semibold leading-snug text-white">Students Dream Global. You Make It Happen.</p>
          <button
            onClick={() => setGuideOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-[12.5px] font-semibold text-neutral-900"
          >
            See Counselor Guide <ArrowRight size={13} />
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="relative flex w-72 max-w-[82vw] shrink-0 flex-col bg-[var(--sd-card)] px-4 py-6 shadow-neu-lg">
            <div className="flex items-center justify-between gap-2.5 px-2 pb-5">
              <div>
                <Logo className="h-8" />
                <p className="mt-1 text-[11px] leading-tight text-neutral-500">Counsellor Portal</p>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-600 shadow-neu-sm"
              >
                <X size={16} />
              </button>
            </div>

            {renderNavList(() => setMobileNavOpen(false))}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end gap-4 px-4 py-3 sm:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => navigate("/staff/counsellor/notifications")}
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-700 shadow-neu-sm"
            >
              <Bell size={16} />
              {unreadAlerts > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-neutral-900 px-1 text-[9px] font-semibold text-white">
                  {unreadAlerts}
                </span>
              )}
            </button>
            <button
              onClick={() => navigate("/staff/counsellor/messages")}
              aria-label="Messages"
              className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-700 shadow-neu-sm"
            >
              <Mail size={16} />
              {unreadMessages > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-neutral-900 px-1 text-[9px] font-semibold text-white">
                  {unreadMessages}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-neutral-900 text-xs font-semibold text-white shadow-neu-dark"
              >
                {currentUser.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-2xl bg-[var(--sd-card)] p-2 shadow-neu-lg">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-slate-800">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-400">Counsellor</p>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50"
                  >
                    <LogOut size={14} /> Log out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
          <Outlet key={cacheTick} />
          <div className="h-16 shrink-0 md:hidden" aria-hidden="true" />
        </main>

        <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 md:hidden">
          <nav aria-label="Main" className="flex items-end justify-between rounded-[30px] bg-[var(--sd-card)] px-2 py-2 shadow-neu-lg">
            {navItems.filter((i) => !!i.path).slice(0, 4).map((item) => (
              <NavLink key={item.label} to={item.path!} end className="flex flex-1 flex-col items-center gap-1 py-0.5">
                {({ isActive }) => (
                  <>
                    <span className={`relative flex h-12 w-12 items-center justify-center rounded-2xl transition-all duration-200 ${isActive ? "bg-neutral-900 text-white shadow-neu-dark" : "text-neutral-500"}`}>
                      <item.icon size={21} strokeWidth={isActive ? 2.2 : 1.8} />
                      {!!item.badge && (
                        <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-neutral-900 px-1 text-[9px] font-semibold text-white ring-2 ring-[var(--sd-card)]">
                          {item.badge}
                        </span>
                      )}
                    </span>
                    <span className={`text-[10px] font-semibold ${isActive ? "text-neutral-900" : "text-neutral-500"}`}>{item.label}</span>
                  </>
                )}
              </NavLink>
            ))}
            <button onClick={() => setMobileNavOpen(true)} className="flex flex-1 flex-col items-center gap-1 py-0.5">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl text-neutral-500"><MoreHorizontal size={21} /></span>
              <span className="text-[10px] font-semibold text-neutral-500">More</span>
            </button>
          </nav>
        </div>
      </div>

      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setGuideOpen(false)} className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-md rounded-2xl bg-[var(--sd-card)] shadow-neu-lg">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-800">Counselor Guide</h3>
              <button onClick={() => setGuideOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <ul className="space-y-3 px-5 py-4">
              {GUIDE_TIPS.map((tip) => (
                <li key={tip} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-neutral-900" />
                  {tip}
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <AIAssistantWidget raised />
    </div>
  );
}
