import { useEffect, useRef, useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, Landmark, Award, ShieldCheck, Wallet, MessageCircle,
  BarChart3, FolderOpen, Settings, Search, Bell, ChevronDown, Compass, Globe2, ArrowRight, Menu, X,
} from "lucide-react";
import { useRole } from "../context/RoleContext";
import { ROLES, AGENTS, CURRENT_AGENT_ID } from "../data/mockData";
import { ROLE_HOME } from "./nav";
import type { Role } from "../types";

interface NavEntry {
  label: string;
  path?: string;
  icon: typeof Users;
  badge?: number;
}

export default function AgentShell() {
  const navigate = useNavigate();
  const { role, setRole } = useRole();
  const agent = AGENTS.find((a) => a.id === CURRENT_AGENT_ID)!;
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [query, setQuery] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);

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
    { label: "Dashboard", path: "/agent", icon: LayoutDashboard },
    { label: "Students", path: "/agent/students", icon: Users },
    { label: "Applications", path: "/agent/applications", icon: FileText },
    { label: "Universities", path: "/agent/universities", icon: Landmark },
    { label: "Offers", path: "/agent/offers", icon: Award },
    { label: "Visa & Compliance", path: "/agent/visa-compliance", icon: ShieldCheck },
    { label: "Finance", path: "/agent/commissions", icon: Wallet },
    { label: "Communication", icon: MessageCircle },
    { label: "Reports", path: "/agent/statements", icon: BarChart3 },
    { label: "Resources", icon: FolderOpen },
    { label: "Settings", icon: Settings },
  ];

  function handleSwitch(next: Role) {
    setRole(next);
    setSwitcherOpen(false);
    navigate(ROLE_HOME[next]);
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
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13.5px] font-medium transition ${
                  isActive ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
    <div className="flex min-h-screen min-w-0 bg-[#f5f7fb]">
      <aside className="hidden w-64 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
            <Compass size={18} />
          </div>
          <div>
            <p className="text-[13px] font-bold leading-tight text-slate-900">EduBridge</p>
            <p className="text-[11px] leading-tight text-slate-400">Agent Portal</p>
          </div>
        </div>

        {renderNavList()}

        <div className="relative m-3 overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 p-4">
          <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-blue-500/20 blur-xl" />
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white">
            <Globe2 size={16} />
          </div>
          <p className="mt-3 text-[14px] font-semibold leading-snug text-white">Global Education Made Possible</p>
          <p className="mt-1 text-[11.5px] leading-snug text-white/60">Access 800+ universities worldwide with EduBridge.</p>
          <button
            onClick={() => navigate("/agent/universities")}
            className="mt-3 flex w-full items-center justify-center gap-1.5 rounded-lg bg-white/95 px-3 py-2 text-[12.5px] font-semibold text-slate-900"
          >
            Find Partner Universities <ArrowRight size={13} />
          </button>
        </div>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="relative flex w-72 max-w-[80vw] shrink-0 flex-col overflow-y-auto bg-white pb-4">
            <div className="flex items-center justify-between gap-2.5 px-5 py-5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white">
                  <Compass size={18} />
                </div>
                <div>
                  <p className="text-[13px] font-bold leading-tight text-slate-900">EduBridge</p>
                  <p className="text-[11px] leading-tight text-slate-400">Agent Portal</p>
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
        <header className="flex items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
          <button
            onClick={() => setMobileNavOpen(true)}
            aria-label="Open menu"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 md:hidden"
          >
            <Menu size={19} />
          </button>

          <div className="min-w-0 flex-1 max-w-xl">
            <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-2">
              <Search size={15} className="shrink-0 text-slate-400" />
              <input
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search students, applications, universities…"
                className="w-full bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              <span className="hidden shrink-0 rounded border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-medium text-slate-400 sm:block">
                ⌘K
              </span>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-4">
            <button aria-label="Notifications" className="relative text-slate-400 hover:text-slate-600">
              <Bell size={19} />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />
            </button>

            <div className="relative">
              <button onClick={() => setSwitcherOpen((v) => !v)} className="flex items-center gap-2.5">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
                  {agent.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                </div>
                <div className="hidden text-left sm:block">
                  <p className="text-[13px] font-semibold leading-tight text-slate-800">{agent.name}</p>
                  <p className="text-[11px] leading-tight text-slate-400">{agent.role}</p>
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
                          className={`flex w-full flex-col rounded-lg px-2 py-1.5 text-left text-xs hover:bg-slate-50 ${
                            r.id === role ? "bg-blue-50 text-blue-700" : "text-slate-700"
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
    </div>
  );
}
