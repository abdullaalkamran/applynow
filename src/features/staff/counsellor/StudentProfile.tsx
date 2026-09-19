import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  Check, ChevronDown, ChevronUp, FileCheck2, FileText, Plus, X, History, ListChecks, CalendarDays,
  Sparkles, Layers, CheckCircle2, ShieldCheck, AlertCircle, Clock3, type LucideIcon,
} from "lucide-react";
import { Badge, Button, ProgressBar, Modal, SearchableSelect, BackButton } from "../../../components/ui";
import { LogoBadge } from "../../../components/ui/mobile";
import { ProfileStepsPanel, Detail } from "../../../components/ProfileStepsPanel";
import { ApplicationChecklistCard } from "../../../components/ApplicationChecklistCard";
import { DocViewButton } from "../../../components/DocViewButton";
import { DOCUMENTS, AGENTS, COUNSELLORS, ADMISSION_OFFICERS } from "../../../data/mockData";
import { getAllUniversities } from "../../../data/universityCatalogStore";
import { getAllApplications, getStatusHistory, createApplication, sortByCreatedAscending } from "../../../data/applicationsStore";
import {
  loadUploadedDocs, addUploadedDoc, verifyAppDoc, rejectAppDoc, loadCustomDocRequests, addCustomDocRequest, removeCustomDocRequest,
} from "../../../data/applicationDocsStore";
import {
  buildChecklist, buildCoreChecklist, academicProfileIncomplete, coreDocTypes, docMatchesType, type ChecklistRow,
} from "../../../utils/documentChecklist";
import { getStudentTasks } from "../../../utils/taskBoard";
import { addCoreDoc, verifyCoreDoc, rejectCoreDoc } from "../../../data/coreDocsStore";
import { AddCoreDocumentButton } from "../../../components/CoreDocumentCard";
import { StudentCommentsCard } from "../../../components/StudentCommentsCard";
import { activeApplicationsFor } from "../../../utils/counsellorData";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { formatStudentId, formatApplicationId } from "../../../utils/displayId";
import { destinationOptions, campusesFor, courseHasOpenIntake } from "../../../utils/universityFilter";
import {
  loadNextSteps, addNextStep, toggleNextStepDone, removeNextStep, setNextStepDueDate, dueDateTone as stepDueTone,
} from "../../../data/applicationNextStepsStore";
import { setDocDueDate } from "../../../data/documentDueDatesStore";
import { isSeenByCounsellor, markSeenByCounsellor } from "../../../data/counsellorSeenApplicationsStore";
import {
  JourneyStepper, JourneyStageEditor, ResponsibleStaffCard, ApplicationTasksCard, ApplicationActivityCard,
} from "../../../components/ApplicationJourneyPanel";
import { JourneyStageGrid } from "../../../components/JourneyStageGrid";
import { useAuth } from "../../../context/AuthContext";
import { loadJourney, updateStage } from "../../../data/applicationJourneyStore";
import type { Student, University } from "../../../types";

/** The open intake months for one course — course's own `intakes` subset when set, else the
 * university's full list, filtered down to the ones actually marked open. */
function openIntakesFor(university: University, course: University["courses"][number]): string[] {
  const months = course.intakes && course.intakes.length > 0 ? course.intakes : university.intakes;
  return months.filter((m) => !!university.intakeStatus?.[m]);
}

/** The first course with at least one open intake — undefined if none of them have one. */
function firstOpenCourse(university: University | undefined): University["courses"][number] | undefined {
  return university?.courses.find((c) => courseHasOpenIntake(university, c));
}

const RISK_TONE: Record<NonNullable<Student["riskFlag"]>, "amber" | "red"> = { watch: "amber", high: "red", none: "amber" };

// Defensive display fallback — a handful of applications created before create_application's
// university/course validation was added stored the literal string "undefined" (not a real JS
// `undefined`, which React would just skip rendering). Shows a plain dash instead of that text
// wherever an application field turns out to be missing or corrupted.
function safeText(value: string | undefined | null): string {
  if (!value || value === "undefined" || value === "null") return "—";
  return value;
}

const TABS = ["Overview", "Applications", "Documents", "Comments"] as const;

// Consistent icon-badge header for each of the 4 application-detail columns, so they read as
// distinct, scannable panels instead of loosely stacked cards under a plain gray label.
function ColumnHeader({ icon: Icon, label, tone }: { icon: LucideIcon; label: string; tone: string }) {
  return (
    <p className="flex items-center gap-2 text-[11.5px] font-semibold text-slate-600">
      <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-md ${tone}`}>
        <Icon size={11} className="text-white" />
      </span>
      {label}
    </p>
  );
}
type Tab = (typeof TABS)[number];

export default function StudentProfile() {
  const { user, token } = useAuth();
  const actor = user ? { id: user.roleUserId, role: user.role, name: user.name } : undefined;
  const UNIVERSITIES = getAllUniversities();
  const { id } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const navState = location.state as { tab?: Tab; appId?: string } | null;
  const assignedStudents = loadAssignedStudents();
  const student = assignedStudents.find((s) => s.id === id) ?? null;
  const [tab, setTab] = useState<Tab>(navState?.tab ?? "Overview");
  const [expandedAppId, setExpandedAppId] = useState<string | null>(navState?.appId ?? null);

  // Any document upload/verify/reject below calls notifyCacheChange(), which forces the shell to
  // remount this whole page (see syncCache.ts's useCacheSync — it keys <Outlet> on a version
  // counter so components reading a store synchronously during render pick up fresh data). A plain
  // setTab/setExpandedAppId would then be wiped on that remount, since the fresh useState() above
  // re-reads navState — snapping the counsellor back to the Overview tab mid-upload. Routing the
  // choice through router state instead means the remount reads the same value straight back.
  function selectTab(next: Tab) {
    setTab(next);
    navigate(location.pathname, { replace: true, state: { tab: next, appId: expandedAppId } });
  }
  function toggleExpandedApp(appId: string) {
    const next = expandedAppId === appId ? null : appId;
    setExpandedAppId(next);
    navigate(location.pathname, { replace: true, state: { tab, appId: next } });
  }
  const [requestDocType, setRequestDocType] = useState("");
  const [requestDocDue, setRequestDocDue] = useState("");
  const [nextStepDraft, setNextStepDraft] = useState("");
  const [nextStepDue, setNextStepDue] = useState("");
  const [newAppOpen, setNewAppOpen] = useState(false);
  const [, forceTick] = useState(0);

  if (!student) {
    // An empty caseload usually means the assigned-students cache just hasn't finished its first
    // fetch yet (e.g. right after a hard reload of this exact URL, before warmCaches() resolves —
    // see applicationsStore.ts's ApplicationDetail equivalent) rather than a genuine mismatch; a
    // non-empty list that simply doesn't include this id is the real "not found" case.
    return (
      <div>
        <BackButton fallback="/staff/counsellor/students" />
        <p className="text-sm text-slate-400">{assignedStudents.length === 0 ? "Loading…" : "Student not found."}</p>
      </div>
    );
  }

  const apps = getAllApplications().filter((a) => a.studentId === student.id);
  const activeApps = activeApplicationsFor(student.id);
  const primary = [...activeApps].sort((a, b) => b.progress - a.progress)[0];
  const avgProgress = activeApps.length ? Math.round(activeApps.reduce((s, a) => s + a.progress, 0) / activeApps.length) : 0;
  const coreRows = buildCoreChecklist(student.id);
  // Same aggregation the student sees on their own Dashboard (next steps, rejected/re-upload docs,
  // and any manually assigned task) — surfaced here too so the counsellor doesn't have to guess
  // what's outstanding or dig into a separate Tasks tab to find it.
  const studentTasks = getStudentTasks(student.id).filter((t) => !t.done);

  // Every document (core + every active application), flattened and tagged with where it came
  // from — the same shape student/Documents.tsx builds, so the counsellor's Documents tab can
  // group them into the same three status sections instead of the student's own, separate
  // core-vault-only view this tab used to show.
  const docCoreTypes = coreDocTypes();
  const flatCoreDocRows: (ChecklistRow & { scope: string; scopeLabel: string })[] = coreRows.map((r) => ({
    ...r, scope: "core", scopeLabel: "Core Documents",
  }));
  const extraDocsAcrossApps: { id: string; name: string; type: string; status: string }[] = [];
  const flatAppDocRows: (ChecklistRow & { scope: string; scopeLabel: string })[] = activeApps.flatMap((a) => {
    const uni = UNIVERSITIES.find((u) => u.name === a.university);
    const docs = [...DOCUMENTS.filter((d) => d.studentId === student.id && d.applicationId === a.id), ...loadUploadedDocs(a.id)];
    const rows = buildChecklist(uni, student.id, a.id, docs);
    extraDocsAcrossApps.push(
      ...docs.filter((d) => !rows.some((r) => docMatchesType(d.name, r.type)) && !docCoreTypes.some((t) => docMatchesType(d.name, t)))
    );
    return rows.map((r) => ({ ...r, scope: a.id, scopeLabel: a.university }));
  });
  const allDocRows = [...flatCoreDocRows, ...flatAppDocRows];
  const requiredDocRows = allDocRows.filter((r) => !r.own && !r.reused);
  const pendingDocRows = allDocRows.filter((r) => r.own && r.own.status !== "verified");
  const verifiedDocRows = allDocRows.filter((r) => r.reused || r.own?.status === "verified");
  const totalMissing = requiredDocRows.length;

  /** One row of the Documents tab's three status sections — routes upload/verify/reject to the
   * core or per-application store depending on which one the row came from, and appends the
   * university name to the displayed type so the same document type on two different
   * applications (or a core type that happens to share a name) doesn't read as one row. */
  const renderDocRow = (row: ChecklistRow & { scope: string; scopeLabel: string }) => {
    const isCore = row.scope === "core";
    const displayType = isCore ? row.type : `${row.type} — ${row.scopeLabel}`;
    const isCustomRequest = !isCore && !row.own && !row.reused && loadCustomDocRequests(row.scope).some((cr) => cr.type === row.type);
    return (
      <ApplicationChecklistCard
        key={`${row.scope}::${row.type}`}
        row={{ ...row, type: displayType }}
        canVerify
        onUpload={(file) => {
          if (isCore) addCoreDoc(student.id, row.type, file);
          else addUploadedDoc(row.scope, row.type, file);
          forceTick((t) => t + 1);
        }}
        onVerify={(id) => {
          if (isCore) verifyCoreDoc(id);
          else verifyAppDoc(id);
          forceTick((t) => t + 1);
        }}
        onReject={(id, reason) => {
          if (isCore) rejectCoreDoc(id, reason);
          else rejectAppDoc(id, reason);
          forceTick((t) => t + 1);
        }}
        onRemoveRequest={isCustomRequest ? () => { removeCustomDocRequest(row.scope, row.type); forceTick((t) => t + 1); } : undefined}
      />
    );
  };

  const agent = student.agentId ? AGENTS.find((a) => a.id === student.agentId) : undefined;

  return (
    <div className="max-w-5xl">
      <BackButton fallback="/staff/counsellor/students" />

      <div className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-full text-base font-semibold text-white ${student.avatarColor}`}>
              {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
            </div>
            <div>
              <div className="flex items-center gap-2">
                <p className="text-lg font-semibold text-slate-900">{student.name}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[10.5px] font-semibold tracking-wide text-slate-500">
                  {formatStudentId(student.id)}
                </span>
              </div>
              <p className="text-xs text-slate-400">{student.email} · {student.country}</p>
            </div>
          </div>
          {student.riskFlag && student.riskFlag !== "none" && (
            <Badge tone={RISK_TONE[student.riskFlag]}>{student.riskFlag === "high" ? "High risk" : "Watchlist"}</Badge>
          )}
        </div>

        <div className="mt-4 flex items-center gap-5 overflow-x-auto border-b border-slate-100">
          {TABS.map((t) => {
            const count = t === "Applications" ? apps.length : t === "Documents" ? totalMissing : null;
            return (
              <button
                key={t}
                onClick={() => selectTab(t)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap pb-3 text-[13px] font-medium transition ${
                  tab === t ? "text-[var(--sd-ink)]" : "text-slate-400"
                }`}
              >
                {t}
                {count !== null && count > 0 && (
                  <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${tab === t ? "bg-[image:var(--sd-gradient)] text-white" : "bg-slate-100 text-slate-500"}`}>
                    {count}
                  </span>
                )}
                {tab === t && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[image:var(--sd-gradient)]" />}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "Overview" && (
        <>
          <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <p className="mb-3 text-sm font-semibold text-slate-800">Next Steps</p>
            {studentTasks.length === 0 ? (
              <p className="text-sm text-slate-400">No open action items for {student.name}.</p>
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
                        {t.subtitle && <p className="truncate text-[11.5px] text-slate-400">{t.subtitle}</p>}
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
              <Detail label="Agent" value={agent ? `${agent.name} · ${agent.organization}` : "No agent assigned"} />
              <Detail label="Risk status" value={student.riskFlag && student.riskFlag !== "none" ? (student.riskFlag === "high" ? "High risk" : "Watchlist") : "No flags"} />
            </div>
            <p className="mt-3 rounded-xl bg-slate-50 px-4 py-3 text-[13px] leading-relaxed text-slate-600">
              {activeApps.length === 0
                ? "No active applications yet."
                : `${activeApps.length} active application${activeApps.length === 1 ? "" : "s"}, averaging ${avgProgress}% progress. ` +
                  `${totalMissing} document${totalMissing === 1 ? "" : "s"} outstanding across their case. ` +
                  (primary ? `Most urgent: ${primary.university} — ${primary.nextAction}.` : "")}
            </p>
          </div>

          <div className="mt-4">
            <ProfileStepsPanel studentId={student.id} editable />
          </div>
        </>
      )}

      {tab === "Applications" && (
        <div className="mt-4 space-y-3">
          {/* Application list — numbered oldest (#1) to most recent, since progress/status change
              constantly and would reshuffle numbers based on anything else. */}
          <div className="flex justify-end">
            <Button onClick={() => setNewAppOpen(true)}>
              <Plus size={14} /> New application
            </Button>
          </div>
          {apps.length === 0 && (
            <p className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-[12.5px] text-slate-400">
              No applications yet for {student.name}.
              </p>
            )}
            {sortByCreatedAscending(apps).map((a, appIndex) => {
            const university = UNIVERSITIES.find((u) => u.name === a.university);
            const docs = [...DOCUMENTS.filter((d) => d.studentId === student.id && d.applicationId === a.id), ...loadUploadedDocs(a.id)];
            const checklist = buildChecklist(university, student.id, a.id, docs);
            const customTypes = loadCustomDocRequests(a.id).map((r) => r.type);
            const statusHistory = [...getStatusHistory(a.id)].reverse();
            const uploadHistory = [...docs].sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt));
            const nextSteps = loadNextSteps(a.id);
            const expanded = expandedAppId === a.id;
            const journey = loadJourney(a.id);
            // The application's own responsibleCounsellorId/responsibleAdmissionOfficerId fields
            // (set by assignCounsellor/assignAdmissionOfficer in applicationsStore.ts) are the
            // actual source of truth — journey.stages.application.data never gets written to by
            // that flow, so reading from there always showed "Unassigned" regardless of what was
            // actually assigned.
            const assignedCounsellor = COUNSELLORS.find((c) => c.id === a.responsibleCounsellorId);
            const assignedAdmissionOfficer = ADMISSION_OFFICERS.find((o) => o.id === a.responsibleAdmissionOfficerId);
            return (
              <div key={a.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                <button
                  onClick={() => {
                    toggleExpandedApp(a.id);
                    setRequestDocType(""); setRequestDocDue("");
                    setNextStepDraft(""); setNextStepDue("");
                    if (!expanded) markSeenByCounsellor(a.id);
                  }}
                  className="flex w-full flex-col gap-3 p-4 text-left sm:flex-row sm:items-center"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span
                      title="Order applied — #1 is the oldest application"
                      className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[11px] font-semibold text-slate-500"
                    >
                      {appIndex + 1}
                    </span>
                    <LogoBadge name={safeText(a.university)} tone={university?.tone ?? "violet"} logoUrl={university?.logoUrl} className="h-10 w-10 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-slate-800">{safeText(a.university)}</p>
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-slate-500">
                          {formatApplicationId(a.id)}
                        </span>
                        {a.source === "student" && !isSeenByCounsellor(a.id) && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <Sparkles size={10} /> New
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-400">{safeText(a.course)} · {safeText(a.intake)} · {safeText(a.campus) === "—" ? "Main Campus" : a.campus} · {safeText(a.country)}</p>
                      <p className="mt-0.5 truncate text-[11px] text-slate-400">
                        Counsellor: <span className={assignedCounsellor ? "font-medium text-slate-600" : ""}>{assignedCounsellor?.name ?? "Unassigned"}</span>
                        {" · "}Admission: <span className={assignedAdmissionOfficer ? "font-medium text-slate-600" : ""}>{assignedAdmissionOfficer?.name ?? "Unassigned"}</span>
                      </p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0 sm:items-center">
                    <span
                      title="Automatically derived from the journey stage below — update the journey to change this."
                      className="cursor-default rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5 text-[11.5px] font-medium text-slate-600"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {a.status}
                    </span>
                    <div className="flex w-28 items-center gap-2">
                      <ProgressBar value={a.progress} size="sm" />
                      <span className="shrink-0 text-[11px] text-slate-400">{a.progress}%</span>
                    </div>
                    {expanded ? <ChevronUp size={16} className="hidden shrink-0 text-slate-300 sm:block" /> : <ChevronDown size={16} className="hidden shrink-0 text-slate-300 sm:block" />}
                  </div>
                </button>

                {/* Every stage's status, at a glance, without expanding the card. */}
                <div className="border-t border-slate-100 px-4 py-4">
                  <JourneyStageGrid
                    journey={journey}
                    onViewDetails={expanded ? undefined : () => { toggleExpandedApp(a.id); markSeenByCounsellor(a.id); }}
                  />
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3 lg:gap-0 lg:divide-x lg:divide-slate-200">
                      {/* Column 1 — Documents */}
                      <div className="space-y-3 lg:pr-4">
                        <ColumnHeader icon={FileCheck2} label="Documents" tone="bg-blue-500" />
                        <div className="space-y-1.5">
                          {checklist.map((r) => (
                            <ApplicationChecklistCard
                              key={r.type}
                              row={r}
                              canVerify
                              onVerify={(id) => { verifyAppDoc(id); forceTick((t) => t + 1); }}
                              onReject={(id, reason) => { rejectAppDoc(id, reason); forceTick((t) => t + 1); }}
                              onUpload={(file) => {
                                addUploadedDoc(a.id, r.type, file);
                                forceTick((t) => t + 1);
                              }}
                              onRemoveRequest={
                                !r.own && !r.reused && customTypes.includes(r.type)
                                  ? () => { removeCustomDocRequest(a.id, r.type); forceTick((t) => t + 1); }
                                  : undefined
                              }
                            />
                          ))}
                          {checklist.length === 0 && <p className="text-[12.5px] text-slate-400">No checklist items for this application.</p>}
                        </div>

                        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-3">
                          <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                            <Plus size={13} /> Request a document
                          </p>
                          <div className="space-y-2">
                            <input
                              value={requestDocType}
                              onChange={(e) => setRequestDocType(e.target.value)}
                              placeholder="e.g. Bank Guarantee Letter"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-[var(--sd-ink)] focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <input
                                type="date"
                                value={requestDocDue}
                                onChange={(e) => setRequestDocDue(e.target.value)}
                                aria-label="Requested document due date"
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] text-slate-700 focus:border-[var(--sd-ink)] focus:outline-none"
                              />
                              <button
                                onClick={() => {
                                  if (!requestDocType.trim()) return;
                                  addCustomDocRequest(a.id, requestDocType);
                                  if (requestDocDue) setDocDueDate(a.id, requestDocType.trim(), requestDocDue);
                                  setRequestDocType("");
                                  setRequestDocDue("");
                                  forceTick((t) => t + 1);
                                }}
                                disabled={!requestDocType.trim()}
                                className="shrink-0 rounded-lg bg-[image:var(--sd-gradient)] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-400">Notifies the student and their agent, and appears on the student's Documents tab.</p>
                        </div>
                      </div>

                      {/* Column 2 — Status (the 9-stage journey + responsible staff) */}
                      <div className="space-y-3 lg:px-4">
                        <ColumnHeader icon={Layers} label="Status" tone="bg-violet-500" />
                        <JourneyStepper journey={journey} showStrip={false} />
                        <ResponsibleStaffCard
                          applicationId={a.id}
                          responsibleCounsellorId={a.responsibleCounsellorId}
                          responsibleAdmissionOfficerId={a.responsibleAdmissionOfficerId}
                          agentName={agent?.name}
                          actor={actor}
                          onChanged={() => forceTick((t) => t + 1)}
                        />
                        <JourneyStageEditor
                          journey={journey}
                          onPatch={(stageType, patch) => {
                            if (actor) updateStage(a.id, stageType, patch, actor, token ?? undefined);
                            forceTick((t) => t + 1);
                          }}
                          readOnly={!actor}
                        />
                      </div>

                      {/* Column 3 — Tasks (scoped to this application) */}
                      <div className="space-y-3 lg:pl-4">
                        <ColumnHeader icon={ListChecks} label="Tasks" tone="bg-emerald-500" />
                        <ApplicationTasksCard applicationId={a.id} />

                        <div className="rounded-xl border border-slate-100 bg-white p-3">
                          <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Next steps</p>
                          {nextSteps.length > 0 && (
                            <div className="mb-2.5 space-y-1.5">
                              {nextSteps.map((ns) => {
                                const tone = stepDueTone(ns.dueDate, ns.done);
                                const dueClass = tone === "overdue" ? "text-rose-600" : tone === "soon" ? "text-amber-600" : "text-slate-400";
                                return (
                                  <div key={ns.id} className="flex flex-wrap items-center gap-2">
                                    <button
                                      onClick={() => { if (!ns.done) { toggleNextStepDone(a.id, ns.id); forceTick((t) => t + 1); } }}
                                      disabled={ns.done}
                                      aria-label={ns.done ? `"${ns.title}" completed — locked` : `Mark "${ns.title}" done`}
                                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                        ns.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                                      }`}
                                    >
                                      {ns.done && <Check size={11} />}
                                    </button>
                                    <span className={`flex-1 text-[12.5px] ${ns.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{ns.title}</span>
                                    {ns.done ? (
                                      ns.completedAt && (
                                        <span className="shrink-0 text-[10.5px] text-slate-400">
                                          Completed {new Date(`${ns.completedAt}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}
                                        </span>
                                      )
                                    ) : (
                                      <>
                                        <span className="flex shrink-0 items-center gap-1">
                                          <CalendarDays size={11} className={dueClass} />
                                          <input
                                            type="date"
                                            value={ns.dueDate ?? ""}
                                            onChange={(e) => { setNextStepDueDate(a.id, ns.id, e.target.value); forceTick((t) => t + 1); }}
                                            aria-label={`Due date for "${ns.title}"`}
                                            className={`rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] ${dueClass}`}
                                          />
                                        </span>
                                        <button
                                          onClick={() => { removeNextStep(a.id, ns.id); forceTick((t) => t + 1); }}
                                          aria-label={`Remove step "${ns.title}"`}
                                          className="shrink-0 text-slate-300 hover:text-slate-500"
                                        >
                                          <X size={12} />
                                        </button>
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                          <div className="space-y-2">
                            <input
                              value={nextStepDraft}
                              onChange={(e) => setNextStepDraft(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key !== "Enter" || !nextStepDraft.trim()) return;
                                addNextStep(a.id, nextStepDraft, nextStepDue);
                                setNextStepDraft("");
                                setNextStepDue("");
                                forceTick((t) => t + 1);
                              }}
                              placeholder="e.g. Book visa biometrics appointment"
                              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-[var(--sd-ink)] focus:outline-none"
                            />
                            <div className="flex gap-2">
                              <input
                                type="date"
                                value={nextStepDue}
                                onChange={(e) => setNextStepDue(e.target.value)}
                                aria-label="Next step due date"
                                className="min-w-0 flex-1 rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] text-slate-700 focus:border-[var(--sd-ink)] focus:outline-none"
                              />
                              <button
                                onClick={() => {
                                  if (!nextStepDraft.trim()) return;
                                  addNextStep(a.id, nextStepDraft, nextStepDue);
                                  setNextStepDraft("");
                                  setNextStepDue("");
                                  forceTick((t) => t + 1);
                                }}
                                disabled={!nextStepDraft.trim()}
                                className="shrink-0 rounded-lg bg-[image:var(--sd-gradient)] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-400">Also appears on your To Do List until checked off.</p>
                        </div>
                      </div>
                    </div>

                    {/* History — full width below the columns */}
                    <div className="mt-4 border-t border-slate-200 pt-4">
                      <div className="mb-2">
                        <ColumnHeader icon={History} label="History" tone="bg-amber-500" />
                      </div>
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <ApplicationActivityCard applicationId={a.id} />

                        <div className="rounded-xl border border-slate-100 bg-white p-3">
                          <p className="mb-2 text-xs font-semibold text-slate-600">Status history</p>
                          <div className="space-y-2">
                            {statusHistory.map((h, i) => (
                              <div key={`${h.status}-${h.changedAt}-${i}`} className="flex items-center gap-2 text-[12px]">
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i === 0 ? "bg-[image:var(--sd-gradient)]" : "bg-slate-300"}`} />
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {newAppOpen && (
        <NewApplicationModal
          student={student}
          onClose={() => setNewAppOpen(false)}
          onCreated={() => forceTick((t) => t + 1)}
        />
      )}

      {tab === "Documents" && (
        <div className="mt-4 space-y-5">
          {/* Same three status sections as the student's own My Documents page — core vault plus
              every active application, flattened, so a counsellor doesn't have to open each
              application separately to see what's still outstanding. Pending review leads here
              (unlike the student's page) since reviewing what's already been submitted is the
              counsellor's own most immediate action item. */}
          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-amber-100 text-amber-600">
                <Clock3 size={13} />
              </span>
              <p className="text-sm font-semibold text-slate-800">Pending review</p>
              <span className="ml-auto shrink-0 rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-semibold text-amber-700">
                {pendingDocRows.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {pendingDocRows.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing awaiting review.</p>
              ) : (
                pendingDocRows.map(renderDocRow)
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-rose-100 text-rose-600">
                <AlertCircle size={13} />
              </span>
              <p className="text-sm font-semibold text-slate-800">Required — not uploaded yet</p>
              <span className="ml-auto shrink-0 rounded-full bg-rose-100 px-2 py-0.5 text-[11px] font-semibold text-rose-600">
                {requiredDocRows.length}
              </span>
            </div>
            {academicProfileIncomplete(student.id) && (
              <p className="mb-3 rounded-xl bg-slate-50 px-3 py-2 text-[11.5px] leading-relaxed text-slate-500">
                {student.name}'s academic profile isn't fully filled in yet, so this list may not cover every
                document they actually need — use "Add a document type" below for anything missing from it.
              </p>
            )}
            <div className="space-y-1.5">
              {requiredDocRows.length === 0 && <p className="text-sm text-slate-400">Nothing required right now.</p>}
              {requiredDocRows.map(renderDocRow)}
              <AddCoreDocumentButton
                studentId={student.id}
                existingTypes={coreRows.map((r) => r.type)}
                onAdded={() => forceTick((t) => t + 1)}
              />
            </div>
          </section>

          <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <div className="mb-3 flex items-center gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-600">
                <CheckCircle2 size={13} />
              </span>
              <p className="text-sm font-semibold text-slate-800">Uploaded &amp; verified</p>
              <span className="ml-auto shrink-0 rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">
                {verifiedDocRows.length}
              </span>
            </div>
            <div className="space-y-1.5">
              {verifiedDocRows.length === 0 ? (
                <p className="text-sm text-slate-400">Nothing verified yet.</p>
              ) : (
                verifiedDocRows.map(renderDocRow)
              )}
            </div>
          </section>

          {extraDocsAcrossApps.length > 0 && (
            <section className="rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
              <p className="mb-3 text-sm font-semibold text-slate-800">Other documents on file</p>
              <div className="space-y-1.5">
                {extraDocsAcrossApps.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12.5px] font-medium text-slate-700">{d.name}</p>
                      <p className="text-[11px] text-slate-400">{d.type}</p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {tab === "Comments" && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <p className="mb-3 text-sm font-semibold text-slate-800">Case comments</p>
          <p className="mb-3 text-xs text-slate-400">Visible to and postable by this student, their counsellor and their agent — posting notifies each of their inboxes.</p>
          <StudentCommentsCard studentId={student.id} />
        </div>
      )}
    </div>
  );
}

function NewApplicationModal({
  student, onClose, onCreated,
}: { student: Student; onClose: () => void; onCreated: () => void }) {
  const UNIVERSITIES = getAllUniversities();
  const [country, setCountry] = useState(UNIVERSITIES[0]?.country ?? "");
  const universitiesInCountry = UNIVERSITIES.filter((u) => u.country === country);
  const [universityId, setUniversityId] = useState(universitiesInCountry[0]?.id ?? "");
  const university = UNIVERSITIES.find((u) => u.id === universityId);
  const openCourses = university?.courses.filter((c) => courseHasOpenIntake(university, c)) ?? [];
  const [courseName, setCourseName] = useState(firstOpenCourse(university)?.name ?? "");
  const course = university?.courses.find((c) => c.name === courseName);
  const campuses = university && course ? campusesFor(university, course.feeUSD) : [];
  const [campus, setCampus] = useState(campuses[0]?.name ?? "");
  const openIntakes = university && course ? openIntakesFor(university, course) : [];
  const [intake, setIntake] = useState(openIntakes[0] ?? "");
  const canSubmit = !!university && !!course && courseHasOpenIntake(university, course) && !!campus && !!intake;

  return (
    <Modal title={`New application for ${student.name}`} onClose={onClose}>
      <div className="space-y-3">
        <label className="block text-xs font-medium text-slate-500">
          Country
          <select
            value={country}
            onChange={(e) => {
              const v = e.target.value;
              setCountry(v);
              const inCountry = UNIVERSITIES.filter((u) => u.country === v);
              const u = inCountry[0];
              setUniversityId(u?.id ?? "");
              const c = firstOpenCourse(u);
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c.feeUSD) : [])[0]?.name ?? "");
              setIntake((u && c ? openIntakesFor(u, c) : [])[0] ?? "");
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          >
            {destinationOptions().map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          University
          <select
            value={universityId}
            onChange={(e) => {
              const v = e.target.value;
              setUniversityId(v);
              const u = UNIVERSITIES.find((x) => x.id === v);
              const c = firstOpenCourse(u);
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c.feeUSD) : [])[0]?.name ?? "");
              setIntake((u && c ? openIntakesFor(u, c) : [])[0] ?? "");
            }}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          >
            {universitiesInCountry.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </label>
        {university && (
          <label className="block text-xs font-medium text-slate-500">
            Subject
            <SearchableSelect
              value={courseName}
              onChange={(v) => {
                setCourseName(v);
                const c = university.courses.find((x) => x.name === v);
                setCampus((c ? campusesFor(university, c.feeUSD) : [])[0]?.name ?? "");
                setIntake((c ? openIntakesFor(university, c) : [])[0] ?? "");
              }}
              options={openCourses.map((c) => c.name)}
              placeholder="Search subjects…"
            />
            {openCourses.length === 0 && (
              <p className="mt-1 text-[11px] font-normal text-rose-500">No courses at this university currently have an open intake.</p>
            )}
          </label>
        )}
        <label className="block text-xs font-medium text-slate-500">
          Campus
          <select
            value={campus}
            onChange={(e) => setCampus(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          >
            {campuses.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </label>
        <label className="block text-xs font-medium text-slate-500">
          Intake
          <select
            value={intake}
            onChange={(e) => setIntake(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800"
          >
            {openIntakes.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          {openIntakes.length === 0 && <p className="mt-1 text-[11px] font-normal text-rose-500">This course has no open intake right now.</p>}
        </label>
        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={async () => {
            if (!university) return;
            await createApplication({ studentId: student.id, university: university.name, course: courseName, intake, country: university.country, campus });
            onCreated();
            onClose();
          }}
        >
          Create application
        </Button>
      </div>
    </Modal>
  );
}
