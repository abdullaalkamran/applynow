import type { Role } from "../types";

export type StaffStatus = "Active" | "Invited" | "Inactive";

export interface StaffMember {
  id: string;
  name: string;
  email: string;
  role: Role;
  status: StaffStatus;
  avatarColor: string;
}

const KEY = "sd-admin-staff";
const AVATAR_COLORS = ["bg-sky-500", "bg-rose-500", "bg-emerald-500", "bg-violet-500", "bg-amber-500", "bg-indigo-500", "bg-teal-500"];

// Seeded from the platform's existing named staff contacts (Counsellors/Admission/Compliance
// used on the student side) plus the prior hardcoded admin list — unified into one directory so
// "team" membership and individual role assignment share a single source of truth.
const SEED: StaffMember[] = [
  { id: "c1", name: "Maria Fernandez", email: "maria.fernandez@edupath.com", role: "counsellor", status: "Active", avatarColor: "bg-sky-500" },
  { id: "c2", name: "David Osei", email: "david.osei@edupath.com", role: "counsellor", status: "Active", avatarColor: "bg-emerald-500" },
  { id: "u-couns-invited", name: "Sarah K.", email: "sarah.k@edupath.com", role: "counsellor", status: "Invited", avatarColor: "bg-amber-500" },
  { id: "ad1", name: "Aisha Rahman", email: "aisha.rahman@edupath.com", role: "admission", status: "Active", avatarColor: "bg-indigo-500" },
  { id: "co1", name: "R. Fernandez", email: "r.fernandez@edupath.com", role: "compliance", status: "Active", avatarColor: "bg-rose-500" },
  { id: "u-data1", name: "D. Osei", email: "d.osei@edupath.com", role: "data", status: "Active", avatarColor: "bg-sky-500" },
  { id: "u-fin1", name: "M. Islam", email: "m.islam@edupath.com", role: "finance", status: "Active", avatarColor: "bg-emerald-500" },
  { id: "u-admin1", name: "K. Patel", email: "k.patel@edupath.com", role: "admin", status: "Active", avatarColor: "bg-violet-500" },
];

function persist(list: StaffMember[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(KEY, JSON.stringify(list));
}

export function loadStaff(): StaffMember[] {
  if (typeof window === "undefined") return SEED;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (raw) return JSON.parse(raw) as StaffMember[];
  } catch {
    // fall through to reseed
  }
  persist(SEED);
  return SEED;
}

function colorFor(index: number): string {
  return AVATAR_COLORS[index % AVATAR_COLORS.length];
}

export function inviteStaff(name: string, email: string, role: Role): StaffMember {
  const list = loadStaff();
  const member: StaffMember = {
    id: `u-${Date.now().toString(36)}`,
    name,
    email,
    role,
    status: "Invited",
    avatarColor: colorFor(list.length),
  };
  const next = [...list, member];
  persist(next);
  return member;
}

export function updateStaffRole(id: string, role: Role) {
  const next = loadStaff().map((m) => (m.id === id ? { ...m, role } : m));
  persist(next);
}

export function setStaffStatus(id: string, status: StaffStatus) {
  const next = loadStaff().map((m) => (m.id === id ? { ...m, status } : m));
  persist(next);
}

export function removeStaff(id: string) {
  persist(loadStaff().filter((m) => m.id !== id));
}
