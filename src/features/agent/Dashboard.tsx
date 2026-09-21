import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users, FileText, Award, PlaneTakeoff, ChevronRight, Sparkles, ArrowUp, ArrowDown, Send,
  ListChecks, Check, Clock, MessageSquare, Globe2, Plus, TrendingUp, AlertCircle, CalendarDays,
} from "lucide-react";
import { LogoBadge } from "../../components/ui/mobile";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { AGENTS, CURRENT_AGENT_ID } from "../../data/mockData";
import { getAllApplications, getStatusHistory } from "../../data/applicationsStore";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { getStatTrends } from "../../data/staffStatsSnapshotStore";
import { agentStageFor, AGENT_STAGES, type AgentStage } from "../../utils/agentPipeline";
import { AGENT_AI_SUGGESTIONS, buildAgentAnswer } from "../../utils/agentAssistantEngine";
import { loadOpenNextStepsFor } from "../../utils/agentNextSteps";
import { getAgentTasks } from "../../utils/taskBoard";
import type { Student } from "../../types";

const CLOSED_STATUSES = new Set(["Enrolled", "Deferred", "Withdrawn", "Rejected"]);

const STAGE_STYLE: Record<AgentStage, { badge: string; dot: string }> = {
  Enquiry: { badge: "bg-blue-50 text-blue-700", dot: "bg-blue-500" },
  Application: { badge: "bg-violet-50 text-violet-700", dot: "bg-violet-500" },
  "Under Review": { badge: "bg-amber-50 text-amber-700", dot: "bg-amber-500" },
  Offer: { badge: "bg-emerald-50 text-emerald-700", dot: "bg-emerald-500" },
  Visa: { badge: "bg-rose-50 text-rose-700", dot: "bg-rose-500" },
};

const COUNTRY_FLAG: Record<string, string> = {
  Bangladesh: "🇧🇩", Nigeria: "🇳🇬", India: "🇮🇳", Vietnam: "🇻🇳", Egypt: "🇪🇬",
  Ghana: "🇬🇭", Brazil: "🇧🇷", Mexico: "🇲🇽",
};

function daysAgo(dateStr: string): string {
  const days = Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "1d ago";
  return `${days}d ago`;
}

export default function AgentDashboard() {
  const navigate = useNavigate();
  const UNIVERSITIES = getAllUniversities();
  const [, forceTick] = useState(0);
  const [question, setQuestion] = useState("");
  const [answer, setAnswer] = useState<string | null>(null);

  const agent = AGENTS.find((a) => a.id === CURRENT_AGENT_ID)!;
  const students = loadAgentStudents();
  const allApps = getAllApplications().filter((a) => students.some((s) => s.id === a.studentId));
  const activeApps = allApps.filter((a) => !CLOSED_STATUSES.has(a.status));
  const offerCount = activeApps.filter((a) => agentStageFor(a.status) === "Offer").length;
  const visaCount = activeApps.filter((a) => agentStageFor(a.status) === "Visa").length;
  const enrolledCount = allApps.filter((a) => a.status === "Enrolled").length;

  const partnerCountries = new Set(activeApps.map((a) => a.country)).size;

  const trends = getStatTrends(
    { students: students.length, applications: activeApps.length, offers: offerCount, visa: visaCount },
    "agent"
  );
  const impactTrends = getStatTrends({ placed: enrolledCount }, "agent-impact");

  const tasks = getAgentTasks(CURRENT_AGENT_ID).filter((t) => t.source === "manual").slice(0, 5);
  const counsellorSteps = loadOpenNextStepsFor(students, allApps).slice(0, 5);

  // Application Pipeline — Enquiry is any student with zero applications at all; the rest bucket
  // by their most-advanced active application's status.
  const studentsWithNoApp = students.filter((s) => !allApps.some((a) => a.studentId === s.id));
  const columns: Record<AgentStage, { student: Student; subtitle: string; sortKey: string }[]> = {
    Enquiry: studentsWithNoApp.map((s) => ({ student: s, subtitle: "New enquiry", sortKey: s.id })),
    Application: [], "Under Review": [], Offer: [], Visa: [],
  };
  activeApps.forEach((a) => {
    const stage = agentStageFor(a.status);
    if (!stage) return;
    const student = students.find((s) => s.id === a.studentId);
    if (!student) return;
    columns[stage].push({ student, subtitle: `${a.university.replace("University of ", "")} — ${a.course}`, sortKey: a.updatedAt });
  });
  AGENT_STAGES.forEach((stage) => {
    if (stage !== "Enquiry") columns[stage].sort((a, b) => b.sortKey.localeCompare(a.sortKey));
  });

  // Students by Country — real, from the agent's own caseload.
  const countryCounts: Record<string, number> = {};
  students.forEach((s) => { countryCounts[s.country] = (countryCounts[s.country] ?? 0) + 1; });
  const topCountries = Object.entries(countryCounts).sort((a, b) => b[1] - a[1]);

  // Top Universities — real, counted from active applications.
  const uniCounts: Record<string, number> = {};
  activeApps.forEach((a) => { uniCounts[a.university] = (uniCounts[a.university] ?? 0) + 1; });
  const topUniversities = Object.entries(uniCounts).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxUniCount = Math.max(1, ...topUniversities.map(([, c]) => c));

  // Application Trends — real, applications bucketed by the month they were last updated.
  const now = new Date();
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    return { key: `${d.getFullYear()}-${d.getMonth()}`, label: d.toLocaleDateString(undefined, { month: "short" }) };
  });
  const monthCounts = months.map(({ key, label }) => {
    const count = allApps.filter((a) => {
      const d = new Date(a.updatedAt);
      return `${d.getFullYear()}-${d.getMonth()}` === key;
    }).length;
    return { label, count };
  });
  const maxMonthCount = Math.max(1, ...monthCounts.map((m) => m.count));

  // Recent Activity — real, derived from each application's own status history (no invented log).
  const activity = allApps
    .flatMap((a) => {
      const student = students.find((s) => s.id === a.studentId);
      const latest = [...getStatusHistory(a.id)].sort((x, y) => y.changedAt.localeCompare(x.changedAt))[0];
      if (!latest || !student) return [];
      return [{ studentName: student.name, university: a.university, status: latest.status, changedAt: latest.changedAt }];
    })
    .sort((a, b) => b.changedAt.localeCompare(a.changedAt))
    .slice(0, 5);

  function askAssistant(text: string) {
    if (!text.trim()) return;
    setAnswer(buildAgentAnswer(text));
  }

  return (
    <div className="space-y-5">
      {/* Welcome banner + Global Impact */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="relative overflow-hidden rounded-2xl border border-slate-100 bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-100 p-6 lg:col-span-2">
          <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-24 w-full opacity-40" viewBox="0 0 400 100" preserveAspectRatio="none">
            <path d="M0 100 L60 40 L110 75 L170 20 L230 70 L290 30 L350 65 L400 45 L400 100 Z" fill="#60a5fa" />
            <path d="M0 100 L90 60 L150 90 L210 50 L280 85 L340 55 L400 80 L400 100 Z" fill="#93c5fd" opacity="0.7" />
          </svg>
          <p className="relative text-xs text-slate-500">Welcome back,</p>
          <h1 className="relative mt-0.5 text-xl font-bold text-slate-900">{agent.name} 👋</h1>
          <p className="relative mt-1 text-xs text-slate-500">New opportunities. Brighter futures.</p>
          <p className="relative mt-4 max-w-[220px] font-serif text-base italic text-slate-400/80">Students Beyond Borders</p>
        </div>

        <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-slate-900 to-blue-950 p-5 text-white">
          <div className="pointer-events-none absolute -right-8 -top-8 h-32 w-32 rounded-full bg-blue-500/20 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-10 -right-10 h-28 w-28 rounded-full border border-white/10" />
          <div className="relative flex items-center gap-1.5 text-xs font-medium text-white/70">
            <Globe2 size={13} /> Your Global Impact
          </div>
          <div className="relative mt-3 flex items-center justify-between">
            <div>
              <p className="text-xl font-bold">{enrolledCount}</p>
              <p className="text-[11px] text-white/60">Students Placed</p>
              {impactTrends.placed !== null && (
                <p className={`mt-1 flex items-center gap-1 text-[10.5px] font-medium ${impactTrends.placed >= 0 ? "text-emerald-400" : "text-rose-400"}`}>
                  {impactTrends.placed >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />} {Math.abs(impactTrends.placed)}% since last visit
                </p>
              )}
            </div>
            <div className="text-right">
              <p className="text-xl font-bold">{partnerCountries}</p>
              <p className="text-[11px] text-white/60">Partner Countries</p>
            </div>
          </div>
          {partnerCountries > 0 && (
            <div className="relative mt-3 flex flex-wrap gap-1.5">
              {Array.from(new Set(activeApps.map((a) => a.country))).slice(0, 6).map((c) => (
                <span key={c} className="rounded-full bg-white/10 px-2 py-0.5 text-[10.5px]">{c}</span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <div className="space-y-5 lg:col-span-2">
          {/* Stat tiles */}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatTile icon={<Users size={16} />} tone="bg-blue-50 text-blue-600" value={students.length} label="Total Students" trend={trends.students} />
            <StatTile icon={<FileText size={16} />} tone="bg-emerald-50 text-emerald-600" value={activeApps.length} label="Active Applications" trend={trends.applications} />
            <StatTile icon={<Award size={16} />} tone="bg-violet-50 text-violet-600" value={offerCount} label="Offers Received" trend={trends.offers} />
            <StatTile icon={<PlaneTakeoff size={16} />} tone="bg-amber-50 text-amber-600" value={visaCount} label="Visa In Process" trend={trends.visa} />
          </div>

          {/* Application Pipeline */}
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-slate-900">Application Pipeline</h2>
                <p className="text-xs text-slate-500">Track and manage your students across every stage</p>
              </div>
              <button onClick={() => navigate("/agent/applications")} className="flex items-center gap-1 text-xs font-medium text-blue-600">
                View All <ChevronRight size={13} />
              </button>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
              {AGENT_STAGES.map((stage) => (
                <div key={stage} className="rounded-xl bg-slate-50 p-2.5">
                  <div className="flex items-center justify-between px-1 pb-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${STAGE_STYLE[stage].badge}`}>{stage}</span>
                    <span className="text-[11px] font-semibold text-slate-400">{columns[stage].length}</span>
                  </div>
                  <div className="space-y-1.5">
                    {columns[stage].slice(0, 3).map(({ student, subtitle }) => (
                      <button
                        key={student.id}
                        onClick={() => navigate(`/agent/students/${student.id}`)}
                        className="flex w-full items-center gap-2 rounded-lg bg-white p-2 text-left shadow-sm hover:shadow"
                      >
                        <span className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold text-white ${student.avatarColor}`}>
                          {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </span>
                        <span className="min-w-0 flex-1">
                          <p className="truncate text-[11.5px] font-medium text-slate-800">{student.name}</p>
                          <p className="truncate text-[10px] text-slate-400">{subtitle}</p>
                        </span>
                      </button>
                    ))}
                    {columns[stage].length > 3 && (
                      <p className="px-1 text-[10.5px] text-slate-400">+{columns[stage].length - 3} more</p>
                    )}
                  </div>
                  {(stage === "Enquiry" || stage === "Application") && (
                    <button
                      onClick={() => navigate("/agent/students/new")}
                      className="mt-2 flex w-full items-center justify-center gap-1 rounded-lg border border-dashed border-slate-300 py-1.5 text-[11px] font-medium text-slate-500 hover:bg-white"
                    >
                      <Plus size={11} /> Add Student
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Students by Country / Top Universities / Application Trends */}
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
              <h3 className="text-[13px] font-semibold text-slate-800">Students by Country</h3>
              <div className="mt-3 space-y-2">
                {topCountries.length === 0 && <p className="text-xs text-slate-400">No students yet.</p>}
                {topCountries.map(([country, count]) => (
                  <div key={country} className="flex items-center justify-between text-xs">
                    <span className="flex items-center gap-1.5 text-slate-600">
                      <span>{COUNTRY_FLAG[country] ?? "🌍"}</span> {country}
                    </span>
                    <span className="font-semibold text-slate-700">{count}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
              <h3 className="text-[13px] font-semibold text-slate-800">Top Universities</h3>
              <div className="mt-3 space-y-2.5">
                {topUniversities.length === 0 && <p className="text-xs text-slate-400">No applications yet.</p>}
                {topUniversities.map(([uni, count]) => {
                  const university = UNIVERSITIES.find((u) => u.name === uni);
                  return (
                    <div key={uni} className="flex items-center gap-2">
                      <LogoBadge name={uni} tone={university?.tone ?? "violet"} logoUrl={university?.logoUrl} className="h-6 w-6 shrink-0 text-[9px]" />
                      <span className="min-w-0 flex-1 truncate text-xs text-slate-600">{uni}</span>
                      <div className="h-1.5 w-14 shrink-0 overflow-hidden rounded-full bg-slate-100">
                        <div className="h-full rounded-full bg-blue-500" style={{ width: `${(count / maxUniCount) * 100}%` }} />
                      </div>
                      <span className="w-4 shrink-0 text-right text-[11px] font-semibold text-slate-500">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
              <div className="flex items-center justify-between">
                <h3 className="text-[13px] font-semibold text-slate-800">Application Trends</h3>
                <TrendingUp size={13} className="text-slate-300" />
              </div>
              <div className="mt-4 flex h-24 items-end gap-2">
                {monthCounts.map((m) => (
                  <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                    <span className="text-[10px] font-semibold text-slate-500">{m.count}</span>
                    <div
                      className="w-full rounded-t bg-blue-400"
                      style={{ height: `${Math.max(6, (m.count / maxMonthCount) * 72)}px` }}
                    />
                    <span className="text-[10px] text-slate-400">{m.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Right column: AI Assistant, Tasks, Activity */}
        <div className="space-y-5">
          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-blue-500" />
              <h3 className="text-[13px] font-semibold text-slate-800">AI Assistant</h3>
              <span className="rounded-full bg-blue-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-blue-600">Beta</span>
            </div>
            <p className="mt-1 text-[11px] text-slate-500">Get insights, draft messages, and more.</p>

            <div className="mt-3 space-y-1.5">
              {AGENT_AI_SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => { setQuestion(s); askAssistant(s); }}
                  className="flex w-full items-center gap-2 rounded-lg border border-slate-100 px-2.5 py-2 text-left text-[11.5px] text-slate-600 hover:bg-slate-50"
                >
                  <Sparkles size={11} className="shrink-0 text-blue-400" /> {s}
                </button>
              ))}
            </div>

            {answer && (
              <div className="mt-3 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-[11.5px] leading-relaxed text-slate-700">
                {answer}
              </div>
            )}

            <form
              onSubmit={(e) => { e.preventDefault(); askAssistant(question); }}
              className="mt-3 flex items-center gap-2 rounded-full border border-slate-200 px-3 py-1.5"
            >
              <input
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                placeholder="Ask anything…"
                className="min-w-0 flex-1 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
              />
              <button type="submit" aria-label="Send" className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-900 text-white">
                <Send size={11} />
              </button>
            </form>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-1.5">
              <ListChecks size={14} className="text-slate-400" />
              <h3 className="text-[13px] font-semibold text-slate-800">Upcoming Tasks</h3>
            </div>
            <div className="mt-3 space-y-3">
              {tasks.length === 0 && <p className="text-xs text-slate-400">No tasks scheduled.</p>}
              {tasks.map((t) => {
                const d = t.dueDate ? new Date(`${t.dueDate}T00:00:00`) : null;
                return (
                  <div key={t.id} className="flex items-start gap-2.5">
                    <div className="flex w-8 shrink-0 flex-col items-center leading-none">
                      {d && (
                        <>
                          <span className="text-[9.5px] font-semibold uppercase text-slate-400">{d.toLocaleDateString(undefined, { month: "short" })}</span>
                          <span className="text-xs font-bold text-slate-700">{d.getDate()}</span>
                        </>
                      )}
                    </div>
                    <button
                      onClick={() => { t.onToggle?.(); forceTick((n) => n + 1); }}
                      aria-label={t.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                      className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}
                    >
                      {t.done && <Check size={10} />}
                    </button>
                    <div className="min-w-0 flex-1">
                      <p className={`truncate text-[12px] font-medium ${t.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{t.title}</p>
                      <p className="truncate text-[10.5px] text-slate-400">{t.subtitle}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
            <div className="flex items-center gap-1.5">
              <AlertCircle size={14} className="text-slate-400" />
              <h3 className="text-[13px] font-semibold text-slate-800">Next Steps From Counsellor</h3>
            </div>
            <div className="mt-3 space-y-2.5">
              {counsellorSteps.length === 0 && <p className="text-xs text-slate-400">No open next steps right now.</p>}
              {counsellorSteps.map((s) => {
                const urgent = s.tone === "overdue";
                const dueClass = urgent ? "text-rose-600" : s.tone === "soon" ? "text-amber-600" : "text-slate-400";
                return (
                  <button
                    key={s.id}
                    onClick={() => navigate(`/agent/students/${s.studentId}`)}
                    className="flex w-full items-start gap-2.5 text-left"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium text-slate-700">{s.title}</p>
                      <p className="truncate text-[10.5px] text-slate-400">{s.studentName} · {s.university}</p>
                    </div>
                    {urgent ? (
                      <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-rose-700">
                        <AlertCircle size={9} /> Emergency
                      </span>
                    ) : s.dueDate ? (
                      <span className={`flex shrink-0 items-center gap-1 text-[10.5px] font-medium ${dueClass}`}>
                        <CalendarDays size={10} /> {s.dueDate}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
            <h3 className="text-[13px] font-semibold text-slate-800">Recent Activities</h3>
            <div className="mt-3 space-y-3">
              {activity.length === 0 && <p className="text-xs text-slate-400">No recent activity.</p>}
              {activity.map((item, i) => {
                const stage = agentStageFor(item.status as never);
                const Icon = stage === "Offer" ? Award : stage === "Visa" ? PlaneTakeoff : stage === "Under Review" ? Clock : MessageSquare;
                const tone = stage === "Offer" ? "bg-emerald-50 text-emerald-600" : stage === "Visa" ? "bg-sky-50 text-sky-600" : stage === "Under Review" ? "bg-amber-50 text-amber-600" : "bg-violet-50 text-violet-600";
                return (
                  <div key={i} className="flex items-start gap-2.5">
                    <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-lg ${tone}`}>
                      <Icon size={13} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] text-slate-700">
                        <span className="font-medium">{item.status}</span> — {item.studentName}
                      </p>
                      <p className="truncate text-[10.5px] text-slate-400">{item.university} · {daysAgo(item.changedAt)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Bottom banner */}
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-r from-slate-900 to-blue-900 p-6">
        <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-blue-500/20 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 right-24 h-32 w-32 rounded-full border border-white/10" />
        <div className="relative flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-base font-bold text-white">More Students. More Opportunities.</p>
            <p className="mt-1 text-xs text-white/70">Partner with 800+ global universities.</p>
          </div>
          <button
            onClick={() => navigate("/agent/universities")}
            className="flex shrink-0 items-center gap-1.5 rounded-lg bg-white px-4 py-2.5 text-xs font-semibold text-slate-900 transition hover:bg-slate-100"
          >
            Explore Partnerships <ChevronRight size={14} />
          </button>
        </div>
      </div>

    </div>
  );
}

function StatTile({
  icon, tone, value, label, trend,
}: { icon: React.ReactNode; tone: string; value: number; label: string; trend: number | null }) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-white p-3.5 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
      <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${tone}`}>{icon}</div>
      <p className="mt-2 text-lg font-bold text-slate-900">{value}</p>
      <p className="text-[11px] text-slate-500">{label}</p>
      {trend === null ? (
        <p className="mt-1 text-[10.5px] font-medium text-slate-300">New</p>
      ) : (
        <p className={`mt-1 flex items-center gap-1 text-[10.5px] font-medium ${trend >= 0 ? "text-emerald-600" : "text-rose-600"}`}>
          {trend >= 0 ? <ArrowUp size={10} /> : <ArrowDown size={10} />} {Math.abs(trend)}%
        </p>
      )}
    </div>
  );
}

