import { Outlet, useLocation } from "react-router-dom";
import { BottomNav, Sidebar } from "../components/ui/mobile";
import { AIAssistantWidget } from "../components/ui/AIAssistantWidget";

const TAB_ROOTS = new Set([
  "/student",
  "/student/search",
  "/student/applications",
  "/student/messages",
  "/student/profile",
]);

// Pages that render their own sticky bottom action bar (Save, Apply, View Program, etc.) —
// the voice FAB needs to sit above it there too, not just above the bottom tab bar.
const STICKY_BAR_EXACT = new Set([
  "/student/search/filters",
  "/student/profile/personal-information",
  "/student/profile/academic-details",
  "/student/profile/english-proficiency",
  "/student/profile/work-experience",
  "/student/profile/preferences",
]);
const STICKY_BAR_PREFIXES = ["/student/applications/", "/student/universities/"];

function hasStickyActionBar(pathname: string): boolean {
  return STICKY_BAR_EXACT.has(pathname) || STICKY_BAR_PREFIXES.some((p) => pathname.startsWith(p));
}

export default function StudentShell() {
  const location = useLocation();
  const showTabs = TAB_ROOTS.has(location.pathname) || location.pathname.startsWith("/student/subjects/");
  const raiseFab = showTabs || hasStickyActionBar(location.pathname);

  return (
    <div className="flex h-dvh w-full bg-[var(--sd-bg)]">
      <div className="hidden lg:block">
        <Sidebar />
      </div>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <div className="no-scrollbar flex-1 overflow-y-auto">
          <Outlet />
        </div>
        {showTabs && (
          <div className="lg:hidden">
            <BottomNav />
          </div>
        )}
      </div>

      {location.pathname !== "/student/counsellor" && <AIAssistantWidget raised={raiseFab} />}
    </div>
  );
}
