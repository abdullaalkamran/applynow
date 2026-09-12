import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Role } from "../types";
import {
  ROLES, STUDENTS, CURRENT_STUDENT_ID, AGENTS, CURRENT_AGENT_ID,
  COUNSELLORS, ADMISSION_OFFICERS, COMPLIANCE_OFFICERS,
} from "../data/mockData";
import { COUNSELLOR_ID } from "../utils/counsellorData";

export interface CurrentUser {
  id: string;
  name: string;
}

// "Who am I" for whichever role is active — mirrors the existing per-role identity constants
// (CURRENT_STUDENT_ID, CURRENT_AGENT_ID, COUNSELLOR_ID) rather than building real auth. Roles with
// no seeded person (admin, admission, compliance, data, finance) fall back to the pooled contact
// (if one exists) or just the role's own label, matching the `ADMIN_PERSON` convention already
// used in taskAssignment.ts.
function resolveCurrentUser(role: Role): CurrentUser {
  switch (role) {
    case "student": {
      const student = STUDENTS.find((s) => s.id === CURRENT_STUDENT_ID);
      return { id: CURRENT_STUDENT_ID, name: student?.name ?? "Student" };
    }
    case "agent": {
      const agent = AGENTS.find((a) => a.id === CURRENT_AGENT_ID);
      return { id: CURRENT_AGENT_ID, name: agent?.name ?? "Agent" };
    }
    case "counsellor": {
      const counsellor = COUNSELLORS.find((c) => c.id === COUNSELLOR_ID);
      return { id: COUNSELLOR_ID, name: counsellor?.name ?? "Counsellor" };
    }
    case "admission": {
      const officer = ADMISSION_OFFICERS[0];
      return { id: officer?.id ?? "admission", name: officer?.name ?? "Admission Officer" };
    }
    case "compliance": {
      const officer = COMPLIANCE_OFFICERS[0];
      return { id: officer?.id ?? "compliance", name: officer?.name ?? "Compliance Officer" };
    }
    default: {
      const meta = ROLES.find((r) => r.id === role);
      return { id: role, name: meta?.label ?? role };
    }
  }
}

interface RoleContextValue {
  role: Role;
  setRole: (r: Role) => void;
  currentUser: CurrentUser;
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

  const currentUser = useMemo(() => resolveCurrentUser(role), [role]);

  return <RoleContext.Provider value={{ role, setRole, currentUser }}>{children}</RoleContext.Provider>;
}

export function useRole() {
  const ctx = useContext(RoleContext);
  if (!ctx) throw new Error("useRole must be used within RoleProvider");
  return ctx;
}
