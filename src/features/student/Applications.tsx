import { Logo } from "../../components/Logo";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Calendar, MapPin, ChevronRight, Plus, ListChecks, AlertCircle } from "lucide-react";
import { LogoBadge, Pill } from "../../components/ui/mobile";
import { CURRENT_STUDENT_ID } from "../../data/mockData";
import { getAllStudents } from "../../data/allStudentsStore";
import { getAllApplications } from "../../data/applicationsStore";
import { getAllUniversities } from "../../data/universityCatalogStore";
import { applicationStatusTone, applicationBucket as bucketOf } from "../../utils/applicationStatus";
import { loadNextSteps } from "../../data/applicationNextStepsStore";
import { buildCoreChecklist } from "../../utils/documentChecklist";
import { NeuTabs } from "../../components/ui/NeuTabs";

type Bucket = "all" | "inProgress" | "offer" | "completed";

const TAB_KEYS = ["all", "inProgress", "offer", "completed"] as const satisfies readonly Bucket[];
const TAB_LABELS: Record<Bucket, string> = { all: "All", inProgress: "In Progress", offer: "Offer", completed: "Completed" };

export default function Applications() {
  const navigate = useNavigate();
  const student = getAllStudents().find((s) => s.id === CURRENT_STUDENT_ID);
  const initials = student ? student.name.split(" ").map((n) => n[0]).slice(0, 2).join("") : "";
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
          <h1 className="sr-only">UnifinderAi</h1><Logo className="h-6" />
          <div className="flex items-center gap-2">
            <button
              onClick={() => navigate("/student/search")}
              aria-label="Search"
              className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--sd-card)] text-neutral-600 shadow-neu-sm"
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

        <h2 className="mt-4 text-[26px] font-bold leading-tight text-neutral-900">My Applications</h2>
        <p className="mt-1 text-[13px] text-neutral-500">Track and manage all your university applications in one place.</p>

        <NeuTabs tabs={TAB_KEYS} value={tab} onChange={setTab} labels={TAB_LABELS} counts={counts} ariaLabel="Application status" className="mt-4" />

        <div className="mt-4 grid grid-cols-1 gap-3 lg:grid-cols-2">
          {visible.map((app) => {
            const uni = universities.find((u) => u.name === app.university);
            const openSteps = loadNextSteps(app.id).filter((s) => !s.done);
            const nextStepText = coreDocsBlocked ? "Upload core documents" : openSteps[0]?.title ?? app.nextAction;
            return (
              <button
                key={app.id}
                onClick={() => navigate(`/student/applications/${app.id}`)}
                className="flex w-full items-start gap-3 rounded-2xl border border-transparent bg-[var(--sd-card)] p-4 text-left shadow-neu"
              >
                <LogoBadge name={app.university} tone={uni?.tone ?? "violet"} logoUrl={uni?.logoUrl} className="h-11 w-11 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-neutral-900">{app.university}</p>
                  <p className="truncate text-xs text-neutral-400">{app.course}</p>
                  <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500">
                    <span className="inline-flex items-center gap-1">
                      <Calendar size={11} className="text-neutral-400" /> {app.intake}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} className="text-neutral-400" /> {app.campus ?? "Main Campus"}
                    </span>
                  </div>
                  <p className="mt-1.5 flex items-center gap-1 truncate text-[11px] font-medium text-neutral-900">
                    {coreDocsBlocked ? <AlertCircle size={11} className="shrink-0 text-neutral-700" /> : <ListChecks size={11} className="shrink-0" />}
                    <span className="truncate">
                      Next: {nextStepText}
                      {!coreDocsBlocked && openSteps.length > 1 ? ` (+${openSteps.length - 1} more)` : ""}
                    </span>
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <ChevronRight size={16} className="text-neutral-300" />
                  <Pill tone={coreDocsBlocked ? "amber" : applicationStatusTone(app.status)}>
                    {coreDocsBlocked ? "Core docs needed" : app.status}
                  </Pill>
                </div>
              </button>
            );
          })}

          {visible.length === 0 && (
            <div className="rounded-2xl border border-transparent bg-[var(--sd-card)] p-6 text-center shadow-neu lg:col-span-full">
              <p className="text-sm font-medium text-neutral-700">No applications in this category yet</p>
            </div>
          )}
        </div>

        <button
          onClick={() => navigate("/student/search")}
          className="neu-hover mt-5 flex w-full items-center justify-center gap-2.5 rounded-2xl bg-[var(--sd-card)] py-4 text-[14px] font-semibold text-neutral-900 shadow-neu"
        >
          <Plus size={16} /> Add New Application
        </button>
      </div>
    </div>
  );
}
