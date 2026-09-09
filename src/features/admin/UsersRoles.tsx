import { Table, Badge, PageHeader, Button, Avatar } from "../../components/ui";
import { ROLES } from "../../data/mockData";

const USERS = [
  { name: "D. Osei", email: "d.osei@edupath.com", role: "data", status: "Active", color: "bg-sky-500" },
  { name: "R. Fernandez", email: "r.fernandez@edupath.com", role: "compliance", status: "Active", color: "bg-rose-500" },
  { name: "M. Islam", email: "m.islam@edupath.com", role: "finance", status: "Active", color: "bg-emerald-500" },
  { name: "K. Patel", email: "k.patel@edupath.com", role: "admin", status: "Active", color: "bg-violet-500" },
  { name: "Sarah K.", email: "sarah.k@edupath.com", role: "counsellor", status: "Invited", color: "bg-amber-500" },
];

export default function AdminUsersRoles() {
  return (
    <div>
      <PageHeader title="Users, Roles & Permissions" subtitle="RBAC plus record-level authorization. Changes are audited." action={<Button>+ Invite user</Button>} />
      <div className="rounded-xl border border-slate-200 bg-white">
        <Table head={["User", "Role", "Status", ""]}>
          {USERS.map((u) => {
            const roleMeta = ROLES.find((r) => r.id === u.role)!;
            return (
              <tr key={u.email} className="hover:bg-slate-50">
                <td className="px-5 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar name={u.name} colorClass={u.color} />
                    <div>
                      <p className="font-medium text-slate-800">{u.name}</p>
                      <p className="text-xs text-slate-400">{u.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3"><Badge tone="blue">{roleMeta.label}</Badge></td>
                <td className="px-5 py-3"><Badge tone={u.status === "Active" ? "green" : "amber"}>{u.status}</Badge></td>
                <td className="px-5 py-3"><button className="text-sm font-medium text-[var(--brand-600)]">Manage</button></td>
              </tr>
            );
          })}
        </Table>
      </div>
    </div>
  );
}
