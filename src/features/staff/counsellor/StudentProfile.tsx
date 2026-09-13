import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Check, ChevronDown, ChevronUp, FileCheck2, FileText, Plus, X, History, ListChecks, CalendarDays,
  Sparkles, ClipboardList, Layers, type LucideIcon,
} from "lucide-react";
import { Badge, Button, ProgressBar, Modal, SearchableSelect } from "../../../components/ui";
import { LogoBadge } from "../../../components/ui/mobile";
import { ProfileStepsPanel, Detail } from "../../../components/ProfileStepsPanel";
import { ChecklistCard } from "../../../components/ChecklistCard";
import { ApplicationChecklistCard } from "../../../components/ApplicationChecklistCard";
import { DocViewButton } from "../../../components/DocViewButton";
import { DOCUMENTS, AGENTS } from "../../../data/mockData";
import { getAllUniversities } from "../../../data/universityCatalogStore";
import { getAllApplications, getStatusHistory, createApplication, sortByCreatedAscending } from "../../../data/applicationsStore";
import { loadUploadedDocs, addUploadedDoc } from "../../../data/applicationDocsStore";
import { buildChecklist, buildCoreChecklist } from "../../../utils/documentChecklist";
import { loadStaffNote, saveStaffNote } from "../../../data/staffNotesStore";
import { activeApplicationsFor, daysAgo } from "../../../utils/counsellorData";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { formatStudentId, formatApplicationId } from "../../../utils/displayId";
import { destinationOptions, campusesFor } from "../../../utils/universityFilter";
import { loadCustomDocRequests, addCustomDocRequest, removeCustomDocRequest } from "../../../data/customDocRequestsStore";
import {
  loadNextSteps, addNextStep, toggleNextStepDone, removeNextStep, setNextStepDueDate, dueDateTone as stepDueTone,
} from "../../../data/applicationNextStepsStore";
import { loadDocDueDate, setDocDueDate } from "../../../data/documentDueDatesStore";
import { isSeenByCounsellor, markSeenByCounsellor } from "../../../data/counsellorSeenApplicationsStore";
import {
  StageStatusStrip, JourneyStepper, JourneyStageEditor, ResponsibleStaffCard, ApplicationTasksCard, ApplicationActivityCard,
} from "../../../components/ApplicationJourneyPanel";
import { useAuth } from "../../../context/AuthContext";
import { loadJourney, updateStage } from "../../../data/applicationJourneyStore";
import type { Student } from "../../../types";

const RISK_TONE: Record<NonNullable<Student["riskFlag"]>, "amber" | "red"> = { watch: "amber", high: "red", none: "amber" };

// Defensive display fallback — a handful of applications created before create_application's
// university/course validation was added stored the literal string "undefined" (not a real JS
// `undefined`, which React would just skip rendering). Shows a plain dash instead of that text
// wherever an application field turns out to be missing or corrupted.
function safeText(value: string | undefined | null): string {
  if (!value || value === "undefined" || value === "null") return "—";
  return value;
}

const TABS = ["Overview", "Applications", "Documents", "Notes"] as const;

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
  const navigate = useNavigate();
  const { user } = useAuth();
  const actor = user ? { id: user.roleUserId, role: user.role, name: user.name } : undefined;
  const UNIVERSITIES = getAllUniversities();
  const { id } = useParams();
  const location = useLocation();
  const navState = location.state as { tab?: Tab; appId?: string } | null;
  const student = loadAssignedStudents().find((s) => s.id === id) ?? null;
  const [tab, setTab] = useState<Tab>(navState?.tab ?? "Overview");
  const [expandedAppId, setExpandedAppId] = useState<string | null>(navState?.appId ?? null);
  const [requestDocType, setRequestDocType] = useState("");
  const [requestDocDue, setRequestDocDue] = useState("");
  const [nextStepDraft, setNextStepDraft] = useState("");
  const [nextStepDue, setNextStepDue] = useState("");
  const [newAppOpen, setNewAppOpen] = useState(false);
  const [, forceTick] = useState(0);
  const [note, setNote] = useState(() => (id ? loadStaffNote(id) : ""));
  const [saved, setSaved] = useState(false);
  const savedTimeoutRef = useRef<number | null>(null);

  if (!student) {
    return (
      <div>
        <button onClick={() => navigate("/staff/counsellor/students")} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-[#2955C4]">
          <ArrowLeft size={14} /> Back to My Students
        </button>
        <p className="text-sm text-slate-400">Student not found.</p>
      </div>
    );
  }

  const apps = getAllApplications().filter((a) => a.studentId === student.id);
  const activeApps = activeApplicationsFor(student.id);
  const primary = [...activeApps].sort((a, b) => b.progress - a.progress)[0];
  const avgProgress = activeApps.length ? Math.round(activeApps.reduce((s, a) => s + a.progress, 0) / activeApps.length) : 0;
  const coreMissing = buildCoreChecklist(student.id).filter((r) => !r.own);
  const perAppMissingCount = activeApps.reduce((sum, a) => {
    const uni = UNIVERSITIES.find((u) => u.name === a.university);
    if (!uni) return sum;
    const docs = [...DOCUMENTS.filter((d) => d.studentId === student.id && d.applicationId === a.id), ...loadUploadedDocs(a.id)];
    return sum + buildChecklist(uni, student.id, a.id, docs).filter((r) => !r.own && !r.reused).length;
  }, 0);
  const totalMissing = coreMissing.length + perAppMissingCount;

  const agent = student.agentId ? AGENTS.find((a) => a.id === student.agentId) : undefined;

  function handleSaveNote() {
    saveStaffNote(student!.id, note);
    setSaved(true);
    if (savedTimeoutRef.current) window.clearTimeout(savedTimeoutRef.current);
    savedTimeoutRef.current = window.setTimeout(() => setSaved(false), 2500);
  }

  return (
    <div className="max-w-5xl">
      <button onClick={() => navigate("/staff/counsellor/students")} className="mb-4 flex items-center gap-1.5 text-sm font-medium text-[#2955C4]">
        <ArrowLeft size={14} /> Back to My Students
      </button>

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
                onClick={() => setTab(t)}
                className={`relative flex shrink-0 items-center gap-1.5 whitespace-nowrap pb-3 text-[13px] font-medium transition ${
                  tab === t ? "text-[var(--sd-ink)]" : "text-slate-400"
                }`}
              >
                {t}
                {count !== null && count > 0 && (
                  <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${tab === t ? "bg-[var(--sd-ink)] text-white" : "bg-slate-100 text-slate-500"}`}>
                    {count}
                  </span>
                )}
                {tab === t && <span className="absolute inset-x-0 -bottom-px h-[2px] rounded-full bg-[var(--sd-ink)]" />}
              </button>
            );
          })}
        </div>
      </div>

      {tab === "Overview" && (
        <>
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
            <ProfileStepsPanel studentId={student.id} />
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
            const docs = university
              ? [...DOCUMENTS.filter((d) => d.studentId === student.id && d.applicationId === a.id), ...loadUploadedDocs(a.id)]
              : [];
            const checklist = university ? buildChecklist(university, student.id, a.id, docs) : [];
            const customTypes = loadCustomDocRequests(a.id).map((r) => r.type);
            const statusHistory = [...getStatusHistory(a.id)].reverse();
            const uploadHistory = [...docs].sort((x, y) => y.uploadedAt.localeCompare(x.uploadedAt));
            const nextSteps = loadNextSteps(a.id);
            const expanded = expandedAppId === a.id;
            const journey = loadJourney(a.id);
            return (
              <div key={a.id} className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
                <button
                  onClick={() => {
                    setExpandedAppId(expanded ? null : a.id);
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
                    <LogoBadge name={safeText(a.university)} tone={university?.tone ?? "violet"} className="h-10 w-10 shrink-0" />
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
                      <p className="truncate text-xs text-slate-400">{safeText(a.course)} · {safeText(a.intake)} · {safeText(a.campus) === "—" ? "Main Campus" : a.campus}</p>
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
                <div className="border-t border-slate-100 px-4 py-2.5">
                  <StageStatusStrip journey={journey} dense />
                </div>

                {expanded && (
                  <div className="border-t border-slate-100 bg-slate-50/60 p-4">
                    <div className="grid grid-cols-1 gap-4 lg:grid-cols-4 lg:gap-0 lg:divide-x lg:divide-slate-200">
                      {/* Column 1 — Application */}
                      <div className="space-y-3 lg:pr-4">
                        <ColumnHeader icon={ClipboardList} label="Application" tone="bg-slate-500" />
                        <div className="grid grid-cols-2 gap-x-3 gap-y-2 rounded-xl border border-slate-100 bg-white p-3 text-xs">
                          <Detail label="Country" value={a.country} />
                          <Detail label="Waiting on" value={a.waitingOn} />
                          <Detail label="Updated" value={daysAgo(a.updatedAt)} />
                          <Detail label="Next action" value={a.nextAction} />
                        </div>
                        <ResponsibleStaffCard applicationId={a.id} journey={journey} actor={actor} onChanged={() => forceTick((t) => t + 1)} />
                      </div>

                      {/* Column 2 — Documents */}
                      <div className="space-y-3 lg:px-4">
                        <ColumnHeader icon={FileCheck2} label="Documents" tone="bg-blue-500" />
                        <div className="space-y-1.5">
                          {checklist.map((r) => (
                            <ApplicationChecklistCard
                              key={r.type}
                              row={r}
                              dueDate={loadDocDueDate(a.id, r.type)}
                              onSetDueDate={(date) => { setDocDueDate(a.id, r.type, date); forceTick((t) => t + 1); }}
                              onUpload={(file) => {
                                addUploadedDoc(a.id, r.type, URL.createObjectURL(file));
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
                                className="shrink-0 rounded-lg bg-[var(--sd-ink)] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
                              >
                                Add
                              </button>
                            </div>
                          </div>
                          <p className="mt-1.5 text-[11px] text-slate-400">Appears on the student's Documents tab immediately.</p>
                        </div>
                      </div>

                      {/* Column 3 — Status (the 9-stage journey) */}
                      <div className="space-y-3 lg:px-4">
                        <ColumnHeader icon={Layers} label="Status" tone="bg-violet-500" />
                        <JourneyStepper journey={journey} showStrip={false} />
                        <JourneyStageEditor
                          journey={journey}
                          onPatch={(stageType, patch) => {
                            if (actor) updateStage(a.id, stageType, patch, actor);
                            forceTick((t) => t + 1);
                          }}
                          readOnly={!actor}
                        />
                      </div>

                      {/* Column 4 — Tasks (scoped to this application) */}
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
                                      onClick={() => { toggleNextStepDone(a.id, ns.id); forceTick((t) => t + 1); }}
                                      aria-label={ns.done ? `Mark "${ns.title}" not done` : `Mark "${ns.title}" done`}
                                      className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border ${
                                        ns.done ? "border-emerald-500 bg-emerald-500 text-white" : "border-slate-300"
                                      }`}
                                    >
                                      {ns.done && <Check size={11} />}
                                    </button>
                                    <span className={`flex-1 text-[12.5px] ${ns.done ? "text-slate-400 line-through" : "text-slate-700"}`}>{ns.title}</span>
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
                                className="shrink-0 rounded-lg bg-[var(--sd-ink)] px-3.5 py-2 text-[12.5px] font-semibold text-white disabled:opacity-40"
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
                                <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${i === 0 ? "bg-[var(--sd-ink)]" : "bg-slate-300"}`} />
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
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <p className="mb-3 text-sm font-semibold text-slate-800">Core documents still missing</p>
          {coreMissing.length === 0 ? (
            <p className="text-sm text-slate-400">All core documents have been provided.</p>
          ) : (
            <div className="space-y-1.5">
              {coreMissing.map((r) => (
                <ChecklistCard key={r.type} row={r} />
              ))}
            </div>
          )}
        </div>
      )}

      {tab === "Notes" && (
        <div className="mt-4 rounded-2xl border border-slate-100 bg-white p-5 shadow-[0_0_10px_rgba(0,0,0,0.06)]">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-800">Case notes</p>
            {saved && (
              <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                <Check size={13} /> Saved
              </span>
            )}
          </div>
          <textarea
            value={note}
            onChange={(e) => { setNote(e.target.value); setSaved(false); }}
            rows={6}
            placeholder="Private notes about this student's case — visible only to staff…"
            className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3.5 py-2.5 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[var(--sd-ink)] focus:outline-none"
          />
          <Button onClick={handleSaveNote} className="mt-2.5">Save note</Button>
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
  const [courseName, setCourseName] = useState(university?.courses[0]?.name ?? "");
  const course = university?.courses.find((c) => c.name === courseName);
  const campuses = university && course ? campusesFor(university, course.feeUSD) : [];
  const [campus, setCampus] = useState(campuses[0]?.name ?? "");
  const [intake, setIntake] = useState(university?.intakes[0] ?? "");
  const canSubmit = !!university && !!courseName && !!campus && !!intake;

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
              const c = u?.courses[0];
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c.feeUSD) : [])[0]?.name ?? "");
              setIntake(u?.intakes[0] ?? "");
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
              const c = u?.courses[0];
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c.feeUSD) : [])[0]?.name ?? "");
              setIntake(u?.intakes[0] ?? "");
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
              }}
              options={university.courses.map((c) => c.name)}
              placeholder="Search subjects…"
            />
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
            {(university?.intakes ?? []).map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </label>
        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={() => {
            if (!university) return;
            createApplication({ studentId: student.id, university: university.name, course: courseName, intake, country: university.country, campus });
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
