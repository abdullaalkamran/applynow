import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useState } from "react";
import { GraduationCap, ChevronDown, Bell, Search, Menu, X } from "lucide-react";
import { useRole } from "../context/RoleContext";
import { ROLES } from "../data/mockData";
import { NAV, ROLE_HOME } from "./nav";
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

  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [mobileNavVisible, setMobileNavVisible] = useState(false);

  return (
    <div className="flex min-h-screen min-w-0 bg-[#f5f7fb]">
      {/* Sidebar (hidden on small screens) */}
      <aside className="hidden md:flex w-64 shrink-0 flex-col border-r border-slate-200 bg-white">
        <div className="flex items-center gap-2 px-5 py-5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-600)] text-white">
            <GraduationCap size={18} />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 leading-tight">EduPath</p>
            <p className="text-[11px] text-slate-400 leading-tight">AI Powered. Human Guided.</p>
          </div>
        </div>

        <nav className="flex-1 space-y-0.5 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              end
              className={({ isActive }) =>
                `block rounded-lg px-3 py-2 text-sm font-medium transition max-w-full truncate ${
                  isActive ? "bg-[var(--brand-50)] text-[var(--brand-700)]" : "text-slate-600 hover:bg-slate-50"
                }`
              }
            >
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
        <header className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-3 md:px-6">
          <div className="md:hidden">
            <button
              onClick={() => {
                setMobileNavVisible(true);
                // next tick to allow mount before transition
                requestAnimationFrame(() => setMobileNavOpen(true));
              }}
              className="inline-flex items-center justify-center rounded-md p-2 text-slate-600 hover:bg-slate-100"
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
          </div>
          <div className="flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-400">
            <Search size={15} />
            <span>Search students, applications, universities…</span>
          </div>

          <div className="flex items-center gap-4">
            <button className="relative text-slate-400 hover:text-slate-600">
              <Bell size={19} />
              <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-rose-500" />
            </button>

            <div className="relative">
              <button
                onClick={() => setSwitcherOpen((v) => !v)}
                className="flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm hover:bg-slate-50"
              >
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-100)] text-[10px] font-semibold text-[var(--brand-700)]">
                  {meta.label.slice(0, 2).toUpperCase()}
                </span>
                <span className="font-medium text-slate-700">{meta.label}</span>
                <ChevronDown size={14} className="text-slate-400" />
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

        {/* Mobile nav overlay */}
        {mobileNavVisible && (
          <div className="fixed inset-0 z-50 flex md:hidden">
            <div
              className={`fixed inset-0 bg-black/40 transition-opacity duration-200 ${mobileNavOpen ? 'opacity-100' : 'opacity-0'}`}
              onClick={() => {
                setMobileNavOpen(false);
                setTimeout(() => setMobileNavVisible(false), 200);
              }}
            />
            <aside
              className={`relative w-64 max-w-[80vw] shrink-0 flex-col border-r border-slate-200 bg-white transform transition-transform duration-200 ${
                mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
              }`}
            >
              <div className="flex items-center justify-between gap-2 px-5 py-5">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-600)] text-white">
                    <GraduationCap size={18} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900 leading-tight">EduPath</p>
                    <p className="text-[11px] text-slate-400 leading-tight">AI Powered. Human Guided.</p>
                  </div>
                </div>
                <button
                  onClick={() => {
                    setMobileNavOpen(false);
                    setTimeout(() => setMobileNavVisible(false), 200);
                  }}
                  className="p-2"
                >
                  <X size={18} />
                </button>
              </div>

              <nav className="flex-1 space-y-0.5 px-3">
                {nav.map((item) => (
                  <NavLink
                    key={item.path}
                    to={item.path}
                    end
                    onClick={() => {
                      setMobileNavOpen(false);
                      setTimeout(() => setMobileNavVisible(false), 200);
                    }}
                    className={({ isActive }) =>
                      `block rounded-lg px-2 py-2 text-sm font-medium transition max-w-full truncate ${
                        isActive ? "bg-[var(--brand-50)] text-[var(--brand-700)]" : "text-slate-600 hover:bg-slate-50"
                      }`
                    }
                  >
                    <span className="truncate block">{item.label}</span>
                  </NavLink>
                ))}
              </nav>

              <div className="border-t border-slate-100 p-3">
                <p className="px-2 pb-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">Demo role switcher</p>
                <p className="px-2 text-[11px] text-slate-400">No auth backend — switch roles to preview each workspace.</p>
              </div>
            </aside>
          </div>
        )}

        <main className="flex-1 overflow-y-auto p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
