import {
  LayoutDashboard, FileText, Folder, Compass, MessageCircle, User, Users, Wallet, BarChart3,
  ClipboardList, ShieldAlert, Globe2, Landmark, BookOpen, Percent, ScrollText, GitBranch, ListChecks,
  Sparkles, Bell, type LucideIcon,
} from "lucide-react";
import type { Role } from "../types";

export interface NavItem {
  label: string;
  path: string;
  icon: LucideIcon;
}

export const NAV: Record<Role, NavItem[]> = {
  student: [
    { label: "Dashboard", path: "/student", icon: LayoutDashboard },
    { label: "Applications", path: "/student/applications", icon: FileText },
    { label: "Documents", path: "/student/documents", icon: Folder },
    { label: "University Search", path: "/student/search", icon: Compass },
    { label: "Messages", path: "/student/messages", icon: MessageCircle },
    { label: "Profile", path: "/student/profile", icon: User },
  ],
  agent: [
    { label: "Dashboard", path: "/agent", icon: LayoutDashboard },
    { label: "Students", path: "/agent/students", icon: Users },
    { label: "Applications", path: "/agent/applications", icon: FileText },
    { label: "Commissions", path: "/agent/commissions", icon: Wallet },
    { label: "Statements", path: "/agent/statements", icon: BarChart3 },
  ],
  counsellor: [
    { label: "Case Queue", path: "/staff/counsellor", icon: ClipboardList },
  ],
  admission: [
    { label: "Submission Queue", path: "/staff/admission", icon: FileText },
    { label: "Messages", path: "/messages", icon: MessageCircle },
  ],
  compliance: [
    { label: "Risk & Fraud Queue", path: "/staff/compliance", icon: ShieldAlert },
    { label: "Messages", path: "/messages", icon: MessageCircle },
  ],
  data: [
    { label: "Countries", path: "/staff/data", icon: Globe2 },
    { label: "Universities", path: "/staff/data/universities", icon: Landmark },
    { label: "Subjects", path: "/staff/data/subjects", icon: BookOpen },
    { label: "Content Catalog", path: "/staff/data/catalog", icon: BookOpen },
    { label: "Messages", path: "/messages", icon: MessageCircle },
  ],
  finance: [
    { label: "Commission Approvals", path: "/staff/finance", icon: Percent },
    { label: "Messages", path: "/messages", icon: MessageCircle },
  ],
  admin: [
    { label: "Teams & Roles", path: "/admin", icon: Users },
    { label: "Workflow Templates", path: "/admin/workflows", icon: GitBranch },
    { label: "Commission Rules", path: "/admin/commission-rules", icon: Percent },
    { label: "Audit Logs", path: "/admin/audit-logs", icon: ScrollText },
    { label: "Tasks", path: "/admin/tasks", icon: ListChecks },
    { label: "Messages", path: "/messages", icon: MessageCircle },
    { label: "AI Settings", path: "/admin/ai-settings", icon: Sparkles },
    { label: "Notifications", path: "/admin/notifications", icon: Bell },
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
