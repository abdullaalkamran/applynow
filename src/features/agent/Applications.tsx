import { useRef, useState, useEffect, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search, FileText, Plus, Clock, FolderOpen, FileCheck2, PlaneTakeoff, CheckCircle2,
  MoreVertical, Copy, Check, ChevronLeft, ChevronRight, ListChecks, AlertCircle, CalendarDays, Upload,
} from "lucide-react";
import { StatusBadge, FilterMenu, Button } from "../../components/ui";
import { LogoBadge } from "../../components/ui/mobile";
import { loadAgentStudents } from "../../data/agentStudentsStore";
import { getAllApplications } from "../../data/applicationsStore";
import { loadUploadedDocs, addUploadedDoc } from "../../data/applicationDocsStore";
import { loadDocDueDate } from "../../data/documentDueDatesStore";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { DOCUMENTS } from "../../data/mockData";
import { buildChecklist, buildCoreChecklist } from "../../utils/documentChecklist";
import { formatStudentId, formatApplicationId } from "../../utils/displayId";
import { pipelineBucketFor, CLOSED_STATUSES, daysAgo, type PipelineBucket } from "../../utils/counsellorData";
import { loadOpenNextStepsFor } from "../../utils/agentNextSteps";
import { CreateApplicationModal } from "./CreateApplicationModal";

const BUCKET_TABS: (PipelineBucket | "All")[] = ["All", "Documents", "Under Review", "Offer Received", "Visa Process", "Enrolled"];
const PAGE_SIZE = 8;

export default function AgentApplications() {
  const navigate = useNavigate();
  const UNIVERSITIES = getAllUniversities();
  const students = loadAgentStudents();
  const [tab, setTab] = useState<(typeof BUCKET_TABS)[number]>("All");
  const [countryTab, setCountryTab] = useState<string>("All");
  const [intakeTab, setIntakeTab] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(1);
  const [createOpen, setCreateOpen] = useState(false);
  const [, forceTick] = useState(0);

  const rows = students.flatMap((s) =>
    getAllApplications()
      .filter((a) => a.studentId === s.id && !CLOSED_STATUSES.has(a.status))
      .map((a) => ({ student: s, app: a }))
  );
  const openSteps = loadOpenNextStepsFor(students, rows.map((r) => r.app));

  const countryTabs = ["All", ...Array.from(new Set(rows.map(({ app }) => app.country))).sort()];
  const intakeTabs = ["All", ...Array.from(new Set(rows.map(({ app }) => app.intake))).sort()];

  const filtered = rows.filter(({ student, app }) => {
    if (tab !== "All" && pipelineBucketFor(app.status) !== tab) return false;
    if (countryTab !== "All" && app.country !== countryTab) return false;
    if (intakeTab !== "All" && app.intake !== intakeTab) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    return (
      student.name.toLowerCase().includes(q) ||
      app.university.toLowerCase().includes(q) ||
      app.course.toLowerCase().includes(q) ||
      formatStudentId(student.id).toLowerCase().includes(q) ||
      formatApplicationId(app.id).toLowerCase().includes(q)
    );
  });

  const filterKey = `${tab}|${countryTab}|${intakeTab}|${query}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setPage(1);
  }

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const clampedPage = Math.min(page, totalPages);
  const paginated = filtered.slice((clampedPage - 1) * PAGE_SIZE, clampedPage * PAGE_SIZE);

  const counts: Record<(typeof BUCKET_TABS)[number], number> = {
    All: rows.length, Documents: 0, "Under Review": 0, "Offer Received": 0, "Visa Process": 0, Enrolled: 0,
  };
  rows.forEach(({ app }) => {
    const b = pipelineBucketFor(app.status);
    if (b) counts[b]++;
  });

  const countryCounts: Record<string, number> = { All: rows.length };
  rows.forEach(({ app }) => { countryCounts[app.country] = (countryCounts[app.country] ?? 0) + 1; });

  const intakeCounts: Record<string, number> = { All: rows.length };
  rows.forEach(({ app }) => { intakeCounts[app.intake] = (intakeCounts[app.intake] ?? 0) + 1; });

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
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-base font-semibold text-slate-900">Applications</h1>
          <p className="mt-1 text-xs text-slate-500">Track and manage every application across your students.</p>
        </div>
        <Button onClick={() => setCreateOpen(true)} className="shrink-0 text-xs px-3 py-1.5">
          <Plus size={13} /> Create Application
        </Button>
      </div>

      <div className="mb-4 -mx-1 flex items-center gap-1 overflow-x-auto border-b border-slate-100 px-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {BUCKET_TABS.map((t) => {
          const active = tab === t;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`relative flex shrink-0 items-center gap-1.5 px-2.5 py-2 text-xs font-medium transition ${
                active ? "text-blue-700" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {t}
              <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                active ? "bg-blue-100 text-blue-700" : "bg-slate-100 text-slate-500"
              }`}>
                {counts[t]}
              </span>
              {active && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-blue-600" />}
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
            placeholder="Search student, university, course, or ID…"
            className="w-full min-w-0 bg-transparent text-xs text-slate-700 placeholder:text-slate-400 focus:outline-none"
          />
        </div>
        <FilterMenu label="Country" value={countryTab} onChange={setCountryTab} options={countryTabs} counts={countryCounts} />
        <FilterMenu label="Intake" icon={<Clock size={13} className="text-slate-400" />} value={intakeTab} onChange={setIntakeTab} options={intakeTabs} counts={intakeCounts} />
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
          const university = UNIVERSITIES.find((u) => u.name === app.university);
          const openApplication = () => navigate(`/agent/students/${student.id}`, { state: { tab: "Applications", appId: app.id } });

          const docs = [...DOCUMENTS.filter((d) => d.studentId === student.id && d.applicationId === app.id), ...loadUploadedDocs(app.id)];
          const missingDocs = buildChecklist(university, student.id, app.id, docs).filter((r) => !r.own && !r.reused);
          // Core docs (Passport, Transcript, etc.) live in the student's own vault, uploaded once
          // and shared across every application — flagged here as a heads-up, resolving for every
          // role (student, counsellor, agent) the moment the student uploads it.
          const missingCoreDocs = buildCoreChecklist(student.id).filter((r) => !r.own);
          const appNextSteps = openSteps.filter((s) => s.applicationId === app.id);

          return (
            <div
              key={app.id}
              onClick={openApplication}
              className="cursor-pointer rounded-2xl border border-slate-100 bg-white p-4 shadow-[0_0_10px_rgba(0,0,0,0.05)] transition hover:border-slate-200 hover:shadow-[0_2px_14px_rgba(0,0,0,0.08)]"
            >
              <div className="flex items-start gap-3">
                <LogoBadge name={app.university} tone={university?.tone ?? "violet"} logoUrl={university?.logoUrl} className="h-10 w-10 shrink-0 text-xs" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-xs font-semibold text-slate-800">{app.university}</p>
                  <p className="truncate text-xs text-slate-500">{app.course}</p>
                </div>
                <RowMenu applicationId={app.id} onView={openApplication} />
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-slate-50 pt-3">
                <StatusBadge status={app.status} />
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
              </div>

              <p className="mt-2.5 truncate text-xs text-slate-400">
                <span className="text-slate-500">{app.nextAction}</span> · {daysAgo(app.updatedAt)}
              </p>

              {appNextSteps.slice(0, 1).map((s) => {
                const urgent = s.tone === "overdue";
                const dueClass = urgent ? "text-rose-600" : s.tone === "soon" ? "text-amber-600" : "text-slate-400";
                return (
                  <div key={s.id} className="mt-2 rounded-lg bg-slate-50 px-2.5 py-1.5 text-xs">
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

              {missingDocs.length > 0 && (
                <div className="mt-2 space-y-1.5">
                  {missingDocs.map((row) => {
                    const due = loadDocDueDate(app.id, row.type);
                    return (
                      <div key={row.type} className="flex items-center gap-2 rounded-lg bg-amber-50/60 px-2.5 py-1.5 text-xs">
                        <AlertCircle size={12} className="shrink-0 text-amber-500" />
                        <span className="min-w-0 flex-1 truncate text-slate-700">{row.type}</span>
                        {due && (
                          <span className="flex shrink-0 items-center gap-1 font-medium text-slate-400">
                            <CalendarDays size={10} /> {due}
                          </span>
                        )}
                        <label
                          onClick={(e) => e.stopPropagation()}
                          className="flex shrink-0 cursor-pointer items-center gap-1 rounded-full bg-slate-900 px-2 py-1 text-[10.5px] font-semibold text-white"
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
                <span className="flex h-6 min-w-[24px] items-center justify-center rounded-lg bg-blue-600 px-1.5 text-[11px] font-semibold text-white">
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
          students={students}
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

