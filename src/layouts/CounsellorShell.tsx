import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutGrid, Users, UserPlus, FileText, MessageCircle, Landmark, ShieldCheck, ListChecks, Mail, BarChart3, FolderOpen, Settings,
  Gem, Lightbulb, ArrowRight, X, LogOut,
} from "lucide-react";
import { useRole } from "../context/RoleContext";
import { useAuth } from "../context/AuthContext";
import { RoleBottomNav } from "./RoleBottomNav";
import { loadDoneMeetingIds, loadMeetings } from "../data/counsellorMeetingsStore";
import { loadLeads, loadLeadFollowUpStatus } from "../data/leadsStore";
import { loadAssignedStudents } from "../data/counsellorStudentsStore";
import { activeApplicationsFor } from "../utils/counsellorData";
import { isSeenByCounsellor } from "../data/counsellorSeenApplicationsStore";
import { AIAssistantWidget } from "../components/ui/AIAssistantWidget";
import { useCacheSync } from "../utils/syncCache";
import { unreadMessageCount } from "../data/messagesStore";

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
  const navigate = useNavigate();
  const { currentUser } = useRole();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  // Messages now reads the real direct-messaging system (see messagesStore.ts) instead of fake
  // seed data — comments posted elsewhere also fan out into this count (see applications.js).
  const unreadMessages = unreadMessageCount();
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
    { label: "Leads", path: "/staff/counsellor/leads", icon: UserPlus, badge: newLeads },
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
      <nav className="flex-1 space-y-0.5 px-3">
        {navItems.map((item) =>
          item.path ? (
            <NavLink
              key={item.label}
              to={item.path}
              end
              onClick={onNavigate}
              className={({ isActive }) =>
                `relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition-colors ${
                  isActive ? "bg-[var(--brand-50)] text-[var(--sd-ink)]" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[image:var(--sd-gradient)]" />}
                  <item.icon size={16} strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="flex-1 truncate">{item.label}</span>
                  {!!item.badge && (
                    <span className={`flex h-4.5 min-w-[18px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${isActive ? "bg-white text-[var(--sd-ink)]" : "bg-rose-500 text-white"}`}>
                      {item.badge}
                    </span>
                  )}
                </>
              )}
            </NavLink>
          ) : (
            <div key={item.label} className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-slate-300">
              <item.icon size={16} />
              <span className="flex-1 truncate">{item.label}</span>
              <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-400">Soon</span>
            </div>
          )
        )}
      </nav>
    );
  }

  return (
    <div className="flex h-dvh min-w-0 bg-[#f5f7fb]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[image:var(--sd-gradient)] text-white">
            <Gem size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-slate-900">StudyOne</p>
            <p className="text-[11px] leading-tight text-slate-400">Counsellor Portal</p>
          </div>
        </div>

        {renderNavList()}

        <div className="m-3 rounded-2xl bg-gradient-to-br from-violet-600 to-indigo-700 p-4">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 text-white">
            <Lightbulb size={16} />
          </div>
          <p className="mt-3 text-[14px] font-semibold leading-snug text-white">Students Dream Global. You Make It Happen.</p>
          <button
            onClick={() => setGuideOpen(true)}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-[12.5px] font-semibold text-[#3730a3]"
          >
            See Counselor Guide <ArrowRight size={13} />
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="relative flex w-72 max-w-[80vw] shrink-0 flex-col overflow-y-auto bg-white pb-4">
            <div className="flex items-center justify-between gap-2.5 px-5 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[image:var(--sd-gradient)] text-white">
                  <Gem size={18} />
                </div>
                <div>
                  <p className="text-sm font-semibold leading-tight text-slate-900">StudyOne</p>
                  <p className="text-[11px] leading-tight text-slate-400">Counsellor Portal</p>
                </div>
              </div>
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100"
              >
                <X size={16} />
              </button>
            </div>

            {renderNavList(() => setMobileNavOpen(false))}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <button
              onClick={() => navigate("/staff/counsellor/messages")}
              aria-label="Messages"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
            >
              <Mail size={16} />
              {unreadMessages > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
                  {unreadMessages}
                </span>
              )}
            </button>

            <div className="relative">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
              >
                {currentUser.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
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

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet key={cacheTick} />
        </main>

        <RoleBottomNav items={navItems} onMore={() => setMobileNavOpen(true)} />
      </div>

      {guideOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div onClick={() => setGuideOpen(false)} className="absolute inset-0 bg-black/30" />
          <div className="relative w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <h3 className="text-sm font-semibold text-slate-800">Counselor Guide</h3>
              <button onClick={() => setGuideOpen(false)} aria-label="Close" className="text-slate-400 hover:text-slate-600">
                <X size={16} />
              </button>
            </div>
            <ul className="space-y-3 px-5 py-4">
              {GUIDE_TIPS.map((tip) => (
                <li key={tip} className="flex gap-2.5 text-[13px] leading-relaxed text-slate-600">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-violet-500" />
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
