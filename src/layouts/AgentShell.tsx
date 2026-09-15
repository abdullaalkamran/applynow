import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, Landmark, Award, ShieldCheck, Wallet, MessageCircle,
  BarChart3, FolderOpen, Settings, Bell, Compass, Globe2, ArrowRight, X, ListChecks, LogOut,
} from "lucide-react";
import { useRole } from "../context/RoleContext";
import { useAuth } from "../context/AuthContext";
import { RoleBottomNav } from "./RoleBottomNav";
import { AIAssistantWidget } from "../components/ui/AIAssistantWidget";
import { useCacheSync } from "../utils/syncCache";

interface NavEntry {
  label: string;
  path?: string;
  icon: typeof Users;
  badge?: number;
}

export default function AgentShell() {
  const cacheTick = useCacheSync();
  const navigate = useNavigate();
  const { currentUser } = useRole();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

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
    { label: "Tasks", path: "/agent/tasks", icon: ListChecks },
    { label: "Resources", icon: FolderOpen },
    { label: "Settings", icon: Settings },
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
                  isActive ? "bg-[var(--brand-50)] text-[var(--sd-ink)]" : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
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
            <Compass size={18} />
          </div>
          <div>
            <p className="text-[13px] font-bold leading-tight text-slate-900">StudyOne</p>
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
          <p className="mt-1 text-[11.5px] leading-snug text-white/60">Access 800+ universities worldwide with StudyOne.</p>
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
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[image:var(--sd-gradient)] text-white">
                  <Compass size={18} />
                </div>
                <div>
                  <p className="text-[13px] font-bold leading-tight text-slate-900">StudyOne</p>
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
        <header className="flex items-center justify-end gap-4 border-b border-slate-200 bg-white px-4 py-3.5 sm:px-6">
          <div className="flex shrink-0 items-center gap-3">
            <button
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
            >
              <Bell size={16} />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />
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
                    <p className="text-[11px] text-slate-400">Agent</p>
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

      <AIAssistantWidget raised />
    </div>
  );
}
