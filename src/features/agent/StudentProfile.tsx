import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, ListChecks, Check, FileText, ChevronDown, ChevronUp, FileCheck2, History, AlertCircle, CalendarDays, Upload, Bookmark, X,
  CheckCircle2, ShieldCheck,
} from "lucide-react";
import { StatusBadge, ProgressBar, Badge } from "../../components/ui";
import { LogoBadge } from "../../components/ui/mobile";
import { ProfileStepsPanel } from "../../components/ProfileStepsPanel";
import { ChecklistCard } from "../../components/ChecklistCard";
import { ApplicationChecklistCard } from "../../components/ApplicationChecklistCard";
import { DocViewButton } from "../../components/DocViewButton";
import { CreateApplicationModal } from "./CreateApplicationModal";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { getAllApplications, getStatusHistory } from "../../data/applicationsStore";
import { loadUploadedDocs, addUploadedDoc } from "../../data/applicationDocsStore";
import { loadDocDueDate } from "../../data/documentDueDatesStore";
import { getAgentTasks, getStudentTasks } from "../../utils/taskBoard";
import { loadShortlistFor, removeShortlistFor } from "../../data/agentShortlistStore";
import { buildChecklist, buildCoreChecklist, academicProfileIncomplete } from "../../utils/documentChecklist";
import { addCoreDoc } from "../../data/coreDocsStore";
import { CoreDocumentCard, AddCoreDocumentButton } from "../../components/CoreDocumentCard";
import { formatStudentId, formatApplicationId } from "../../utils/displayId";
import { UNIVERSITIES, DOCUMENTS, CURRENT_AGENT_ID } from "../../data/mockData";
import { daysAgo } from "../../utils/counsellorData";
import { loadOpenNextStepsFor } from "../../utils/agentNextSteps";

const CLOSED_STATUSES = new Set(["Enrolled", "Deferred", "Withdrawn", "Rejected"]);
const TABS = ["Overview", "Applications", "Shortlist", "Documents", "Tasks"] as const;
type Tab = (typeof TABS)[number];

export default function AgentStudentProfile() {
  const navigate = useNavigate();
  const { id } = useParams();
  const location = useLocation();
  const navState = location.state as { tab?: Tab; appId?: string } | null;
  const agentStudents = loadAgentStudents();
  const student = agentStudents.find((s) => s.id === id) ?? null;
  const [tab, setTab] = useState<Tab>(navState?.tab ?? "Overview");
  const [expandedAppId, setExpandedAppId] = useState<string | null>(navState?.appId ?? null);
  const [applyTarget, setApplyTarget] = useState<{ universityId: string; courseName: string } | null>(null);
  const [, forceTick] = useState(0);

  // Any document upload below calls notifyCacheChange(), which forces the shell to remount this
  // whole page (see syncCache.ts's useCacheSync). A plain setTab/setExpandedAppId gets wiped by
  // that remount, since the fresh useState() above re-reads navState — snapping back to the
  // Overview tab mid-upload. Routing the choice through router state instead means the remount
  // reads the same value straight back.
  function selectTab(next: Tab) {
    setTab(next);
    navigate(location.pathname, { replace: true, state: { tab: next, appId: expandedAppId } });
  }
  function toggleExpandedApp(appId: string) {
    const next = expandedAppId === appId ? null : appId;
    setExpandedAppId(next);
    navigate(location.pathname, { replace: true, state: { tab, appId: next } });
  }

  if (!student) {
    // Same reasoning as counsellor StudentProfile.tsx: an empty caseload usually means the
    // agent-students cache just hasn't finished its first fetch yet, not a genuine mismatch.
    return (
      <div>
        <button onClick={() => navigate("/agent/students")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
          <ArrowLeft size={14} /> Back to Students
        </button>
        <p className="text-xs text-slate-400">{agentStudents.length === 0 ? "Loading…" : "Student not found."}</p>
      </div>
    );
  }

  const apps = getAllApplications().filter((a) => a.studentId === student.id);
  const activeApps = apps.filter((a) => !CLOSED_STATUSES.has(a.status));
  const avgProgress = activeApps.length ? Math.round(activeApps.reduce((s, a) => s + a.progress, 0) / activeApps.length) : 0;

  const tasks = getAgentTasks(CURRENT_AGENT_ID).filter((t) => t.studentId === student.id);
  const counsellorSteps = loadOpenNextStepsFor([student], apps);
  // The same aggregation the student sees on their own Dashboard (next steps, rejected/re-upload
  // docs, and any manually assigned task, from any assigner — not just this agent's own) —
  // surfaced here too, up front, instead of only inside the separate Tasks tab.
  const studentTasks = getStudentTasks(student.id).filter((t) => !t.done);

  const coreMissing = buildCoreChecklist(student.id).filter((r) => !r.own);
  const perAppMissing = activeApps.reduce((sum, a) => {
    const uni = UNIVERSITIES.find((u) => u.name === a.university);
    const docs = [...DOCUMENTS.filter((d) => d.studentId === student.id && d.applicationId === a.id), ...loadUploadedDocs(a.id)];
    return sum + buildChecklist(uni, student.id, a.id, docs).filter((r) => !r.own && !r.reused).length;
  }, 0);
  const totalMissing = coreMissing.length + perAppMissing;
  const shortlist = loadShortlistFor(student.id);

  return (
    <div className="max-w-5xl">
      <button onClick={() => navigate("/agent/students")} className="mb-4 flex items-center gap-1.5 text-xs font-medium text-blue-600">
        <ArrowLeft size={14} /> Back to Students
      </button>

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-sm font-semibold text-white ${student.avatarColor}`}>
              {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-base font-semibold text-slate-900">{student.name}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide text-slate-500">
                  {formatStudentId(student.id)}
                </span>
              </div>
              <p className="text-xs text-slate-400">{student.email} · {student.country}</p>
            </div>
          </div>
          {student.riskFlag && student.riskFlag !== "none" && (
            <Badge tone={student.riskFlag === "high" ? "red" : "amber"}>{student.riskFlag === "high" ? "High risk" : "Watchlist"}</Badge>
          )}
        </div>

        <div className="mt-4 flex items-center gap-5 overflow-x-auto border-b border-slate-100">
          {TABS.map((t) => {
            const count = t === "Applications" ? apps.length : t === "Documents" ? totalMissing : t === "Tasks" ? tasks.length + counsellorSteps.length : t === "Shortlist" ? shortlist.length : null;
            return (
              <button
                key={t}
                onClick={() => selectTab(t)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap pb-3 text-[13px] font-medium transition ${
                  tab === t ? "text-blue-700" : "text-slate-400"
                }`}
              >
                {t}
                {count !== null && count > 0 && (
                  <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${tab === t ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"}`}>
                    {count}
                  </span>
                )}
                {tab === t && <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-blue-600" />}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "Overview" && (
        <>
          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <p className="mb-3 text-xs font-semibold text-slate-800">Next Steps</p>
            {studentTasks.length === 0 ? (
              <p className="text-xs text-slate-400">No open action items for {student.name}.</p>
            ) : (
              <div className="space-y-1.5">
                {studentTasks.map((t) => {
                  const Icon = t.source === "document" ? FileText : t.source === "next-step" ? CheckCircle2 : ShieldCheck;
                  const tone = t.tone === "overdue" ? "border-rose-200 bg-rose-50/60" : "border-slate-100 bg-slate-50";
                  const iconTone = t.tone === "overdue" ? "bg-rose-100 text-rose-600" : "bg-[#E7EEFC] text-[#2955C4]";
                  return (
                    <div key={t.id} className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 ${tone}`}>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${iconTone}`}>
                        <Icon size={14} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-slate-800">{t.title}</p>
                        {t.subtitle && <p className="truncate text-[11px] text-slate-400">{t.subtitle}</p>}
                      </div>
                      {t.dueDate && (
                        <span className={`shrink-0 text-[11px] font-medium ${t.tone === "overdue" ? "text-rose-600" : "text-slate-400"}`}>
                          {t.dueDate}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <div className="grid grid-cols-2 gap-x-4 gap-y-3 rounded-xl bg-slate-50 px-4 py-3 text-xs sm:grid-cols-4">
              <Detail label="Email" value={student.email} />
              <Detail label="Country" value={student.country} />
              <Detail label="Risk status" value={student.riskFlag && student.riskFlag !== "none" ? (student.riskFlag === "high" ? "High risk" : "Watchlist") : "No flags"} />
              <Detail label="Active applications" value={String(activeApps.length)} />
            </div>
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
              {activeApps.length === 0
                ? "No active applications yet."
                : `${activeApps.length} active application${activeApps.length === 1 ? "" : "s"}, averaging ${avgProgress}% progress. ${totalMissing} document${totalMissing === 1 ? "" : "s"} outstanding across their case.`}
            </p>
          </div>
          <div className="mt-4">
            <ProfileStepsPanel studentId={student.id} />
          </div>
        </>
      )}

      {tab === "Applications" && (
        <div className="mt-4 space-y-3">
          {apps.map((a) => {
            const university = UNIVERSITIES.find((u) => u.name === a.university);
            const docs = [...DOCUMENTS.filter((d) => d.studentId === student.id && d.applicationId === a.id), ...loadUploadedDocs(a.id)];
            const checklist = buildChecklist(university, student.id, a.id, docs);
            const missingDocs = checklist.filter((r) => !r.own && !r.reused);
            const appNextSteps = counsellorSteps.filter((s) => s.applicationId === a.id);
            const statusHistory = [...getStatusHistory(a.id)].reverse();
            const uploadHistory = [...docs].sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt));
            const expanded = expandedAppId === a.id;

            return (
              <div key={a.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.05)]">
                <button
                  onClick={() => toggleExpandedApp(a.id)}
                  className="flex w-full flex-col gap-2.5 p-4 text-left"
                >
                  <div className="flex items-start gap-3">
                    <LogoBadge name={a.university} tone={university?.tone ?? "violet"} logoUrl={university?.logoUrl} className="h-10 w-10 shrink-0 text-xs" />
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-xs font-semibold text-slate-800">{a.university}</p>
                      <p className="truncate text-xs text-slate-500">{a.course} · {a.intake} · {a.campus ?? "Main Campus"}</p>
                    </div>
                    {expanded ? <ChevronUp size={16} className="shrink-0 text-slate-300" /> : <ChevronDown size={16} className="shrink-0 text-slate-300" />}
                  </div>
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold text-slate-500">
                      {formatApplicationId(a.id)}
                    </span>
                    <StatusBadge status={a.status} />
                  </div>
                  <div className="flex items-center gap-2">
                    <ProgressBar value={a.progress} size="sm" />
                    <span className="shrink-0 text-[11px] text-slate-400">{a.progress}%</span>
                  </div>
                  <p className="text-xs text-slate-500">{a.nextAction}</p>
                </button>

                {!expanded && (appNextSteps.length > 0 || missingDocs.length > 0) && (
                  <div className="space-y-1.5 px-4 pb-4">
                    {appNextSteps.slice(0, 1).map((s) => {
                      const urgent = s.tone === "overdue";
                      const dueClass = urgent ? "text-rose-600" : s.tone === "soon" ? "text-amber-600" : "text-slate-400";
                      return (
                        <div key={s.id} className="rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                          <div className="flex items-center gap-1.5 text-slate-600">
                            <ListChecks size={12} className="shrink-0 text-slate-400" />
                            <span className="min-w-0 flex-1 truncate">
                              Next: {s.title}
                              {appNextSteps.length > 1 ? ` (+${appNextSteps.length - 1} more)` : ""}
                            </span>
                          </div>
                          {(urgent || s.dueDate) && (
                            <div className="mt-1 flex flex-wrap items-center gap-1.5 pl-[18px]">
                              {urgent && (
                                <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-rose-700">
                                  <AlertCircle size={9} /> Emergency
                                </span>
                              )}
                              {s.dueDate && (
                                <span className={`flex shrink-0 items-center gap-1 font-medium ${dueClass}`}>
                                  <CalendarDays size={11} /> {s.dueDate}
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {missingDocs.map((row) => {
                      const due = loadDocDueDate(a.id, row.type);
                      return (
                        <div key={row.type} className="flex items-center gap-2 rounded-lg bg-amber-50/60 px-2.5 py-1.5 text-xs">
                          <AlertCircle size={12} className="shrink-0 text-amber-500" />
                          <span className="min-w-0 flex-1 truncate text-slate-700">{row.type}</span>
                          {due && (
                            <span className="flex shrink-0 items-center gap-1 font-medium text-slate-400">
                              <CalendarDays size={10} /> {due}
                            </span>
                          )}
                          <label className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-[10.5px] font-semibold text-white">
                            <Upload size={10} /> Upload
                            <input
                              type="file"
                              accept="image/*,.pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  addUploadedDoc(a.id, row.type, file);
                                  forceTick((t) => t + 1);
                                }
                                e.target.value = "";
                              }}
                            />
                          </label>
                        </div>
                      );
                    })}
                  </div>
                )}

                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl border border-slate-100 bg-white p-3 text-xs sm:grid-cols-4">
                      <Detail label="Country" value={a.country} />
                      <Detail label="Waiting on" value={a.waitingOn} />
                      <Detail label="Updated" value={daysAgo(a.updatedAt)} />
                      <Detail label="Next action" value={a.nextAction} />
                    </div>

                    <p className="mb-2 mt-4 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                      <FileCheck2 size={13} /> Document checklist
                    </p>
                    <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                      {checklist.map((r) => (
                        <ApplicationChecklistCard
                          key={r.type}
                          row={r}
                          onUpload={(file) => {
                            addUploadedDoc(a.id, r.type, file);
                            forceTick((t) => t + 1);
                          }}
                        />
                      ))}
                      {checklist.length === 0 && <p className="text-[12.5px] text-slate-400">No checklist items for this application.</p>}
                    </div>

                    <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <ListChecks size={13} /> Next steps <span className="font-normal text-slate-400">— set by your counsellor</span>
                      </p>
                      {counsellorSteps.filter((s) => s.applicationId === a.id).length === 0 ? (
                        <p className="text-[12px] text-slate-400">No next steps set for this application yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {counsellorSteps.filter((s) => s.applicationId === a.id).map((s) => {
                            const urgent = s.tone === "overdue";
                            const dueClass = urgent ? "text-rose-600" : s.tone === "soon" ? "text-amber-600" : "text-slate-400";
                            return (
                              <div key={s.id} className="flex flex-wrap items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                                {urgent && (
                                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                                    <AlertCircle size={10} /> Emergency
                                  </span>
                                )}
                                <span className="min-w-0 flex-1 text-slate-700">{s.title}</span>
                                {s.dueDate && (
                                  <span className={`flex shrink-0 items-center gap-1 font-medium ${dueClass}`}>
                                    <CalendarDays size={11} /> {s.dueDate}
                                  </span>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-white p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <History size={13} /> Status history
                        </p>
                        <div className="space-y-2">
                          {statusHistory.map((h, i) => (
                            <div key={`${h.status}-${h.changedAt}-${i}`} className="flex items-center gap-2 text-[12px]">
                              <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i === 0 ? "bg-blue-600" : "bg-slate-300"}`} />
                              <span className={`flex-1 ${i === 0 ? "font-medium text-slate-800" : "text-slate-500"}`}>{h.status}</span>
                              <span className="shrink-0 text-[11px] text-slate-400">{h.changedAt}</span>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-xl border border-slate-100 bg-white p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <FileText size={13} /> Document upload history
                        </p>
                        {uploadHistory.length === 0 ? (
                          <p className="text-[12px] text-slate-400">No documents uploaded for this application yet.</p>
                        ) : (
                          <div className="space-y-2">
                            {uploadHistory.map((d) => (
                              <div key={d.id} className="flex items-center gap-2 text-[12px]">
                                <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                                <span className="min-w-0 flex-1 truncate text-slate-700">{d.name}</span>
                                {"previewUrl" in d && d.previewUrl && (
                                  <DocViewButton
                                    name={d.name}
                                    previewUrl={d.previewUrl}
                                    className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-1.5 py-0.5 text-[10.5px] font-medium text-slate-600 hover:bg-slate-200"
                                  />
                                )}
                                <span className="shrink-0 text-[11px] text-slate-400">{d.uploadedAt}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {apps.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-[12.5px] text-slate-400">
              No applications yet for {student.name}.
            </p>
          )}
        </div>
      )}

      {tab === "Shortlist" && (
        <div className="mt-4 space-y-2.5">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-slate-600">
            <Bookmark size={14} className="text-slate-400" /> Shortlisted programs for {student.name.split(" ")[0]}
          </p>
          {shortlist.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-[12.5px] text-slate-400">
              No programs shortlisted for {student.name} yet — shortlist one from the Universities page.
            </p>
          )}
          {shortlist.map((p) => {
            const university = UNIVERSITIES.find((u) => u.id === p.universityId);
            return (
              <div key={`${p.universityId}-${p.courseName}`} className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
                <LogoBadge name={p.universityName} tone={university?.tone ?? "violet"} logoUrl={university?.logoUrl} className="h-10 w-10 shrink-0 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{p.courseName}</p>
                  <p className="truncate text-[11px] text-slate-400">{p.universityName} · Shortlisted {p.addedAt}</p>
                </div>
                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    onClick={() => setApplyTarget({ universityId: p.universityId, courseName: p.courseName })}
                    className="rounded-full bg-blue-600 px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-blue-700"
                  >
                    Apply
                  </button>
                  <button
                    onClick={() => { removeShortlistFor(student.id, p.universityId, p.courseName); forceTick((t) => t + 1); }}
                    aria-label={`Remove ${p.courseName} from shortlist`}
                    className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                  >
                    <X size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {applyTarget && (
        <CreateApplicationModal
          students={[student]}
          initialStudentId={student.id}
          initialUniversityId={applyTarget.universityId}
          initialCourseName={applyTarget.courseName}
          onClose={() => setApplyTarget(null)}
          onCreated={() => setApplyTarget(null)}
        />
      )}

      {tab === "Documents" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center justify-between gap-3">
              <p className="text-xs font-semibold text-slate-800">Core documents</p>
              <AddCoreDocumentButton
                studentId={student.id}
                existingTypes={buildCoreChecklist(student.id).map((r) => r.type)}
                onAdded={() => forceTick((t) => t + 1)}
              />
            </div>
            {academicProfileIncomplete(student.id) && (
              <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-[11px] leading-relaxed text-slate-500">
                {student.name}'s academic profile isn't fully filled in yet — use "Add a document type" above for
                anything the list below doesn't already cover.
              </p>
            )}
            {buildCoreChecklist(student.id).length === 0 ? (
              <p className="text-xs text-slate-400">No core document requirements found.</p>
            ) : (
              <div className="space-y-1.5">
                {buildCoreChecklist(student.id).map((r) => (
                  <CoreDocumentCard
                    key={r.type}
                    row={r}
                    canUpload
                    canVerify={false}
                    onUpload={(file) => {
                      addCoreDoc(student.id, r.type, file);
                      forceTick((t) => t + 1);
                    }}
                  />
                ))}
              </div>
            )}
          </div>

          {activeApps.map((a) => {
            const university = UNIVERSITIES.find((u) => u.name === a.university);
            const docs = [...DOCUMENTS.filter((d) => d.studentId === student.id && d.applicationId === a.id), ...loadUploadedDocs(a.id)];
            const checklist = buildChecklist(university, student.id, a.id, docs);
            return (
              <div key={a.id} className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                  <FileText size={14} className="text-slate-400" /> {a.university} — {a.course}
                </p>
                <div className="space-y-1.5">
                  {checklist.map((r) => (
                    <ChecklistCard key={r.type} row={r} />
                  ))}
                  {checklist.length === 0 && <p className="text-[12.5px] text-slate-400">No checklist items for this application.</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {tab === "Tasks" && (
        <div className="mt-4 space-y-4">
          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <ListChecks size={14} className="text-slate-400" /> Tasks related to {student.name.split(" ")[0]}
            </p>
            {tasks.length === 0 ? (
              <p className="text-xs text-slate-400">No tasks are currently linked to this student.</p>
            ) : (
              <div className="space-y-2">
                {tasks.map((t) => {
                  const d = t.dueDate ? new Date(`${t.dueDate}T00:00:00`) : null;
                  return (
                    <div key={t.id} className="flex items-center gap-3 rounded-xl border border-slate-100 p-3">
                      {t.onToggle ? (
                        <button
                          onClick={() => { t.onToggle?.(); forceTick((n) => n + 1); }}
                          aria-label={t.done ? `Mark "${t.title}" not done` : `Mark "${t.title}" done`}
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${t.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"}`}
                        >
                          {t.done && <Check size={11} />}
                        </button>
                      ) : (
                        <span className="h-2 w-2 shrink-0 rounded-full bg-slate-300" />
                      )}
                      <div className="min-w-0 flex-1">
                        <p className={`truncate text-[13px] font-medium ${t.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{t.title}</p>
                      </div>
                      {d && (
                        <span className="shrink-0 text-[11px] text-slate-400">
                          {d.toLocaleDateString(undefined, { month: "short", day: "numeric" })}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold text-slate-800">
              <History size={14} className="text-slate-400" /> Next steps from your counsellor
            </p>
            {counsellorSteps.length === 0 ? (
              <p className="text-xs text-slate-400">No open next steps from your counsellor.</p>
            ) : (
              <div className="space-y-2">
                {counsellorSteps.map((s) => {
                  const urgent = s.tone === "overdue";
                  const dueClass = urgent ? "text-rose-600" : s.tone === "soon" ? "text-amber-600" : "text-slate-400";
                  return (
                    <div key={s.id} className="flex flex-wrap items-center gap-2.5 rounded-xl border border-slate-100 p-3">
                      {urgent && (
                        <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-100 px-1.5 py-0.5 text-[10px] font-semibold text-rose-700">
                          <AlertCircle size={10} /> Emergency
                        </span>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-medium text-slate-700">{s.title}</p>
                        <p className="truncate text-[11px] text-slate-400">{s.university}</p>
                      </div>
                      {s.dueDate && (
                        <span className={`flex shrink-0 items-center gap-1 text-[11px] font-medium ${dueClass}`}>
                          <CalendarDays size={11} /> {s.dueDate}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 break-words font-medium text-slate-700">{value}</p>
    </div>
  );
}
