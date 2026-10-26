// "Who is the agent / counsellor / admission officer?" — always resolved from the real staff
// directory (staffStore, fed by /api/staff), never from seeded demo people. Falls back to the
// session's own name only when the directory has not loaded yet, so a page never dereferences
// `undefined` for a real member.
import { loadStaff, type StaffMember } from "../data/staffStore";
import { loadStoredAuth } from "./authClient";
import type { SupportContact } from "../types";

const ROLE_LABEL: Record<string, string> = { agent: "Agent", counsellor: "Counsellor", admission: "Admission Officer" };

function toContact(member: StaffMember): SupportContact {
  return {
    id: member.id, name: member.name, role: ROLE_LABEL[member.role] ?? member.role,
    organization: member.organization ?? undefined, phone: "", email: member.email || undefined, avatarColor: member.avatarColor,
  };
}

/** The staff contact for `id` if that person exists in the real directory, else undefined. */
export function findStaffContact(id: string | undefined | null): SupportContact | undefined {
  if (!id) return undefined;
  const member = loadStaff().find((m) => m.id === id);
  return member ? toContact(member) : undefined;
}

/** Every active directory member with this role (used for assignment dropdowns). */
export function staffContactsByRole(role: "agent" | "counsellor" | "admission"): SupportContact[] {
  return loadStaff().filter((m) => m.role === role && m.status !== "Inactive").map(toContact);
}

/** The staff contact record for `id`, in the shape the agent/counsellor pages already render. */
export function staffContact(id: string, role: "agent" | "counsellor"): SupportContact {
  const found = findStaffContact(id);
  if (found) return found;
  const session = loadStoredAuth()?.user;
  return { id, name: session?.name ?? ROLE_LABEL[role], role: ROLE_LABEL[role], phone: "", avatarColor: "bg-slate-500" };
}
