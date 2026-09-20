import { useRef, useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, FileText, Plus, Globe2, Sparkles, Users, ChevronRight, Clock, FolderOpen,
  FileCheck2, PlaneTakeoff, CheckCircle2, MoreVertical, Copy, Check, ChevronLeft, Briefcase,
  ListChecks, AlertCircle, CalendarDays, Upload,
} from "lucide-react";
import { StatusBadge, Modal, Button, SearchableSelect, FilterMenu, BackButton } from "../../../components/ui";
import { LogoBadge } from "../../../components/ui/mobile";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { activeApplicationsFor, pipelineBucketFor, daysAgo, type PipelineBucket } from "../../../utils/counsellorData";
import { formatStudentId, formatApplicationId } from "../../../utils/displayId";
import { AGENTS, DOCUMENTS } from "../../../data/mockData";
import { getAllUniversities } from "../../../data/universityCatalogStore";
import { createApplication, applicationSortKey } from "../../../data/applicationsStore";
import { destinationOptions, campusesFor, courseHasOpenIntake } from "../../../utils/universityFilter";
import { isSeenByCounsellor, markSeenByCounsellor } from "../../../data/counsellorSeenApplicationsStore";
import { buildChecklist, buildCoreChecklist } from "../../../utils/documentChecklist";
import { loadUploadedDocs, addUploadedDoc } from "../../../data/applicationDocsStore";
import { loadDocDueDate, dueDateTone as docDueTone } from "../../../data/documentDueDatesStore";
import { loadNextSteps, dueDateTone as stepDueTone } from "../../../data/applicationNextStepsStore";
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

const BUCKET_TABS: (PipelineBucket | "All" | "New")[] = ["All", "New", "Documents", "Under Review", "Offer Received", "Visa Process", "Enrolled"];
const SOURCE_CARDS = ["Agents", "Platform"] as const;
type SourceFilter = "All" | (typeof SOURCE_CARDS)[number];
const PAGE_SIZE = 8;

function isNewSubmission(app: { source?: "student" | "counsellor"; id: string }): boolean {
  return app.source === "student" && !isSeenByCounsellor(app.id);
}

export default function CounsellorApplications() {
  const navigate = useNavigate();
  const UNIVERSITIES = getAllUniversities();
  const assigned = loadAssignedStudents();
  const [tab, setTab] = useState<(typeof BUCKET_TABS)[number]>("All");
  const [countryTab, setCountryTab] = useState<string>("All");
  const [intakeTab, setIntakeTab] = useState<string>("All");
  const [sourceTab, setSourceTab] = useState<SourceFilter>("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [, forceTick] = useState(0);

  // Newest submission first, regardless of which student it belongs to — otherwise rows come out
  // grouped by `assigned`'s order with oldest-per-student first, burying anything just submitted.
  const rows = assigned
    .flatMap((s) => activeApplicationsFor(s.id).map((a) => ({ student: s, app: a })))
    .sort((a, b) => applicationSortKey(b.app) - applicationSortKey(a.app));

  const countryTabs = ["All", ...Array.from(new Set(rows.map(({ app }) => app.country))).sort()];
  const intakeTabs = ["All", ...Array.from(new Set(rows.map(({ app }) => app.intake))).sort()];

  const filtered = rows.filter(({ student, app }) => {
    if (tab === "New") {
      if (!isNewSubmission(app)) return false;
    } else if (tab !== "All" && pipelineBucketFor(app.status) !== tab) return false;
    if (countryTab !== "All" && app.country !== countryTab) return false;
    if (intakeTab !== "All" && app.intake !== intakeTab) return false;
    if (sourceTab === "Platform" && student.agentId) return false;
    if (sourceTab === "Agents" && !student.agentId) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const agent = student.agentId ? AGENTS.find((a) => a.id === student.agentId) : undefined;
    return (
      student.name.toLowerCase().includes(q) ||
      app.university.toLowerCase().includes(q) ||
      app.course.toLowerCase().includes(q) ||
      formatStudentId(student.id).toLowerCase().includes(q) ||
      formatApplicationId(app.id).toLowerCase().includes(q) ||
      (agent?.name.toLowerCase().includes(q) ?? false)
    );
  });

  const filterKey = `${tab}|${countryTab}|${intakeTab}|${sourceTab}|${query}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paginated = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const counts: Record<(typeof BUCKET_TABS)[number], number> = {
    All: rows.length, New: 0,
    Documents: 0, "Under Review": 0, "Offer Received": 0, "Visa Process": 0, Enrolled: 0,
  };
  rows.forEach(({ app }) => {
    const b = pipelineBucketFor(app.status);
    if (b) counts[b]++;
    if (isNewSubmission(app)) counts.New++;
  });

  const countryCounts: Record<string, number> = { All: rows.length };
  rows.forEach(({ app }) => { countryCounts[app.country] = (countryCounts[app.country] ?? 0) + 1; });

  const intakeCounts: Record<string, number> = { All: rows.length };
  rows.forEach(({ app }) => { intakeCounts[app.intake] = (intakeCounts[app.intake] ?? 0) + 1; });

  const sourceCounts: Record<SourceFilter, number> = { All: rows.length, Platform: 0, Agents: 0 };
  rows.forEach(({ student }) => {
    if (student.agentId) sourceCounts.Agents++;
    else sourceCounts.Platform++;
  });

  const statTiles: { key: PipelineBucket | "Total"; label: string; icon: ReactNode; tone: string }[] = [
    { key: "Total", label: "Total Applications", icon: <FileText size={14} />, tone: "bg-blue-50 text-blue-600" },
    { key: "Documents", label: "Documents", icon: <FolderOpen size={14} />, tone: "bg-teal-50 text-teal-600" },
    { key: "Under Review", label: "Under Review", icon: <Clock size={14} />, tone: "bg-amber-50 text-amber-600" },
    { key: "Offer Received", label: "Offer Received", icon: <FileCheck2 size={14} />, tone: "bg-violet-50 text-violet-600" },
    { key: "Visa Process", label: "Visa Process", icon: <PlaneTakeoff size={14} />, tone: "bg-sky-50 text-sky-600" },
    { key: "Enrolled", label: "Enrolled", icon: <CheckCircle2 size={14} />, tone: "bg-emerald-50 text-emerald-600" },
  ];

  return (
    <div>
      <BackButton fallback="/staff/counsellor" />
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold text-slate-900">Applications</h1>
          <p className="mt-1 text-xs text-slate-500">Manage and track all student applications in one place.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="text-xs px-3 py-1.5">
          <Plus size={13} /> Create Application
        </Button>
      </div>

      <div className="mb-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
        {SOURCE_CARDS.map((s) => {
          const active = sourceTab === s;
          return (
            <button
              key={s}
              onClick={() => setSourceTab(active ? "All" : s)}
              className={`flex items-center justify-between gap-3 rounded-2xl border-2 p-3.5 text-left transition ${
                active ? "border-[var(--sd-ink)] bg-[var(--sd-ink)]/[0.04]" : "border-slate-200 bg-white hover:border-slate-300"
              }`}
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${s === "Agents" ? "bg-blue-50 text-blue-600" : "bg-sky-50 text-sky-600"}`}>
                  {s === "Agents" ? <Users size={16} /> : <Globe2 size={16} />}
                </div>
                <div className="min-w-0">
                  <p className="text-[13px] font-semibold text-slate-900">From {s}</p>
                  <p className="truncate text-[11px] text-slate-500">
                    {s === "Agents" ? "Applications submitted by your agents" : "Applications from website / direct"}
                  </p>
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-1">
                <span className="text-lg font-bold text-slate-900">{sourceCounts[s]}</span>
                <ChevronRight size={14} className="text-slate-300" />
              </div>
            </button>
          );
        })}
      </div>

      <div className="mb-4 -mx-1 flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {BUCKET_TABS.map((t) => {
          const isNewTab = t === "New";
          const highlight = isNewTab && counts.New > 0;
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-xs font-medium transition ${
                active ? "text-[var(--sd-ink)]" : highlight ? "text-amber-600" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {isNewTab && <Sparkles size={12} />}
              {t}
              <span
                className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                  active ? "bg-[var(--sd-ink)]/10 text-[var(--sd-ink)]" : highlight ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[t]}
              </span>
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-[image:var(--sd-gradient)]" />}
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 sm:max-w-sm">
          <Search size={14} className="shrink-0 text-slate-400" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search student, university, course, agent, or ID…"
            className="w-full min-w-0 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <FilterMenu
          label="Country"
          icon={<Globe2 size={13} className="text-slate-400" />}
          value={countryTab}
          onChange={setCountryTab}
          options={countryTabs}
          counts={countryCounts}
        />
        <FilterMenu
          label="Intake"
          icon={<Clock size={13} className="text-slate-400" />}
          value={intakeTab}
          onChange={setIntakeTab}
          options={intakeTabs}
          counts={intakeCounts}
        />
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
        {statTiles.map((s) => (
          <div key={s.key} className="rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_0_10px_rgba(0,0,0,0.05)]">
            <div className={`flex h-7 w-7 items-center justify-center rounded-lg ${s.tone}`}>{s.icon}</div>
            <p className="mt-1.5 text-base font-bold text-slate-900">{s.key === "Total" ? rows.length : counts[s.key]}</p>
            <p className="text-[10px] text-slate-500">{s.label}</p>
          </div>
        ))}
      </div>

      <div className="space-y-2.5">
        {paginated.map(({ student, app }) => {
          const isNew = isNewSubmission(app);
          const university = UNIVERSITIES.find((u) => u.name === app.university);
          const agent = student.agentId ? AGENTS.find((a) => a.id === student.agentId) : undefined;
          const openApplication = () => {
            markSeenByCounsellor(app.id);
            navigate(`/staff/counsellor/students/${student.id}`, { state: { tab: "Applications", appId: app.id } });
          };

          const docs = [...DOCUMENTS.filter((d) => d.studentId === student.id && d.applicationId === app.id), ...loadUploadedDocs(app.id)];
          const missingDocs = buildChecklist(university, student.id, app.id, docs).filter((r) => !r.own && !r.reused);
          // Core docs (Passport, Transcript, etc.) are uploaded once via the student's own vault,
          // not per-application — surfaced here as a heads-up, not something a counsellor uploads
          // on the student's behalf. Resolves for every role the instant the student uploads it,
          // since buildCoreChecklist now reads the shared server-backed vault, not per-browser storage.
          const missingCoreDocs = buildCoreChecklist(student.id).filter((r) => !r.own);
          const openSteps = loadNextSteps(app.id).filter((s) => !s.done);
          const nextStep = openSteps[0];
          const nextStepTone = nextStep ? stepDueTone(nextStep.dueDate, nextStep.done) : "none";
          const nextStepClass = nextStepTone === "overdue" ? "text-rose-600" : nextStepTone === "soon" ? "text-amber-600" : "text-slate-400";

          return (
            <div
              key={app.id}
              onClick={openApplication}
              className={`cursor-pointer rounded-2xl border bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)] transition hover:border-slate-200 hover:shadow-[0_2px_14px_rgba(0,0,0,0.08)] ${
                isNew ? "border-amber-200 bg-amber-50/40" : "border-slate-100"
              }`}
            >
              <div className="flex items-start gap-3">
                <LogoBadge name={app.university} tone={university?.tone ?? "violet"} logoUrl={university?.logoUrl} className="h-10 w-10 shrink-0 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-800">{app.university}</p>
                  <p className="truncate text-xs text-slate-500">{app.course}</p>
                </div>
                <RowMenu applicationId={app.id} onView={openApplication} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-50 pt-3">
                <StatusBadge status={app.status} />
                {isNew && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9.5px] font-semibold text-amber-700">
                    <Sparkles size={9} /> New
                  </span>
                )}
                {missingCoreDocs.length > 0 && (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-rose-50 px-1.5 py-0.5 text-[9.5px] font-semibold text-rose-700">
                    <AlertCircle size={9} /> Core docs missing ({missingCoreDocs.length})
                  </span>
                )}
                <span className="flex min-w-0 items-center gap-1.5 text-xs text-slate-600">
                  <span className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[8.5px] font-semibold text-white ${student.avatarColor}`}>
                    {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                  </span>
                  <span className="truncate font-medium">{student.name}</span>
                  <span className="shrink-0 font-mono text-[10px] text-slate-400">{formatStudentId(student.id)}</span>
                </span>
                {agent ? (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700">
                    <Briefcase size={10} /> {agent.name}
                  </span>
                ) : (
                  <span className="flex shrink-0 items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-500">
                    <Globe2 size={10} /> Platform
                  </span>
                )}
              </div>

              <p className="mt-2.5 truncate text-xs text-slate-400">
                <span className="text-slate-500">{app.nextAction}</span> · {daysAgo(app.updatedAt)}
              </p>

              {nextStep && (
                <div className="mt-2 flex items-center gap-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
                  <ListChecks size={12} className="shrink-0 text-slate-400" />
                  <span className="min-w-0 flex-1 truncate text-slate-600">
                    Next: {nextStep.title}
                    {openSteps.length > 1 ? ` (+${openSteps.length - 1} more)` : ""}
                  </span>
                  {nextStep.dueDate && (
                    <span className={`flex shrink-0 items-center gap-1 font-medium ${nextStepClass}`}>
                      <CalendarDays size={11} /> {nextStep.dueDate}
                    </span>
                  )}
                </div>
              )}

              {missingDocs.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {missingDocs.map((row) => {
                    const due = loadDocDueDate(app.id, row.type);
                    const tone = docDueTone(due);
                    const dueClass = tone === "overdue" ? "text-rose-600" : tone === "soon" ? "text-amber-600" : "text-slate-400";
                    return (
                      <div key={row.type} className="flex items-center gap-2 rounded-lg bg-amber-50/60 px-2.5 py-1.5 text-xs">
                        <AlertCircle size={12} className="shrink-0 text-amber-500" />
                        <span className="min-w-0 flex-1 truncate text-slate-700">{row.type}</span>
                        {due && (
                          <span className={`flex shrink-0 items-center gap-1 font-medium ${dueClass}`}>
                            <CalendarDays size={10} /> {due}
                          </span>
                        )}
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-[image:var(--sd-gradient)] px-2 py-1 text-[10.5px] font-semibold text-white"
                        >
                          <Upload size={10} /> Upload
                          <input
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) {
                                addUploadedDoc(app.id, row.type, file);
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
            </div>
          );
        })}
      </div>

      <div className="mt-3 overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText size={20} className="text-slate-300" />
            <p className="text-xs text-slate-400">No applications match this view.</p>
          </div>
        )}
        {filtered.length > 0 && (
          <div className="flex items-center justify-between gap-3 px-5 py-2.5">
            <p className="text-[11px] text-slate-400">
              Showing {(clampedPage - 1) * PAGE_SIZE + 1}–{Math.min(clampedPage * PAGE_SIZE, filtered.length)} of {filtered.length} application{filtered.length === 1 ? "" : "s"}
            </p>
            {totalPages > 1 && (
              <div className="flex shrink-0 items-center gap-1.5">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={clampedPage === 1}
                  aria-label="Previous page"
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
                >
                  <ChevronLeft size={13} />
                </button>
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-[image:var(--sd-gradient)] px-1.5 text-[11px] font-semibold text-white">
                  {clampedPage}
                </span>
                <span className="text-[11px] text-slate-400">of {totalPages}</span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={clampedPage === totalPages}
                  aria-label="Next page"
                  className="flex h-6 w-6 items-center justify-center rounded-lg border border-slate-200 text-slate-500 disabled:opacity-40"
                >
                  <ChevronRight size={13} />
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {createOpen && (
        <CreateApplicationModal
          students={assigned}
          onClose={() => setCreateOpen(false)}
          onCreated={() => forceTick((t) => t + 1)}
        />
      )}
    </div>
  );
}

function RowMenu({ applicationId, onView }: { applicationId: string; onView: () => void }) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={(e) => { e.stopPropagation(); setOpen((v) => !v); }}
        aria-label="More actions"
        className="flex h-7 w-7 items-center justify-center rounded-lg text-slate-400 hover:bg-slate-100 hover:text-slate-600"
      >
        <MoreVertical size={15} />
      </button>
      {open && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="absolute right-0 z-20 mt-1 w-44 overflow-hidden rounded-xl border border-slate-200 bg-white py-1 shadow-lg"
        >
          <button
            onClick={() => { setOpen(false); onView(); }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
          >
            <FileText size={12} /> View application
          </button>
          <button
            onClick={() => {
              navigator.clipboard.writeText(formatApplicationId(applicationId)).catch(() => {});
              setCopied(true);
              window.setTimeout(() => setCopied(false), 1200);
            }}
            className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-700 hover:bg-slate-50"
          >
            {copied ? <Check size={12} className="text-emerald-600" /> : <Copy size={12} />}
            {copied ? "Copied!" : "Copy application ID"}
          </button>
        </div>
      )}
    </div>
  );
}

function CreateApplicationModal({
  students, onClose, onCreated,
}: { students: Student[]; onClose: () => void; onCreated: () => void }) {
  const UNIVERSITIES = getAllUniversities();
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [country, setCountry] = useState(UNIVERSITIES[0]?.country ?? "");
  const universitiesInCountry = UNIVERSITIES.filter((u) => u.country === country);
  const [universityId, setUniversityId] = useState(universitiesInCountry[0]?.id ?? "");
  const university = UNIVERSITIES.find((u) => u.id === universityId);
  const openCourses = university?.courses.filter((c) => courseHasOpenIntake(university, c)) ?? [];
  const [courseName, setCourseName] = useState(firstOpenCourse(university)?.name ?? "");
  const course = university?.courses.find((c) => c.name === courseName);
  const campuses = university && course ? campusesFor(university, course) : [];
  const [campus, setCampus] = useState(campuses[0]?.name ?? "");
  const openIntakes = university && course ? openIntakesFor(university, course) : [];
  const [intake, setIntake] = useState(openIntakes[0] ?? "");
  const student = students.find((s) => s.id === studentId);
  const canSubmit = !!student && !!university && !!course && courseHasOpenIntake(university, course) && !!campus && !!intake;

  return (
    <Modal title="Create application" onClose={onClose}>
      <div className="space-y-3">
        <Field label="Student">
          <select value={studentId} onChange={(e) => setStudentId(e.target.value)} className={SELECT_CLASS}>
            {students.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Country">
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
              setCampus((u && c ? campusesFor(u, c) : [])[0]?.name ?? "");
              setIntake((u && c ? openIntakesFor(u, c) : [])[0] ?? "");
            }}
            className={SELECT_CLASS}
          >
            {destinationOptions().map((d) => (
              <option key={d} value={d}>{d}</option>
            ))}
          </select>
        </Field>
        <Field label="University">
          <select
            value={universityId}
            onChange={(e) => {
              const v = e.target.value;
              setUniversityId(v);
              const u = UNIVERSITIES.find((x) => x.id === v);
              const c = firstOpenCourse(u);
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c) : [])[0]?.name ?? "");
              setIntake((u && c ? openIntakesFor(u, c) : [])[0] ?? "");
            }}
            className={SELECT_CLASS}
          >
            {universitiesInCountry.map((u) => (
              <option key={u.id} value={u.id}>{u.name}</option>
            ))}
          </select>
        </Field>
        {university && (
          <Field label="Subject">
            <SearchableSelect
              value={courseName}
              onChange={(v) => {
                setCourseName(v);
                const c = university.courses.find((x) => x.name === v);
                setCampus((c ? campusesFor(university, c) : [])[0]?.name ?? "");
                setIntake((c ? openIntakesFor(university, c) : [])[0] ?? "");
              }}
              options={openCourses.map((c) => c.name)}
              placeholder="Search subjects…"
            />
            {openCourses.length === 0 && (
              <p className="mt-1 text-[11px] text-rose-500">No courses at this university currently have an open intake.</p>
            )}
          </Field>
        )}
        <Field label="Campus">
          <select value={campus} onChange={(e) => setCampus(e.target.value)} className={SELECT_CLASS}>
            {campuses.map((c) => (
              <option key={c.name} value={c.name}>{c.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Intake">
          <select value={intake} onChange={(e) => setIntake(e.target.value)} className={SELECT_CLASS}>
            {openIntakes.map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
          {openIntakes.length === 0 && <p className="mt-1 text-[11px] text-rose-500">This course has no open intake right now.</p>}
        </Field>
        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={async () => {
            if (!student || !university) return;
            await createApplication({
              studentId: student.id, university: university.name, course: courseName,
              intake, country: university.country, campus,
            });
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

const SELECT_CLASS = "mt-1 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-800";

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-xs font-medium text-slate-500">
      {label}
      {children}
    </label>
  );
}
