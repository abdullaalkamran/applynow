import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutGrid, Users, UserPlus, FileText, MessageCircle, Landmark, ShieldCheck, ListChecks, Mail, BarChart3, FolderOpen, Settings,
  Search, Bell, ChevronDown, Gem, Lightbulb, ArrowRight, X,
} from "lucide-react";
import { useRole } from "../context/RoleContext";
import { ROLES, COUNSELLORS } from "../data/mockData";
import { ROLE_HOME } from "./nav";
import { COUNSELLOR_ID } from "../utils/counsellorData";
import { loadAssignedStudents } from "../data/counsellorStudentsStore";
import { unreadStaffMessageCount } from "../data/counsellorMessagesStore";
import { loadDoneMeetingIds, loadMeetings } from "../data/counsellorMeetingsStore";
import { loadLeads, loadLeadFollowUpStatus } from "../data/leadsStore";
import type { Role } from "../types";

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
  const navigate = useNavigate();
  const { role, setRole } = useRole();
  const counsellor = COUNSELLORS.find((c) => c.id === COUNSELLOR_ID)!;
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [searchFocused, setSearchFocused] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  const unreadMessages = unreadStaffMessageCount();
  const doneIds = loadDoneMeetingIds();
  const openTasks = loadMeetings().filter((m) => !doneIds.has(m.id)).length;
  const newLeads = loadLeads().filter((s) => loadLeadFollowUpStatus(s.id) === "New").length;

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        searchRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  const navItems: NavEntry[] = [
    { label: "Dashboard", path: "/staff/counsellor", icon: LayoutGrid },
    { label: "Leads", path: "/staff/counsellor/leads", icon: UserPlus, badge: newLeads },
    { label: "My Students", path: "/staff/counsellor/students", icon: Users },
    { label: "Applications", path: "/staff/counsellor/applications", icon: FileText },
    { label: "Counseling", path: "/staff/counsellor/counseling", icon: MessageCircle },
    { label: "University Partners", path: "/staff/counsellor/partners", icon: Landmark },
    { label: "Visa & Compliance", path: "/staff/counsellor/visa-compliance", icon: ShieldCheck },
    { label: "Tasks", path: "/staff/counsellor/tasks", icon: ListChecks, badge: openTasks },
    { label: "Messages", path: "/staff/counsellor/messages", icon: Mail, badge: unreadMessages },
    { label: "Reports", path: "/staff/counsellor/reports", icon: BarChart3 },
    { label: "Resources", path: "/staff/counsellor/resources", icon: FolderOpen },
    { label: "Settings", path: "/staff/counsellor/settings", icon: Settings },
  ];

  const assigned = loadAssignedStudents();
  const results = query.trim()
    ? assigned.filter((s) => s.name.toLowerCase().includes(query.trim().toLowerCase()) || s.country.toLowerCase().includes(query.trim().toLowerCase()))
    : [];

  function goToStudent(id: string) {
    setQuery("");
    setSearchFocused(false);
    navigate(`/staff/counsellor/students/${id}`);
  }

  function handleSwitch(next: Role) {
    setRole(next);
    setSwitcherOpen(false);
    navigate(ROLE_HOME[next]);
  }

  return (
    <div className="flex min-h-screen min-w-0 bg-[#f5f7fb]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-[#0d1a33] md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-sky-400 to-blue-600 text-white">
            <Gem size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold leading-tight text-white">ApplyHub</p>
            <p className="text-[11px] leading-tight text-white/50">Guide. Apply. Grow.</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {navItems.map((item) =>
            item.path ? (
              <NavLink
                key={item.label}
                to={item.path}
                end
                className={({ isActive }) =>
                  `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition ${
                    isActive ? "bg-white text-[#0d1a33]" : "text-white/70 hover:bg-white/10 hover:text-white"
                  }`
                }
              >
                <item.icon size={16} />
                <span className="flex-1 truncate">{item.label}</span>
                {!!item.badge && (
                  <span className="flex h-4.5 min-w-[18px] items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold text-white">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            ) : (
              <div key={item.label} className="flex cursor-default items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium text-white/30">
                <item.icon size={16} />
                <span className="flex-1 truncate">{item.label}</span>
                <span className="rounded-full bg-white/5 px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-white/40">Soon</span>
              </div>
            )
          )}
        </nav>

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

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="relative flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-6 py-3.5">
          <div className="relative min-w-0 flex-1 max-w-xl">
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onFocus={() => setSearchFocused(true)}
                onBlur={() => window.setTimeout(() => setSearchFocused(false), 150)}
                placeholder="Search students, applications, or universities…"
                className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              <span className="hidden shrink-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
                ⌘K
              </span>
            </div>
            {searchFocused && query.trim() && (
              <div className="absolute left-0 right-0 top-full z-20 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white shadow-lg">
                {results.length === 0 ? (
                  <p className="px-4 py-3 text-sm text-slate-400">No students match "{query}".</p>
                ) : (
                  results.map((s) => (
                    <button
                      key={s.id}
                      onMouseDown={() => goToStudent(s.id)}
                      className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left hover:bg-slate-50"
                    >
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${s.avatarColor}`}>
                        {s.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-800">{s.name}</p>
                        <p className="truncate text-xs text-slate-400">{s.country}</p>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <button
              onClick={() => navigate("/staff/counsellor/messages")}
              aria-label="Messages"
              className="relative text-slate-400 hover:text-slate-600"
            >
              <Bell size={19} />
              {unreadMessages > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-rose-500 px-1 text-[9px] font-semibold text-white">
                  {unreadMessages}
                </span>
              )}
            </button>

            <div className="relative">
              <button onClick={() => setSwitcherOpen((v) => !v)} className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-ink)] text-xs font-semibold text-white">
                  {counsellor.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-[13px] font-semibold leading-tight text-slate-800">{counsellor.name}</p>
                  <p className="text-[11px] leading-tight text-slate-400">{counsellor.role}</p>
                </div>
                <ChevronDown size={14} className="text-slate-400" />
              </button>

              {switcherOpen && (
                <div className="absolute right-0 z-30 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <p className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">Demo role switcher</p>
                  {(["Student", "Agent", "Staff", "Admin"] as const).map((group) => (
                    <div key={group} className="mb-1">
                      {ROLES.filter((r) => r.group === group).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => handleSwitch(r.id)}
                          className={`flex w-full flex-col rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${
                            r.id === role ? "bg-[var(--brand-50)] text-[var(--brand-700)]" : "text-slate-700"
                          }`}
                        >
                          <span className="font-medium">{r.label}</span>
                        </button>
                      ))}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
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
    </div>
  );
}
