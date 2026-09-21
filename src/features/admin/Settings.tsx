import { useNavigate } from "react-router-dom";
import { Users, GitBranch, Percent, ScrollText, Sparkles, Bell, ChevronRight, type LucideIcon } from "lucide-react";

const SECTIONS: { label: string; description: string; path: string; icon: LucideIcon }[] = [
  { label: "Teams & Roles", description: "Staff directory, team leads, invitations and role-based access.", path: "/admin/teams", icon: Users },
  { label: "Workflow Templates", description: "Stage templates applications move through per destination.", path: "/admin/workflows", icon: GitBranch },
  { label: "Commission Rules", description: "Agent commission rates and payout milestones.", path: "/admin/commission-rules", icon: Percent },
  { label: "AI Settings", description: "Assistant provider, models and voice engine.", path: "/admin/ai-settings", icon: Sparkles },
  { label: "Notifications", description: "WhatsApp and email status-change messages.", path: "/admin/notifications", icon: Bell },
  { label: "Audit Logs", description: "Every change made on the platform, by whom and when.", path: "/admin/audit-logs", icon: ScrollText },
];

/** Hub for the platform-configuration pages that don't get their own sidebar entry in the admin
 * shell (see layouts/AdminShell.tsx's ten-item nav). */
export default function AdminSettings() {
  const navigate = useNavigate();
  return (
    <div>
      <div className="mb-5">
        <h1 className="text-[18px] font-bold tracking-tight text-slate-900">Settings</h1>
        <p className="mt-1 text-[12px] text-slate-500">Platform configuration — teams, workflows, commissions, AI and messaging.</p>
      </div>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {SECTIONS.map((s) => (
          <button
            key={s.path}
            onClick={() => navigate(s.path)}
            className="flex items-center gap-4 rounded-2xl border border-slate-200/80 bg-white p-4 text-left transition hover:border-slate-300 hover:shadow-sm"
          >
            <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[#eef7f2] text-[#0b5d3d]">
              <s.icon size={20} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[12px] font-semibold text-slate-900">{s.label}</span>
              <span className="mt-0.5 block text-[12px] leading-snug text-slate-500">{s.description}</span>
            </span>
            <ChevronRight size={16} className="shrink-0 text-slate-400" />
          </button>
        ))}
      </div>
    </div>
  );
}
