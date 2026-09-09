import { useNavigate } from "react-router-dom";
import { Bell, FileText, Search, Sparkles, FolderOpen, ChevronRight, Landmark, Clock, CalendarDays, MessageCircle, Phone } from "lucide-react";
import { BackButton, IconTile } from "../../components/ui/mobile";
import { APPLICATIONS, STUDENTS, CURRENT_STUDENT_ID, COUNSELLORS, AGENTS } from "../../data/mockData";
import { getProfileCompletion } from "../../data/profileCompletion";
import { applicationStatusTone, type StatusTone } from "../../utils/applicationStatus";
import type { SupportContact } from "../../types";

const student = STUDENTS.find((s) => s.id === CURRENT_STUDENT_ID)!;
const initials = student.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
const myApplications = APPLICATIONS.filter((a) => a.studentId === CURRENT_STUDENT_ID);
const activeApplications = myApplications.filter(
  (a) => !["Enrolled", "Withdrawn", "Rejected", "Deferred"].includes(a.status)
).length;
const primaryApplication = [...myApplications].sort((a, b) => b.progress - a.progress)[0];
const myCounsellor = COUNSELLORS.find((c) => c.id === student.counsellorId);
const myAgent = AGENTS.find((a) => a.id === student.agentId);

const heroBadgeStyles: Record<StatusTone, { bg: string; text: string; dot: string }> = {
  green: { bg: "bg-[var(--sd-teal)]/15", text: "text-[#5FE3B8]", dot: "bg-[#5FE3B8]" },
  amber: { bg: "bg-amber-400/15", text: "text-amber-300", dot: "bg-amber-300" },
  rose: { bg: "bg-rose-400/15", text: "text-rose-300", dot: "bg-rose-300" },
  blue: { bg: "bg-sky-400/15", text: "text-sky-300", dot: "bg-sky-300" },
};

function shortUniName(name: string) {
  return name.replace(/^University of /, "");
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return "Good morning,";
  if (h < 18) return "Good afternoon,";
  return "Good evening,";
}

const TASKS = [
  { title: "Upload financial statement", due: "Due in 3 days", icon: Landmark, tone: "rose" as const, path: "/student/documents" },
  { title: "Complete English certificate", due: "Due in 5 days", icon: Clock, tone: "amber" as const, path: "/student/profile/english-proficiency" },
  { title: "Book visa appointment", due: "Due in 12 days", icon: CalendarDays, tone: "blue" as const, path: "/student/applications" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const { percent, pendingSteps, requiredRemaining } = getProfileCompletion();

  return (
    <div className="px-5 pb-6 pt-6">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <BackButton />
          <div>
            <p className="text-sm text-slate-500">{greeting()}</p>
            <h1 className="text-xl font-bold text-slate-900">{student.name}</h1>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate("/student/messages")}
            className="relative flex h-10 w-10 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm"
          >
            <Bell size={18} />
            <span className="absolute right-2.5 top-2.5 h-1.5 w-1.5 rounded-full bg-rose-500" />
          </button>
          <button
            onClick={() => navigate("/student/profile")}
            className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-[var(--sd-ink)] text-xs font-semibold text-white"
          >
            {initials}
          </button>
        </div>
      </div>

      {/* Hero: application progress + (when relevant) a one-line nudge toward the profile — no
          separate "100% done" card ever appears, so the dashboard declutters itself over time. */}
      <div className="relative mt-5 overflow-hidden rounded-3xl bg-gradient-to-br from-[#16264a] to-[#0a1428] p-5 text-white shadow-lg shadow-black/10">
        <div className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full bg-white/[0.04]" />
        <div className="pointer-events-none absolute -bottom-16 -left-10 h-44 w-44 rounded-full bg-[var(--sd-teal)]/10" />

        {primaryApplication ? (
          <button
            onClick={() => navigate(`/student/applications/${primaryApplication.id}`)}
            className="relative block w-full text-left"
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Application Progress</p>
            <div className="mt-1.5 flex items-end justify-between gap-3">
              <div className="min-w-0">
                <p className="text-[28px] font-bold leading-none">{primaryApplication.progress}%</p>
                <p className="mt-1.5 truncate text-[13px] text-white/70">
                  {primaryApplication.course} · {shortUniName(primaryApplication.university)}
                </p>
              </div>
              {(() => {
                const badge = heroBadgeStyles[applicationStatusTone(primaryApplication.status)];
                return (
                  <span className={`flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-medium ${badge.bg} ${badge.text}`}>
                    <span className={`h-1.5 w-1.5 rounded-full ${badge.dot}`} /> {primaryApplication.status}
                  </span>
                );
              })()}
            </div>
            <div className="mt-3 h-1.5 w-full overflow-hidden rounded-full bg-white/10">
              <div className="h-full rounded-full bg-[var(--sd-teal)]" style={{ width: `${primaryApplication.progress}%` }} />
            </div>
            {activeApplications > 1 && (
              <p className="mt-2 text-[11px] text-white/40">
                +{activeApplications - 1} more application{activeApplications - 1 > 1 ? "s" : ""} in progress
              </p>
            )}
          </button>
        ) : (
          <button onClick={() => navigate("/student/search")} className="relative block w-full text-left">
            <p className="text-[11px] font-medium uppercase tracking-wide text-white/50">Get Started</p>
            <p className="mt-1.5 text-[16px] font-semibold">Find your first university</p>
            <p className="mt-1 text-[13px] text-white/60">You haven't started an application yet — explore programs to begin.</p>
          </button>
        )}

        {pendingSteps.length > 0 && (
          <button
            onClick={() => navigate(pendingSteps[0].path)}
            className="relative mt-4 flex w-full items-center justify-between border-t border-white/10 pt-3 text-left"
          >
            <span className="text-[12px] text-white/70">
              Profile {percent}% complete
              {requiredRemaining > 0 ? ` · ${requiredRemaining} required step${requiredRemaining > 1 ? "s" : ""} left` : " · finish up"}
            </span>
            <ChevronRight size={14} className="shrink-0 text-white/40" />
          </button>
        )}
      </div>

      <div className="mt-6 flex items-start justify-between">
        <QuickAction icon={<FileText size={20} />} tone="blue" label="Applications" badge={activeApplications || undefined} onClick={() => navigate("/student/applications")} />
        <QuickAction icon={<Search size={20} />} tone="blue" label="Universities" onClick={() => navigate("/student/search")} />
        <QuickAction icon={<Sparkles size={20} />} tone="violet" label="AI Counsellor" onClick={() => navigate("/student/counsellor")} />
        <QuickAction icon={<FolderOpen size={20} />} tone="blue" label="Documents" badge={12} onClick={() => navigate("/student/documents")} />
      </div>

      <div className="mt-6 flex items-center justify-between">
        <h2 className="text-[15px] font-semibold text-slate-900">Upcoming Tasks</h2>
        <button onClick={() => navigate("/student/applications")} className="text-[13px] font-medium text-slate-400">
          See All
        </button>
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm shadow-black/[0.03]">
        {TASKS.map((t, i) => (
          <button
            key={t.title}
            onClick={() => navigate(t.path)}
            className={`flex w-full items-center gap-3 px-4 py-3.5 text-left ${i !== TASKS.length - 1 ? "border-b border-slate-50" : ""}`}
          >
            <IconTile icon={<t.icon size={16} />} tone={t.tone} />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-slate-800">{t.title}</p>
              <p className={`text-xs ${t.tone === "rose" ? "text-rose-500" : t.tone === "amber" ? "text-amber-600" : "text-slate-400"}`}>{t.due}</p>
            </div>
            <ChevronRight size={16} className="shrink-0 text-slate-300" />
          </button>
        ))}
      </div>

      {(myCounsellor || myAgent) && (
        <>
          <h2 className="mt-6 text-[15px] font-semibold text-slate-900">Your Support Team</h2>
          <div className="mt-3 overflow-hidden rounded-2xl bg-white shadow-sm shadow-black/[0.03]">
            {myCounsellor && <SupportRow contact={myCounsellor} onChat={() => navigate("/student/messages")} />}
            {myCounsellor && myAgent && <div className="border-t border-slate-50" />}
            {myAgent && <SupportRow contact={myAgent} onChat={() => navigate("/student/messages")} />}
          </div>
        </>
      )}
    </div>
  );
}

function SupportRow({ contact, onChat }: { contact: SupportContact; onChat: () => void }) {
  const initials = contact.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const digits = contact.phone.replace(/\D/g, "");

  return (
    <div className="flex items-center gap-3 px-4 py-3.5">
      <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${contact.avatarColor}`}>
        {initials}
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-medium text-slate-800">{contact.name}</p>
        <p className="truncate text-xs text-slate-400">
          {contact.role}
          {contact.organization ? ` · ${contact.organization}` : ""}
        </p>
      </div>
      <div className="flex shrink-0 items-center gap-1.5">
        <button
          onClick={onChat}
          aria-label={`Chat with ${contact.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E7EEFC] text-[#2955C4]"
        >
          <MessageCircle size={14} />
        </button>
        <a
          href={`https://wa.me/${digits}`}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={`WhatsApp ${contact.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[#E3F6EC] text-[#12805A]"
        >
          <MessageCircle size={14} />
        </a>
        <a
          href={`tel:+${digits}`}
          aria-label={`Call ${contact.name}`}
          className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--sd-ink)] text-white"
        >
          <Phone size={14} />
        </a>
      </div>
    </div>
  );
}

const quickActionBg: Record<"blue" | "violet", string> = {
  blue: "bg-[#E7EEFC] text-[#2955C4]",
  violet: "bg-[#F1EAFB] text-[#6D3FBF]",
};

function QuickAction({
  icon, tone, label, badge, onClick,
}: { icon: React.ReactNode; tone: "blue" | "violet"; label: string; badge?: number; onClick?: () => void }) {
  return (
    <button onClick={onClick} className="flex flex-1 flex-col items-center gap-2">
      <div className="relative">
        <div className={`flex h-14 w-14 items-center justify-center rounded-2xl ${quickActionBg[tone]}`}>{icon}</div>
        {badge !== undefined && (
          <span className="absolute -right-1 -top-1 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--sd-ink)] px-1 text-[9px] font-semibold text-white">
            {badge}
          </span>
        )}
      </div>
      <span className="text-center text-[11px] font-medium leading-tight text-slate-600">{label}</span>
    </button>
  );
}
