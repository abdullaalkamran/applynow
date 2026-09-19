import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { GraduationCap, Bell, LogOut } from "lucide-react";
import { useRole } from "../context/RoleContext";
import { useAuth } from "../context/AuthContext";
import { ROLES } from "../data/mockData";
import { NAV } from "./nav";
import { RoleBottomNav } from "./RoleBottomNav";
import { AIAssistantWidget } from "../components/ui/AIAssistantWidget";
import { useCacheSync } from "../utils/syncCache";
import { unreadMessageCount } from "../data/messagesStore";

export default function AppLayout() {
  const cacheTick = useCacheSync();
  const { role, currentUser } = useRole();
  const { logout } = useAuth();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const meta = ROLES.find((r) => r.id === role)!;
  const nav = NAV[role];
  const unreadMessages = unreadMessageCount();

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-dvh min-w-0 bg-[#f5f7fb]">
      {/* Sidebar (hidden on small screens) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[image:var(--sd-gradient)] text-white">
            <GraduationCap size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-tight">StudyOne</p>
            <p className="text-[11px] text-slate-400 leading-tight">{meta.label} Portal</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive }) =>
                `relative flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors max-w-full truncate ${
                  isActive ? "bg-[var(--brand-50)] text-[var(--sd-ink)]" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              {({ isActive }) => (
                <>
                  {isActive && <span className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-full bg-[image:var(--sd-gradient)]" />}
                  <item.icon size={17} className="shrink-0" strokeWidth={isActive ? 2.2 : 1.8} />
                  <span className="truncate block">{item.label}</span>
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <div className="flex items-center justify-between px-2 py-1">
            <div className="min-w-0">
              <p className="truncate text-[12.5px] font-medium text-slate-700">{currentUser.name}</p>
              <p className="text-[11px] text-slate-400">{meta.label}</p>
            </div>
            <button onClick={handleLogout} aria-label="Log out" className="shrink-0 rounded-lg p-1.5 text-slate-400 hover:bg-slate-50 hover:text-slate-600">
              <LogOut size={15} />
            </button>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => navigate("/messages")}
              aria-label="Messages"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
            >
              <Bell size={16} />
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
                {currentUser.name.slice(0, 2).toUpperCase()}
              </button>

              {menuOpen && (
                <div className="absolute right-0 z-20 mt-2 w-56 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium text-slate-800">{currentUser.name}</p>
                    <p className="text-[11px] text-slate-400">{meta.label}</p>
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

        {nav.length > 1 && <RoleBottomNav items={nav} />}
      </div>

      <AIAssistantWidget raised={nav.length > 1} />
    </div>
  );
}
