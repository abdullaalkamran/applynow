import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { GraduationCap, Bell } from "lucide-react";
import { useRole } from "../context/RoleContext";
import { ROLES } from "../data/mockData";
import { NAV, ROLE_HOME } from "./nav";
import { RoleBottomNav } from "./RoleBottomNav";
import { AIAssistantWidget } from "../components/ui/AIAssistantWidget";
import type { Role } from "../types";

export default function AppLayout() {
  const { role, setRole } = useRole();
  const navigate = useNavigate();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const meta = ROLES.find((r) => r.id === role)!;
  const nav = NAV[role];

  function handleSwitch(next: Role) {
    setRole(next);
    setSwitcherOpen(false);
    navigate(ROLE_HOME[next]);
  }

  return (
    <div className="flex h-dvh min-w-0 bg-[#f5f7fb]">
      {/* Sidebar (hidden on small screens) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--sd-ink)] text-white">
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
                `flex items-center gap-2.5 rounded-lg px-3 py-2 text-sm font-medium transition max-w-full truncate ${
                  isActive ? "bg-[var(--sd-ink)] text-white" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
              <item.icon size={17} className="shrink-0" />
              <span className="truncate block">{item.label}</span>
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-slate-100 p-3">
          <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Demo role switcher</p>
          <p className="px-2 text-[11px] text-slate-400">No auth backend — switch roles to preview each workspace.</p>
        </div>
      </aside>

      {/* Main */}
      <div className="flex flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="flex items-center gap-3">
            <button
              aria-label="Notifications"
              className="relative flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
            >
              <Bell size={16} />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />
            </button>

            <div className="relative">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-slate-100 text-xs font-semibold text-slate-700"
              >
                {meta.label.slice(0, 2).toUpperCase()}
              </button>

              {switcherOpen && (
                <div className="absolute right-0 z-20 mt-2 w-64 rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
                  {(["Student", "Agent", "Staff", "Admin"] as const).map((group) => (
                    <div key={group} className="mb-1">
                      <p className="px-2 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-400">{group}</p>
                      {ROLES.filter((r) => r.group === group).map((r) => (
                        <button
                          key={r.id}
                          onClick={() => handleSwitch(r.id)}
                          className={`flex w-full flex-col rounded-lg px-2 py-1.5 text-left text-sm hover:bg-slate-50 ${
                            r.id === role ? "bg-[var(--brand-50)] text-[var(--brand-700)]" : "text-slate-700"
                          }`}
                        >
                          <span className="font-medium">{r.label}</span>
                          <span className="text-[11px] text-slate-400">{r.description}</span>
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

        {nav.length > 1 && <RoleBottomNav items={nav} />}
      </div>

      <AIAssistantWidget raised={nav.length > 1} />
    </div>
  );
}
