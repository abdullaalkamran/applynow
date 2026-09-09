import { createContext, useContext, useEffect, useState, type ReactNode } from "react";
import type { Role } from "../types";
import { ROLES } from "../data/mockData";

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
}

const RoleContext = createContext<RoleContextValue | undefined>(undefined);

export function RoleProvider({ children }: { children: ReactNode }) {
  const [role, setRole] = useState<Role>(() => {
    if (typeof window === "undefined") return "student";
    const saved = window.localStorage.getItem("demo-role") as Role | null;
    return saved && ROLES.some((r) => r.id === saved) ? saved : "student";
  });

  useEffect(() => {
    window.localStorage.setItem("demo-role", role);
  }, [role]);

  return <RoleContext.Provider value={{ role, setRole }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
