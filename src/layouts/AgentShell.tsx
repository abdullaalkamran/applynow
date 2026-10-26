import { Logo } from "../components/Logo";
import { unreadInboxCount } from "../data/inboxStore";
import { useState } from "react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  LayoutDashboard, Users, FileText, Landmark, Award, ShieldCheck, Wallet, MessageCircle,
  BarChart3, FolderOpen, Settings, Bell, Globe2, ArrowRight, X, ListChecks, LogOut, UserCircle, MoreHorizontal,
} from "lucide-react";
import { useRole } from "../context/RoleContext";
import { useAuth } from "../context/AuthContext";
import { AIAssistantWidget } from "../components/ui/AIAssistantWidget";
import { useCacheSync } from "../utils/syncCache";
import { useScrollToTopOnNavigate } from "../utils/useScrollToTopOnNavigate";
import { unreadMessageCount } from "../data/messagesStore";

interface NavEntry {
  label: string;
  path?: string;
  icon: typeof Users;
  badge?: number;
}

const APPLE_FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Helvetica Neue", system-ui, sans-serif';

export default function AgentShell() {
  const cacheTick = useCacheSync();
  const scrollRef = useScrollToTopOnNavigate<HTMLElement>();
  const navigate = useNavigate();
  const { currentUser } = useRole();
  const { logout } = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const unreadNotifications = unreadMessageCount();

  const navItems: NavEntry[] = [
    { label: "Dashboard", path: "/agent", icon: LayoutDashboard },
    { label: "Students", path: "/agent/students", icon: Users },
    { label: "Applications", path: "/agent/applications", icon: FileText },
    { label: "Universities", path: "/agent/universities", icon: Landmark },
    { label: "Offers", path: "/agent/offers", icon: Award },
    { label: "Visa & Compliance", path: "/agent/visa-compliance", icon: ShieldCheck },
    { label: "Finance", path: "/agent/commissions", icon: Wallet },
    { label: "Messages", path: "/agent/messages", icon: MessageCircle, badge: unreadNotifications },
    { label: "Reports", path: "/agent/statements", icon: BarChart3 },
    { label: "Tasks", path: "/agent/tasks", icon: ListChecks },
    { label: "Resources", icon: FolderOpen },
    { label: "Profile", path: "/agent/profile", icon: Settings },
  ];

  function handleLogout() {
    setMenuOpen(false);
    logout();
    navigate("/login", { replace: true });
  }

  // macOS-style source list: grouped, small section headings, a coloured rounded-square icon per item, and a blue
  // selection pill with white text.
  const ICON_TILE: Record<string, string> = {
    Dashboard: "from-sky-400 to-blue-500",
    Students: "from-indigo-400 to-violet-500",
    Applications: "from-orange-400 to-amber-500",
    Universities: "from-teal-400 to-emerald-500",
    Offers: "from-pink-400 to-rose-500",
    "Visa & Compliance": "from-slate-400 to-slate-600",
    Finance: "from-green-400 to-emerald-600",
    Messages: "from-lime-400 to-green-500",
    Reports: "from-purple-400 to-fuchsia-500",
    Tasks: "from-red-400 to-rose-500",
    Resources: "from-cyan-400 to-sky-500",
    Profile: "from-neutral-400 to-neutral-600",
  };
  const NAV_GROUPS: { heading: string; labels: string[] }[] = [
    { heading: "Overview", labels: ["Dashboard"] },
    { heading: "Work", labels: ["Students", "Applications", "Universities", "Offers", "Visa & Compliance"] },
    { heading: "Money & insight", labels: ["Finance", "Reports"] },
    { heading: "Stay in touch", labels: ["Messages", "Tasks"] },
    { heading: "Account", labels: ["Resources", "Profile"] },
  ];

  function renderNavList(onNavigate?: () => void) {
    return (
      <nav className="flex flex-1 flex-col gap-4 overflow-y-auto pr-0.5" style={{ fontFamily: APPLE_FONT }}>
        {NAV_GROUPS.map((group) => {
          const items = group.labels.map((l) => navItems.find((i) => i.label === l)).filter((i): i is NavEntry => !!i);
          return (
            <div key={group.heading}>
              <p className="px-2.5 pb-1 text-[11px] font-semibold tracking-wide text-neutral-400">{group.heading}</p>
              <div className="flex flex-col gap-0.5">
                {items.map((item) => {
                  const tile = (
                    <span className={`flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] bg-gradient-to-b text-white shadow-sm ${ICON_TILE[item.label] ?? "from-neutral-400 to-neutral-600"}`}>
                      <item.icon size={13} strokeWidth={2.2} />
                    </span>
                  );
                  return item.path ? (
                    <NavLink
                      key={item.label}
                      to={item.path}
                      end
                      onClick={onNavigate}
                      className={({ isActive }) =>
                        `flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium transition-colors ${
                          isActive ? "bg-[#0a84ff] text-white shadow-sm" : "text-neutral-800 hover:bg-black/[0.05]"
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {tile}
                          <span className="flex-1 truncate">{item.label}</span>
                          {!!item.badge && (
                            <span className={`flex h-[17px] min-w-[17px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${isActive ? "bg-white/90 text-[#0a84ff]" : "bg-neutral-300/70 text-neutral-700"}`}>
                              {item.badge}
                            </span>
                          )}
                        </>
                      )}
                    </NavLink>
                  ) : (
                    <div key={item.label} className="flex cursor-default items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[13px] font-medium text-neutral-400">
                      <span className="opacity-60">{tile}</span>
                      <span className="flex-1 truncate">{item.label}</span>
                      <span className="text-[9px] font-semibold uppercase tracking-wide text-neutral-400">Soon</span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </nav>
    );
  }

  // The same floating bottom bar the student app uses: the first four destinations plus a "More" key opening the full menu.
  const tabItems = navItems.filter((i) => !!i.path).slice(0, 4);

  const brand = (
    <div style={{ fontFamily: APPLE_FONT }}>
      <div className="flex items-center gap-1.5 px-2.5 pb-4 pt-0.5" aria-hidden="true">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>
      <div className="px-2.5">
        <Logo className="h-7" />
        <p className="mt-1 truncate text-[11px] leading-tight text-neutral-500">Agent Portal</p>
      </div>
    </div>
  );

  return (
    <div className="neu-theme neu-light flex h-dvh min-w-0 bg-[var(--sd-bg)]">
      <aside className="hidden h-dvh w-60 shrink-0 flex-col border-r border-black/[0.08] bg-[rgba(246,246,248,0.78)] px-3 py-4 backdrop-blur-xl backdrop-saturate-150 md:flex">
        {brand}
        <div className="mt-6 flex min-h-0 flex-1 flex-col">{renderNavList()}</div>

        <button
          onClick={() => navigate("/agent/universities")}
          style={{ fontFamily: APPLE_FONT }}
          className="mt-3 flex items-center gap-2.5 rounded-xl border border-black/[0.06] bg-white/70 px-3 py-2.5 text-left shadow-sm hover:bg-white"
        >
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gradient-to-b from-teal-400 to-emerald-500 text-white"><Globe2 size={16} /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[12.5px] font-semibold text-neutral-900">Find universities</span>
            <span className="block truncate text-[11px] text-neutral-500">Browse partner catalog</span>
          </span>
          <ArrowRight size={13} className="shrink-0 text-neutral-400" />
        </button>
      </aside>

      {mobileNavOpen && (
        <div className="fixed inset-0 z-40 flex md:hidden">
          <div onClick={() => setMobileNavOpen(false)} className="absolute inset-0 bg-black/40" />
          <aside className="relative flex w-72 max-w-[82vw] shrink-0 flex-col border-r border-black/[0.08] bg-[rgba(246,246,248,0.92)] px-3 py-4 backdrop-blur-xl">
            <div className="flex items-center justify-between gap-2.5">
              {brand}
              <button
                onClick={() => setMobileNavOpen(false)}
                aria-label="Close menu"
                className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-600 shadow-neu-sm"
              >
                <X size={16} />
              </button>
            </div>
            <div className="mt-6 flex min-h-0 flex-1 flex-col">{renderNavList(() => setMobileNavOpen(false))}</div>
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex items-center justify-end gap-3 px-4 py-3 sm:px-6">
          <button
            onClick={() => navigate("/agent/notifications")}
            aria-label="Notifications"
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-700 shadow-neu-sm"
          >
            <Bell size={17} />
            {unreadInboxCount() > 0 && (
              <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-neutral-900 px-1 text-[9px] font-semibold text-white">
                {unreadInboxCount()}
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
              <>
                <button aria-hidden tabIndex={-1} className="fixed inset-0 z-20 cursor-default" onClick={() => setMenuOpen(false)} />
                <div className="absolute right-0 z-30 mt-2 w-56 rounded-2xl bg-[var(--sd-card)] p-2 shadow-neu-lg">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-semibold text-neutral-900">{currentUser.name}</p>
                    <p className="text-[11px] text-neutral-500">Agent</p>
                  </div>
                  <button
                    onClick={() => { setMenuOpen(false); navigate("/agent/profile"); }}
                    className="flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-neutral-700 hover:shadow-neu-inset-sm"
                  >
                    <UserCircle size={14} /> My Profile
                  </button>
                  <button
                    onClick={handleLogout}
                    className="mt-1 flex w-full items-center gap-2 rounded-xl px-2 py-2 text-left text-sm text-neutral-700 hover:shadow-neu-inset-sm"
                  >
                    <LogOut size={14} /> Log out
                  </button>
                </div>
              </>
            )}
          </div>
        </header>

        <main ref={scrollRef} className="no-scrollbar flex-1 overflow-y-auto px-4 pb-6 sm:px-6">
          <Outlet key={cacheTick} />
          <div className="h-16 shrink-0 md:hidden" aria-hidden="true" />
        </main>

        <div className="shrink-0 px-3 pb-[max(12px,env(safe-area-inset-bottom))] pt-1 md:hidden">
          <nav aria-label="Main" className="flex items-end justify-between rounded-[30px] bg-[var(--sd-card)] px-2 py-2 shadow-neu-lg">
            {tabItems.map((item) => (
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

      <AIAssistantWidget raised />
    </div>
  );
}
