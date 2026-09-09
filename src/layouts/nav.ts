import type { Role } from "../types";

export interface NavItem {
  label: string;
  path: string;
}

export const NAV: Record<Role, NavItem[]> = {
  student: [
    { label: "Dashboard", path: "/student" },
    { label: "Applications", path: "/student/applications" },
    { label: "Documents", path: "/student/documents" },
    { label: "University Search", path: "/student/search" },
    { label: "Messages", path: "/student/messages" },
    { label: "Profile", path: "/student/profile" },
  ],
  agent: [
    { label: "Dashboard", path: "/agent" },
    { label: "Students", path: "/agent/students" },
    { label: "Applications", path: "/agent/applications" },
    { label: "Commissions", path: "/agent/commissions" },
    { label: "Statements", path: "/agent/statements" },
  ],
  counsellor: [
    { label: "Case Queue", path: "/staff/counsellor" },
  ],
  admission: [
    { label: "Submission Queue", path: "/staff/admission" },
  ],
  compliance: [
    { label: "Risk & Fraud Queue", path: "/staff/compliance" },
  ],
  data: [
    { label: "Catalog", path: "/staff/data" },
  ],
  finance: [
    { label: "Commission Approvals", path: "/staff/finance" },
  ],
  admin: [
    { label: "Users & Roles", path: "/admin" },
    { label: "Workflow Templates", path: "/admin/workflows" },
    { label: "Commission Rules", path: "/admin/commission-rules" },
    { label: "Audit Logs", path: "/admin/audit-logs" },
  ],
};

export const ROLE_HOME: Record<Role, string> = {
  student: "/student",
  agent: "/agent",
  counsellor: "/staff/counsellor",
  admission: "/staff/admission",
  compliance: "/staff/compliance",
  data: "/staff/data",
  finance: "/staff/finance",
  admin: "/admin",
};
