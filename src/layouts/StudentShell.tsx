import { Outlet, useLocation, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useRole } from "../context/RoleContext";
import { ROLES } from "../data/mockData";
import { ROLE_HOME } from "./nav";
import { BottomNav } from "../components/ui/mobile";

const TAB_ROOTS = new Set([
  "/student",
  "/student/search",
  "/student/applications",
  "/student/messages",
  "/student/profile",
]);

export default function StudentShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const { setRole } = useRole();
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const showTabs = TAB_ROOTS.has(location.pathname);

  return (
    <div className="h-dvh w-full bg-[#e7e5df] sm:flex sm:h-screen sm:items-center sm:justify-center sm:py-8">
      <div className="relative mx-auto flex h-dvh w-full flex-col overflow-hidden bg-[var(--sd-bg)] sm:h-[900px] sm:w-[430px] sm:rounded-[2.75rem] sm:border sm:border-black/10 sm:shadow-2xl">
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <Outlet />
        </div>
        {showTabs && <BottomNav />}
      </div>

      {/* Demo-only: preview the other role workspaces (this app has no auth backend yet). Only
          shown once the desktop preview frame has room around it, so it never sits over the
          pixel-perfect mobile screens themselves. */}
      <div className="fixed right-6 top-6 z-30 hidden sm:block">
        <button
          onClick={() => setSwitcherOpen((v) => !v)}
          className="rounded-full bg-white px-3 py-1.5 text-xs font-medium text-slate-600 shadow-md"
        >
          Demo ▾
        </button>
        {switcherOpen && (
          <div className="absolute right-0 z-40 mt-1 w-52 rounded-xl border border-slate-200 bg-white p-1.5 shadow-lg">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">Preview other roles</p>
            {ROLES.filter((r) => r.id !== "student").map((r) => (
              <button
                key={r.id}
                onClick={() => {
                  setRole(r.id);
                  setSwitcherOpen(false);
                  navigate(ROLE_HOME[r.id]);
                }}
                className="flex w-full flex-col rounded-lg px-2 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
              >
                <span className="font-medium">{r.label}</span>
                <span className="text-[10px] text-slate-400">{r.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
