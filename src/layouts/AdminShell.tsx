import { useEffect, useMemo, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  Home, FileText, Users, Landmark, User, ClipboardCheck, MessageSquare, BarChart3, Calendar, Settings,
  Search, Bell, ChevronDown, ArrowRight, MoreHorizontal, LogOut, X, Check,
} from "lucide-react";
import { useRole } from "../context/RoleContext";
import { useAuth } from "../context/AuthContext";
import { AdminRangeProvider, useAdminRange } from "../context/AdminRangeContext";
import { RoleBottomNav } from "./RoleBottomNav";
import { AIAssistantWidget } from "../components/ui/AIAssistantWidget";
import { useCacheSync } from "../utils/syncCache";
import { unreadMessageCount } from "../data/messagesStore";
import { getAdminTasks } from "../utils/taskBoard";
import { getAllStudents } from "../data/allStudentsStore";
import { getAllApplications } from "../data/applicationsStore";
import { getAllUniversities } from "../data/universityCatalogStore";
import { formatApplicationId } from "../utils/displayId";
import { DATE_RANGE_OPTIONS, formatDateRange, dashboardAppId, isAtRisk } from "../utils/adminDashboard";

// Dedicated UnifinderAi-branded shell for the admin role — a sibling of CounsellorShell/AgentShell
// rather than a variant of the shared AppLayout the other staff roles use, since its chrome
// (global search, reporting-period picker, help card, ten-item nav) is its own design.

const ADMIN_PERSON_ID = "admin";

interface NavEntry {
  label: string;
  path: string;
  icon: typeof Home;
  badge?: number;
  // Match sub-routes too (e.g. /admin/students/... stays on "Students"). Off for the Dashboard,
  // whose path is the /admin prefix of everything else.
  prefix?: boolean;
}

export default function AdminShell() {
  return (
    <AdminRangeProvider>
      <AdminShellInner />
    </AdminRangeProvider>
  );
}

function AdminShellInner() {
  const cacheTick = useCacheSync();
  const navigate = useNavigate();
  const { currentUser } = useRole();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const unreadMessages = unreadMessageCount();
  const openTasks = getAdminTasks(ADMIN_PERSON_ID).filter((t) => !t.done).length;
  const studentsById = new Map(getAllStudents().map((s) => [s.id, s]));
  const atRisk = getAllApplications().filter((a) => isAtRisk(a, studentsById.get(a.studentId))).length;

  const navItems: NavEntry[] = [
    { label: "Dashboard", path: "/admin", icon: Home },
    { label: "Applications", path: "/admin/applications", icon: FileText, prefix: true },
    { label: "Students", path: "/admin/students", icon: Users, prefix: true },
    { label: "Universities", path: "/staff/data/universities", icon: Landmark, prefix: true },
    { label: "Counselors", path: "/admin/teams", icon: User, prefix: true },
    { label: "Tasks", path: "/admin/tasks", icon: ClipboardCheck, badge: openTasks, prefix: true },
    { label: "Messages", path: "/messages", icon: MessageSquare, badge: unreadMessages, prefix: true },
    { label: "Reports", path: "/admin/audit-logs", icon: BarChart3, prefix: true },
    { label: "Calendar", path: "/admin/calendar", icon: Calendar, prefix: true },
    { label: "Settings", path: "/admin/settings", icon: Settings, prefix: true },
  ];

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  function renderNavList(onNavigate?: () => void) {
    return (
      <nav className="flex-1 space-y-1 px-3.5">
        {navItems.map((item) => (
          <NavLink
            key={item.label}
            to={item.path}
            end={!item.prefix}
            onClick={onNavigate}
            className={({ isActive }) =>
              `flex items-center gap-3 rounded-[10px] px-3.5 py-[11px] text-[12px] font-medium transition-colors ${
                isActive ? "bg-[#0b5d3d] text-white shadow-[0_4px_12px_rgba(11,93,61,0.25)]" : "text-slate-600 hover:bg-slate-50"
              }`
            }
          >
            {({ isActive }) => (
              <>
                <item.icon size={19} strokeWidth={isActive ? 2 : 1.7} className="shrink-0" />
                <span className="flex-1 truncate">{item.label}</span>
                {!!item.badge && (
                  <span className={`flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[11px] font-semibold ${isActive ? "bg-white text-[#0b5d3d]" : "bg-[#e11d48] text-white"}`}>
                    {item.badge}
                  </span>
                )}
              </>
            )}
          </NavLink>
        ))}
      </nav>
    );
  }

  const brand = (
    <div className="flex items-center gap-2.5 px-5 pb-6 pt-5">
      <Logo />
      <div>
        <p className="text-[15px] font-bold leading-tight tracking-tight text-slate-900">UnifinderAi</p>
        <p className="text-[10px] leading-tight text-slate-400">Global Education Platform</p>
      </div>
    </div>
  );

  return (
    <div className="flex h-dvh min-w-0 bg-[#f6f8fb]">
      <aside className="hidden w-[224px] shrink-0 flex-col border-r border-slate-200/80 bg-white md:flex">
        {brand}
        {renderNavList()}

        <div className="relative m-3.5 overflow-hidden rounded-2xl bg-gradient-to-b from-[#eef7f2] to-[#dff0e6] p-5">
          <p className="text-[13px] font-semibold text-slate-900">Today at a glance</p>
          <p className="mt-1.5 text-[11px] leading-snug text-slate-500">
            {atRisk === 0 && openTasks === 0
              ? "Nothing needs your attention right now."
              : `${atRisk} application${atRisk === 1 ? "" : "s"} at risk · ${openTasks} open task${openTasks === 1 ? "" : "s"}.`}
          </p>
          <button
            onClick={() => navigate("/admin")}
            className="mt-3.5 inline-flex items-center gap-1.5 rounded-lg bg-[#0b5d3d] px-3.5 py-2 text-[11.5px] font-semibold text-white"
          >
            View Insights <ArrowRight size={13} />
          </button>
          <Leaves className="pointer-events-none absolute -bottom-3 -right-2 h-24 w-28" />
        </div>

        <div className="relative flex items-center gap-2.5 border-t border-slate-100 px-5 py-4">
          <UserAvatar name={currentUser.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[12px] font-semibold text-slate-900">{currentUser.name}</p>
            <p className="text-[11px] text-slate-400">Admin</p>
          </div>
          <button onClick={() => setMenuOpen((v) => !v)} aria-label="Account menu" className="text-slate-400 hover:text-slate-600">
            <MoreHorizontal size={18} />
          </button>
          {menuOpen && (
            <div className="absolute bottom-14 right-3 z-30 w-48 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
              <button onClick={handleLogout} className="flex w-full items-center gap-2 rounded-lg px-2 py-1.5 text-left text-sm text-slate-600 hover:bg-slate-50">
                <LogOut size={14} /> Log out
              </button>
            </div>
          )}
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="relative flex w-72 max-w-[80vw] shrink-0 flex-col overflow-y-auto bg-white pb-4">
            <div className="flex items-start justify-between">
              {brand}
              <button onClick={() => setMobileNavOpen(false)} aria-label="Close menu" className="m-4 flex h-8 w-8 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <X size={16} />
              </button>
            </div>
            {renderNavList(() => setMobileNavOpen(false))}
            <button onClick={handleLogout} className="mx-3.5 mt-4 flex items-center gap-2 rounded-lg px-3.5 py-2 text-left text-sm text-slate-600 hover:bg-slate-50">
              <LogOut size={14} /> Log out
            </button>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-3 md:px-6">
          <GlobalSearch />
          <div className="ml-auto flex shrink-0 items-center gap-3 md:gap-5">
            <DateRangePicker />
            <button
              onClick={() => navigate("/messages")}
              aria-label="Notifications"
              className="relative flex h-10 w-10 items-center justify-center rounded-full text-slate-500 hover:bg-slate-50"
            >
              <Bell size={21} strokeWidth={1.7} />
              {unreadMessages > 0 && <span className="absolute right-2 top-2 h-2 w-2 rounded-full bg-[#e11d48] ring-2 ring-white" />}
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet key={cacheTick} />
        </main>

        <RoleBottomNav items={navItems} onMore={() => setMobileNavOpen(true)} />
      </div>

      <AIAssistantWidget raised />
    </div>
  );
}

/** Top-bar search across students, applications and universities — ⌘K / Ctrl+K focuses it. */
function GlobalSearch() {
  const navigate = useNavigate();
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [focused, setFocused] = useState(false);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const isMac = typeof navigator !== "undefined" && /Mac|iPhone|iPad/.test(navigator.platform);
  const q = query.trim().toLowerCase();

  const results = useMemo(() => {
    if (!q) return [];
    const students = getAllStudents();
    const byId = new Map(students.map((s) => [s.id, s]));
    const out: { key: string; kind: string; title: string; subtitle: string; path: string }[] = [];
    for (const s of students) {
      if (s.name.toLowerCase().includes(q) || s.email.toLowerCase().includes(q)) {
        out.push({ key: `s-${s.id}`, kind: "Student", title: s.name, subtitle: s.email, path: `/admin/students?q=${encodeURIComponent(s.name)}` });
      }
    }
    for (const a of getAllApplications()) {
      const id = dashboardAppId(formatApplicationId(a.id), a);
      const student = byId.get(a.studentId);
      if (id.toLowerCase().includes(q) || a.university.toLowerCase().includes(q) || a.course.toLowerCase().includes(q) || student?.name.toLowerCase().includes(q)) {
        out.push({ key: `a-${a.id}`, kind: "Application", title: `${student?.name ?? "Student"} · ${a.university}`, subtitle: `${id} · ${a.course}`, path: `/admin/applications?q=${encodeURIComponent(id)}` });
      }
    }
    for (const u of getAllUniversities()) {
      if (u.name.toLowerCase().includes(q)) {
        out.push({ key: `u-${u.id}`, kind: "University", title: u.name, subtitle: `${u.city}, ${u.country}`, path: `/staff/data/universities/${u.id}` });
      }
    }
    return out.slice(0, 8);
  }, [q]);

  const open = focused && q.length > 0;

  return (
    <div className="relative w-full max-w-[560px]">
      <div className="flex h-11 items-center gap-2.5 rounded-xl bg-[#f1f4f8] px-4">
        <Search size={17} className="shrink-0 text-slate-400" />
        <input
          ref={inputRef}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setFocused(true)}
          onBlur={() => window.setTimeout(() => setFocused(false), 150)}
          placeholder="Search by student name, application ID, or university..."
          className="w-full min-w-0 bg-transparent text-[12px] text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
        <span className="hidden shrink-0 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-medium text-slate-500 sm:inline">
          {isMac ? "⌘" : "Ctrl"} K
        </span>
      </div>
      {open && (
        <div className="absolute left-0 right-0 z-30 mt-1.5 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {results.length === 0 ? (
            <p className="px-4 py-3 text-[12px] text-slate-400">No matches for “{query.trim()}”.</p>
          ) : (
            results.map((r) => (
              <button
                key={r.key}
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => { navigate(r.path); setQuery(""); setFocused(false); }}
                className="flex w-full items-center gap-3 px-4 py-2 text-left hover:bg-slate-50"
              >
                <span className="w-20 shrink-0 text-[10.5px] font-semibold uppercase tracking-wide text-slate-400">{r.kind}</span>
                <span className="min-w-0">
                  <span className="block truncate text-[12px] font-medium text-slate-800">{r.title}</span>
                  <span className="block truncate text-[11px] text-slate-400">{r.subtitle}</span>
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

function DateRangePicker() {
  const { rangeKey, setRangeKey, range } = useAdminRange();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex h-11 items-center gap-2.5 rounded-xl border border-slate-200 bg-white px-3.5 text-[12px] font-medium text-slate-700 hover:bg-slate-50"
      >
        <Calendar size={17} strokeWidth={1.7} className="text-slate-500" />
        <span className="hidden sm:inline">{formatDateRange(range)}</span>
        <ChevronDown size={15} className="text-slate-500" />
      </button>
      {open && (
        <div className="absolute right-0 z-30 mt-1.5 w-48 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg">
          {DATE_RANGE_OPTIONS.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => { setRangeKey(o.key); setOpen(false); }}
              className={`flex w-full items-center justify-between px-3.5 py-2 text-left text-[12px] hover:bg-slate-50 ${o.key === rangeKey ? "font-semibold text-[#0b5d3d]" : "text-slate-700"}`}
            >
              {o.label}
              {o.key === rangeKey && <Check size={14} />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function UserAvatar({ name }: { name: string }) {
  const initials = name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase();
  return (
    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#2f8f5f] to-[#0b5d3d] text-[12px] font-semibold text-white ring-2 ring-white">
      {initials}
    </div>
  );
}

/** Two-tone leaf mark from the design. */
function Logo() {
  return (
    <svg viewBox="0 0 40 40" className="h-10 w-10 shrink-0" aria-hidden>
      <path d="M20 4C10 8 5 16 5 27c0 5 3 9 8 9 7 0 10-7 7-14 3 4 6 5 9 4 6-2 8-11 4-22C29 6 25 4 20 4z" fill="#4dbb6a" />
      <path d="M20 4c-3 8-2 16 2 22 3-4 6-5 9-4 3-6 2-12-1-18-3-1-6-1-10 0z" fill="#0b5d3d" />
    </svg>
  );
}

/** Decorative leaves in the corner of the help card. */
function Leaves({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 120 100" className={className} aria-hidden>
      <path d="M60 100c0-30 10-55 40-70-5 30-15 55-40 70z" fill="#4dbb6a" opacity="0.85" />
      <path d="M60 100c-10-25-30-45-60-55 25 5 45 20 60 55z" fill="#8fd3a3" opacity="0.9" />
      <path d="M80 100c5-20 20-35 40-40-8 18-20 32-40 40z" fill="#0b5d3d" opacity="0.8" />
    </svg>
  );
}
