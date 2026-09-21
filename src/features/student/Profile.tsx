import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Settings, User, GraduationCap, Languages, Briefcase, SlidersHorizontal, Shield, ChevronRight, CheckCircle2, LogOut, Link2,
} from "lucide-react";
import { MobileHeader } from "../../components/ui/mobile";
import { getProfileCompletion } from "../../data/profileCompletion";
import { useAuth } from "../../context/AuthContext";
import { apiGet, apiPost } from "../../utils/apiClient";
import type { Student } from "../../types";

const SETTINGS = [
  { icon: User, label: "Personal Information", path: "/student/profile/personal-information", stepKey: "personal-information" },
  { icon: GraduationCap, label: "Academic Details", path: "/student/profile/academic-details", stepKey: "academic-details" },
  { icon: Languages, label: "English Proficiency", path: "/student/profile/english-proficiency", stepKey: "english-proficiency" },
  { icon: Briefcase, label: "Work Experience", path: "/student/profile/work-experience", stepKey: "work-experience" },
  { icon: SlidersHorizontal, label: "Preferences", path: "/student/profile/preferences", stepKey: "preferences" },
  { icon: Shield, label: "Security", path: "/student/profile/security", stepKey: undefined },
];

export default function Profile() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { percent, steps } = getProfileCompletion();
  const completeByKey = new Map(steps.map((s) => [s.key, s.complete]));

  const [student, setStudent] = useState<Student | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [connecting, setConnecting] = useState(false);
  const [connectError, setConnectError] = useState("");

  useEffect(() => {
    if (!user) return;
    apiGet<Student>(`/api/students/${user.roleUserId}`).then(setStudent);
  }, [user]);

  useEffect(() => {
    if (!student?.agentId) { setAgentName(null); return; }
    apiGet<{ name: string }>(`/api/staff/${student.agentId}`).then((agent) => setAgentName(agent.name));
  }, [student?.agentId]);

  async function handleConnect() {
    if (!student || !code.trim()) return;
    setConnecting(true);
    setConnectError("");
    try {
      const updated = await apiPost<Student>(`/api/students/${student.id}/connect-agent`, { code: code.trim() });
      setStudent(updated);
      setCode("");
    } catch (err) {
      setConnectError(err instanceof Error ? err.message : "Failed to connect to that agent.");
    } finally {
      setConnecting(false);
    }
  }

  function handleLogout() {
    logout();
    navigate("/login", { replace: true });
  }

  if (!student) {
    return <p className="p-5 text-sm text-slate-400">Loading your profile…</p>;
  }

  const initials = student.name.split(" ").map((n) => n[0]).slice(0, 2).join("");

  return (
    <div className="min-h-full pb-8">
      <div className="lg:mx-auto lg:w-full lg:max-w-2xl">
        <MobileHeader title="My Profile" right={<button className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-500 shadow-sm"><Settings size={16} /></button>} />
      </div>

      <div className="px-5 lg:mx-auto lg:w-full lg:max-w-2xl lg:px-10">
        <div className="flex flex-col items-center pb-2 pt-2 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[image:var(--sd-gradient)] text-xl font-semibold text-white">
            {initials}
          </div>
          <p className="mt-3 text-[16px] font-bold text-slate-900">{student.name}</p>
          <p className="text-[13px] text-slate-400">{student.email}</p>
        </div>

        <div className="mt-3 rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
              <Link2 size={14} />
            </div>
            {agentName ? (
              <div className="min-w-0 flex-1">
                <p className="text-[11px] text-slate-400">Connected agent</p>
                <p className="truncate text-[13px] font-semibold text-slate-800">{agentName}</p>
              </div>
            ) : (
              <div className="min-w-0 flex-1">
                <p className="text-[13px] font-medium text-slate-700">Connect to an agent</p>
                <p className="text-[11px] text-slate-400">Enter the referral code they shared with you.</p>
              </div>
            )}
          </div>
          {!agentName && (
            <div className="mt-3 flex items-center gap-2">
              <input
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="Referral code"
                className="min-w-0 flex-1 rounded-lg border border-slate-200 bg-white px-3 py-2 font-mono text-[12.5px] uppercase tracking-wider text-slate-800 focus:outline-none focus:ring-1 focus:ring-[var(--sd-ink)]"
              />
              <button
                onClick={handleConnect}
                disabled={connecting || !code.trim()}
                className="shrink-0 rounded-lg bg-[image:var(--sd-gradient)] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-50"
              >
                {connecting ? "Connecting…" : "Connect"}
              </button>
            </div>
          )}
          {connectError && <p className="mt-2 text-[11.5px] text-rose-600">{connectError}</p>}
        </div>

        <div className="mt-3 rounded-2xl bg-[var(--sd-card)] p-4 shadow-[0_0_10px_rgba(0,0,0,0.11)]">
          <div className="flex items-center justify-between">
            <span className="text-[13px] font-medium text-slate-700">Profile Completion</span>
            <span className="text-[13px] font-semibold text-[var(--sd-teal)]">{percent}%</span>
          </div>
          <div className="mt-2 h-2 w-full overflow-hidden rounded-full bg-slate-100">
            <div className="h-full rounded-full bg-[var(--sd-teal)] transition-all" style={{ width: `${percent}%` }} />
          </div>
        </div>

        <div className="mt-4 overflow-hidden rounded-2xl bg-[var(--sd-card)] shadow-[0_0_10px_rgba(0,0,0,0.11)]">
          {SETTINGS.map((s, i) => {
            const complete = s.stepKey ? completeByKey.get(s.stepKey) : undefined;
            return (
              <button
                key={s.label}
                onClick={() => s.path && navigate(s.path)}
                className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${i !== SETTINGS.length - 1 ? "border-b border-slate-50" : ""}`}
              >
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
                  <s.icon size={16} />
                </div>
                <span className="flex-1 text-[13px] font-medium text-slate-700">{s.label}</span>
                {complete && <CheckCircle2 size={15} className="text-[var(--sd-teal)]" />}
                <ChevronRight size={16} className="text-slate-300" />
              </button>
            );
          })}
        </div>

        <button
          onClick={handleLogout}
          className="mt-4 flex w-full items-center gap-3 rounded-2xl bg-[var(--sd-card)] px-4 py-3.5 text-left shadow-[0_0_10px_rgba(0,0,0,0.11)]"
        >
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-rose-50 text-rose-500">
            <LogOut size={16} />
          </div>
          <span className="flex-1 text-[13px] font-medium text-rose-500">Log Out</span>
        </button>
      </div>
    </div>
  );
}
