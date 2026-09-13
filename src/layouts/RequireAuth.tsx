import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { RoleProvider } from "../context/RoleContext";
import { AssistantProvider } from "../context/AssistantContext";
import { ROLE_HOME } from "./nav";
import type { Role } from "../types";

/**
 * Gates a group of routes behind a real logged-in session, and — since RoleProvider/AssistantProvider
 * both require an authenticated user to derive role/identity from — mounts them here rather than
 * higher up the tree, so they never render for a logged-out visitor.
 *
 * `roles`, when given, restricts this route group to those roles specifically (e.g. the shared
 * staff/admin shell); anyone logged in as a different role gets bounced to their own home instead
 * of seeing a workspace that isn't theirs.
 */
export function RequireAuth({ roles }: { roles?: Role[] }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return <div className="flex min-h-dvh items-center justify-center bg-[var(--sd-bg)] text-sm text-slate-400">Loading…</div>;
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to={ROLE_HOME[user.role]} replace />;
  }

  return (
    <RoleProvider>
      <AssistantProvider>
        <Outlet />
      </AssistantProvider>
    </RoleProvider>
  );
}
