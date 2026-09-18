import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, MapPin, ChevronRight, Plus, ListChecks, AlertCircle } from "lucide-react";
import { LogoBadge, Pill } from "../../components/ui/mobile";
import { CURRENT_STUDENT_ID, STUDENTS } from "../../data/mockData";
import { getAllApplications } from "../../data/applicationsStore";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { applicationStatusTone, applicationBucket as bucketOf } from "../../utils/applicationStatus";
import { loadNextSteps } from "../../data/applicationNextStepsStore";
import { buildCoreChecklist } from "../../utils/documentChecklist";

type Bucket = "all" | "inProgress" | "offer" | "completed";

const TABS: { key: Bucket; label: string }[] = [
  { key: "all", label: "All" },
  { key: "inProgress", label: "In Progress" },
  { key: "offer", label: "Offer" },
  { key: "completed", label: "Completed" },
];

export default function Applications() {
  const navigate = useNavigate();
  const student = STUDENTS.find((s) => s.id === CURRENT_STUDENT_ID)!;
  const initials = student.name.split(" ").map((n) => n[0]).slice(0, 2).join("");
  const [tab, setTab] = useState<Bucket>("all");
  const universities = getAllUniversities();
  const missingCoreDocs = buildCoreChecklist(CURRENT_STUDENT_ID).filter((row) => !row.own);
  const coreDocsBlocked = missingCoreDocs.length > 0;

  const applications = getAllApplications()
    .filter((a) => a.studentId === CURRENT_STUDENT_ID && !["Withdrawn", "Rejected", "Deferred"].includes(a.status))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));

  const counts: Record<Bucket, number> = {
    all: applications.length,
    inProgress: applications.filter((a) => bucketOf(a.status) === "inProgress").length,
    offer: applications.filter((a) => bucketOf(a.status) === "offer").length,
    completed: applications.filter((a) => bucketOf(a.status) === "completed").length,
  };

  const visible = tab === "all" ? applications : applications.filter((a) => bucketOf(a.status) === tab);

  return (
    <div className="px-5 pb-6 pt-6 lg:px-10 lg:pb-10 lg:pt-8">
      <div className="lg:mx-auto lg:max-w-4xl">
        <div className="flex items-center justify-between">
          <h1 className="text-[15px] font-bold text-slate-900">StudyOne</h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/student/search")}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-slate-600 shadow-[0_0_8px_rgba(0,0,0,0.07)]"
            >
              <Search size={16} />
            </button>
            <button
              onClick={() => navigate("/student/profile")}
              className="flex h-9 w-9 items-center justify-center overflow-hidden rounded-full bg-[image:var(--sd-gradient)] text-xs font-semibold text-white"
            >
              {initials}
            </button>
          </div>
        </div>

        <h2 className="mt-4 text-[26px] font-bold leading-tight text-slate-900">My Applications</h2>
        <p className="mt-1 text-[13px] text-slate-500">Track and manage all your university applications in one place.</p>

        <div className="mt-4 flex items-center gap-2 overflow-x-auto pb-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full px-3.5 py-2 text-[12.5px] font-medium transition-colors ${
                tab === t.key ? "bg-[image:var(--sd-gradient)] text-white" : "border border-slate-200 bg-[var(--sd-card)] text-slate-600"
              }`}
            >
              {t.label}
              <span
                className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] font-semibold ${
                  tab === t.key ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[t.key]}
              </span>
            </button>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((app) => {
            const uni = universities.find((u) => u.name === app.university);
            const openSteps = loadNextSteps(app.id).filter((s) => !s.done);
            const nextStepText = coreDocsBlocked ? "Upload core documents" : openSteps[0]?.title ?? app.nextAction;
            return (
              <button
                key={app.id}
                onClick={() => navigate(`/student/applications/${app.id}`)}
                className="flex w-full items-start gap-3 rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-4 text-left shadow-[0_0_10px_rgba(0,0,0,0.06)]"
              >
                <LogoBadge name={app.university} tone={uni?.tone ?? "violet"} logoUrl={uni?.logoUrl} className="h-11 w-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-slate-900">{app.university}</p>
                  <p className="truncate text-xs text-slate-400">{app.course}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} className="text-slate-400" /> {app.intake}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} className="text-slate-400" /> {app.campus ?? "Main Campus"}
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 truncate text-[11px] font-medium text-[#2955C4]">
                    {coreDocsBlocked ? <AlertCircle size={11} className="shrink-0 text-amber-600" /> : <ListChecks size={11} className="shrink-0" />}
                    <span className="truncate">
                      Next: {nextStepText}
                      {!coreDocsBlocked && openSteps.length > 1 ? ` (+${openSteps.length - 1} more)` : ""}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <ChevronRight size={16} className="text-slate-300" />
                  <Pill tone={coreDocsBlocked ? "amber" : applicationStatusTone(app.status)}>
                    {coreDocsBlocked ? "Core docs needed" : app.status}
                  </Pill>
                </div>
              </button>
            );
          })}

          {visible.length === 0 && (
            <div className="rounded-2xl border border-slate-100 bg-[var(--sd-card)] p-6 text-center shadow-[0_0_10px_rgba(0,0,0,0.06)] lg:col-span-full">
              <p className="text-sm font-medium text-slate-700">No applications in this category yet</p>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate("/student/search")}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl border border-dashed border-slate-300 bg-[var(--sd-card)]/60 py-4 text-[13px] font-medium text-slate-600"
        >
          <Plus size={16} /> Add New Application
        </button>
      </div>
    </div>
  );
}
