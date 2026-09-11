import { Fragment, useState } from "react";
import {
  ChevronDown, ChevronUp, Headset, FileCheck2, ShieldAlert, Database, Wallet, Settings, Users, Trash2, Send,
} from "lucide-react";
import { Badge, PageHeader, Button, Avatar, Modal } from "../../components/ui";
import { ROLES } from "../../data/mockData";
import {
  loadStaff, inviteStaff, updateStaffRole, setStaffStatus, removeStaff, type StaffMember, type StaffStatus,
} from "../../data/staffStore";
import { getTeamLeadOverride, setTeamLead } from "../../data/teamsStore";
import type { Role } from "../../types";

const TEAM_ROLES: Role[] = ["counsellor", "admission", "compliance", "data", "finance", "admin"];

const TEAM_ICON: Record<string, typeof Headset> = {
  counsellor: Headset,
  admission: FileCheck2,
  compliance: ShieldAlert,
  data: Database,
  finance: Wallet,
  admin: Settings,
};

const STATUS_TONE: Record<StaffStatus, "green" | "amber" | "neutral"> = {
  Active: "green",
  Invited: "amber",
  Inactive: "neutral",
};

const ASSIGNABLE_ROLES = ROLES.filter((r) => r.group === "Staff" || r.group === "Admin");

export default function AdminUsersRoles() {
  const [staff, setStaff] = useState<StaffMember[]>(() => loadStaff());
  const [tab, setTab] = useState<"teams" | "members">("teams");
  const [expandedTeam, setExpandedTeam] = useState<Role | null>(null);
  const [managingId, setManagingId] = useState<string | null>(null);
  const [inviteRole, setInviteRole] = useState<Role | null>(null);
  const [, forceTick] = useState(0);

  function refresh() {
    setStaff(loadStaff());
  }

  function handleInvite(name: string, email: string, role: Role) {
    inviteStaff(name, email, role);
    refresh();
    setInviteRole(null);
  }

  function handleRoleChange(id: string, role: Role) {
    updateStaffRole(id, role);
    refresh();
  }

  function handleStatus(id: string, status: StaffStatus) {
    setStaffStatus(id, status);
    refresh();
  }

  function handleRemove(id: string) {
    removeStaff(id);
    setManagingId(null);
    refresh();
  }

  function handleSetLead(roleId: Role, memberId: string) {
    setTeamLead(roleId, memberId);
    forceTick((t) => t + 1);
  }

  return (
    <div>
      <PageHeader
        title="Teams & Roles"
        subtitle="Platform staff grouped into teams by role, plus individual RBAC. Changes are audited."
        action={<Button onClick={() => setInviteRole(ASSIGNABLE_ROLES[0].id)}>+ Invite user</Button>}
      />

      <div className="mb-4 flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-sm font-medium w-fit">
        {(["teams", "members"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`rounded-md px-3.5 py-1.5 transition ${tab === t ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            {t === "teams" ? "Teams" : "All Members"}
          </button>
        ))}
      </div>

      {tab === "teams" ? (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2 xl:grid-cols-3">
          {TEAM_ROLES.map((roleId) => {
            const roleMeta = ROLES.find((r) => r.id === roleId)!;
            const members = staff.filter((m) => m.role === roleId);
            const activeMembers = members.filter((m) => m.status !== "Inactive");
            const leadId = getTeamLeadOverride(roleId) ?? activeMembers[0]?.id;
            const lead = members.find((m) => m.id === leadId);
            const Icon = TEAM_ICON[roleId] ?? Users;
            const expanded = expandedTeam === roleId;

            return (
              <div key={roleId} className="rounded-xl border border-slate-200 bg-white shadow-sm">
                <div className="flex items-start justify-between px-5 py-4">
                  <div className="flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-[var(--brand-50)] text-[var(--brand-600)]">
                      <Icon size={18} />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{roleId === "admin" ? "Leadership" : `${roleMeta.label} Team`}</p>
                      <p className="text-xs text-slate-400">{members.length} member{members.length === 1 ? "" : "s"}</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setExpandedTeam(expanded ? null : roleId)}
                    aria-label={expanded ? "Collapse team" : "Expand team"}
                    className="text-slate-400 hover:text-slate-600"
                  >
                    {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </button>
                </div>

                <div className="border-t border-slate-100 px-5 py-3">
                  {lead ? (
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={lead.name} colorClass={lead.avatarColor} />
                        <div>
                          <p className="text-sm font-medium text-slate-800">{lead.name}</p>
                          <Badge tone="blue">Team Lead</Badge>
                        </div>
                      </div>
                      {members.length > 1 && (
                        <select
                          value={lead.id}
                          onChange={(e) => handleSetLead(roleId, e.target.value)}
                          className="rounded-lg border border-slate-200 px-2 py-1 text-xs text-slate-600"
                          aria-label={`Change ${roleMeta.label} team lead`}
                        >
                          {members.map((m) => (
                            <option key={m.id} value={m.id}>{m.name}</option>
                          ))}
                        </select>
                      )}
                    </div>
                  ) : (
                    <p className="text-xs text-slate-400">No members yet.</p>
                  )}
                </div>

                {expanded && (
                  <div className="divide-y divide-slate-50 border-t border-slate-100">
                    {members.map((m) => (
                      <div key={m.id} className="flex items-center justify-between gap-2 px-5 py-2.5">
                        <div className="flex min-w-0 items-center gap-2.5">
                          <Avatar name={m.name} colorClass={m.avatarColor} />
                          <div className="min-w-0">
                            <p className="truncate text-sm text-slate-700">{m.name}</p>
                            <p className="truncate text-xs text-slate-400">{m.email}</p>
                          </div>
                        </div>
                        <Badge tone={STATUS_TONE[m.status]}>{m.status}</Badge>
                      </div>
                    ))}
                    {members.length === 0 && <p className="px-5 py-3 text-xs text-slate-400">No members yet.</p>}
                  </div>
                )}

                <div className="border-t border-slate-100 px-5 py-3">
                  <button onClick={() => setInviteRole(roleId)} className="text-sm font-medium text-[var(--brand-600)]">
                    + Add to team
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="rounded-xl border border-slate-200 bg-white">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">User</th>
                <th className="px-5 py-3 font-medium">Role</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {staff.map((u) => {
                const roleMeta = ROLES.find((r) => r.id === u.role)!;
                const managing = managingId === u.id;
                return (
                  <Fragment key={u.id}>
                    <tr className="hover:bg-slate-50">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} colorClass={u.avatarColor} />
                          <div>
                            <p className="font-medium text-slate-800">{u.name}</p>
                            <p className="text-xs text-slate-400">{u.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3"><Badge tone="blue">{roleMeta.label}</Badge></td>
                      <td className="px-5 py-3"><Badge tone={STATUS_TONE[u.status]}>{u.status}</Badge></td>
                      <td className="px-5 py-3">
                        <button
                          onClick={() => setManagingId(managing ? null : u.id)}
                          className="text-sm font-medium text-[var(--brand-600)]"
                        >
                          {managing ? "Close" : "Manage"}
                        </button>
                      </td>
                    </tr>
                    {managing && (
                      <tr className="bg-slate-50">
                        <td colSpan={4} className="px-5 py-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <label className="flex items-center gap-2 text-xs text-slate-500">
                              Role
                              <select
                                value={u.role}
                                onChange={(e) => handleRoleChange(u.id, e.target.value as Role)}
                                className="rounded-lg border border-slate-200 px-2 py-1.5 text-sm text-slate-700"
                              >
                                {ASSIGNABLE_ROLES.map((r) => (
                                  <option key={r.id} value={r.id}>{r.label}</option>
                                ))}
                              </select>
                            </label>

                            {u.status === "Invited" && (
                              <Button variant="secondary" onClick={() => handleStatus(u.id, "Active")}>
                                <Send size={13} /> Mark active
                              </Button>
                            )}
                            {u.status === "Active" && (
                              <Button variant="secondary" onClick={() => handleStatus(u.id, "Inactive")}>Deactivate</Button>
                            )}
                            {u.status === "Inactive" && (
                              <Button variant="secondary" onClick={() => handleStatus(u.id, "Active")}>Reactivate</Button>
                            )}

                            <Button variant="danger" onClick={() => handleRemove(u.id)}>
                              <Trash2 size={13} /> Remove
                            </Button>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {inviteRole && (
        <InviteModal
          defaultRole={inviteRole}
          onClose={() => setInviteRole(null)}
          onInvite={handleInvite}
        />
      )}
    </div>
  );
}

function InviteModal({
  defaultRole,
  onClose,
  onInvite,
}: {
  defaultRole: Role;
  onClose: () => void;
  onInvite: (name: string, email: string, role: Role) => void;
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<Role>(defaultRole);
  const canSubmit = name.trim().length > 1 && /\S+@\S+\.\S+/.test(email);

  return (
    <Modal title="Invite team member" onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-xs font-medium text-slate-500">
          Full name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Jordan Lee"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[var(--brand-600)] focus:outline-none"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Work email
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="jordan.lee@edupath.com"
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800 focus:border-[var(--brand-600)] focus:outline-none"
          />
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Team / role
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as Role)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          >
            {ASSIGNABLE_ROLES.map((r) => (
              <option key={r.id} value={r.id}>{r.label}</option>
            ))}
          </select>
        </label>

        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={() => onInvite(name.trim(), email.trim(), role)}
        >
          Send invite
        </Button>
      </div>
    </Modal>
  );
}
