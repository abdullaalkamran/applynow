import { createContext, useContext, type ReactNode } from "react";
import { useAuth } from "./AuthContext";
import type { Role } from "../types";

export interface CurrentUser {
  id: string;
  name: string;
}

interface RoleContextValue {
  role: Role;
  currentUser: CurrentUser;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

/**
 * Role and "who am I" now come straight from the authenticated account (see AuthContext) instead
 * of a free-pick demo switcher — logging in as a given role fixes it for the session. Only ever
 * mount this behind a route guard that already confirmed a real user exists (see RequireAuth in
 * App.tsx); it has nothing sensible to render for a logged-out visitor.
 */
export function RoleProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) throw new Error("RoleProvider requires an authenticated user — mount it only behind RequireAuth.");

  const value: RoleContextValue = {
    role: user.role,
    currentUser: { id: user.roleUserId, name: user.name },
  };

  return <RoleContext.Provider value={value}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
