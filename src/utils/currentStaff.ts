// "Who is the agent / counsellor using this browser?" — resolved from the real staff directory
// (staffStore, fed by /api/staff) with the seeded demo contacts as a fallback, and finally the
// session's own name, so a page never dereferences `undefined` for a real member who isn't in
// the mock lists. Replaces the `AGENTS.find(...)!` / `COUNSELLORS.find(...)!` pattern, which only
// ever worked because the identity was hard-coded to the demo accounts.
import { AGENTS, COUNSELLORS } from "../data/mockData";
import { loadStaff } from "../data/staffStore";
import { loadStoredAuth } from "./authClient";
import type { SupportContact } from "../types";

const ROLE_LABEL: Record<string, string> = { agent: "Agent", counsellor: "Counsellor" };

/** The staff contact record for `id`, in the shape the agent/counsellor pages already render. */
export function staffContact(id: string, role: "agent" | "counsellor"): SupportContact {
  const member = loadStaff().find((m) => m.id === id);
  if (member) {
    return { id: member.id, name: member.name, role: ROLE_LABEL[role], organization: member.organization ?? undefined, phone: "", avatarColor: member.avatarColor };
  }
  const seeded = (role === "agent" ? AGENTS : COUNSELLORS).find((c) => c.id === id);
  if (seeded) return seeded;
  const session = loadStoredAuth()?.user;
  return { id, name: session?.name ?? ROLE_LABEL[role], role: ROLE_LABEL[role], phone: "", avatarColor: "bg-slate-500" };
}
