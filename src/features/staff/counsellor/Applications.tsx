import { useState, type ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import { Search, FileText, Plus, Globe2, Sparkles } from "lucide-react";
import { StatusBadge, ProgressBar, Modal, Button, SearchableSelect } from "../../../components/ui";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { activeApplicationsFor, pipelineBucketFor, type PipelineBucket } from "../../../utils/counsellorData";
import { formatStudentId, formatApplicationId } from "../../../utils/displayId";
import { UNIVERSITIES } from "../../../data/mockData";
import { createApplication } from "../../../data/applicationsStore";
import { DESTINATION_OPTIONS, campusesFor } from "../../../utils/universityFilter";
import { isSeenByCounsellor, markSeenByCounsellor } from "../../../data/counsellorSeenApplicationsStore";
import type { Student } from "../../../types";

const BUCKET_TABS: (PipelineBucket | "All" | "New")[] = ["All", "New", "Documents", "Under Review", "Offer Received", "Visa Process", "Enrolled"];

function isNewSubmission(app: { source?: "student" | "counsellor"; id: string }): boolean {
  return app.source === "student" && !isSeenByCounsellor(app.id);
}

export default function CounsellorApplications() {
  const navigate = useNavigate();
  const assigned = loadAssignedStudents();
  const [tab, setTab] = useState<(typeof BUCKET_TABS)[number]>("All");
  const [countryTab, setCountryTab] = useState<string>("All");
  const [query, setQuery] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [, forceTick] = useState(0);

  const rows = assigned.flatMap((s) => activeApplicationsFor(s.id).map((a) => ({ student: s, app: a })));

  const countryTabs = ["All", ...Array.from(new Set(rows.map(({ app }) => app.country))).sort()];

  const filtered = rows.filter(({ student, app }) => {
    if (tab === "New") {
      if (!isNewSubmission(app)) return false;
    } else if (tab !== "All" && pipelineBucketFor(app.status) !== tab) return false;
    if (countryTab !== "All" && app.country !== countryTab) return false;
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

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Applications</h1>
          <p className="mt-1 text-sm text-slate-500">
            {rows.length} active application{rows.length === 1 ? "" : "s"} across your students.
            {counts.New > 0 && (
              <span className="ml-1.5 font-medium text-amber-600">{counts.New} new submission{counts.New === 1 ? "" : "s"} to check.</span>
            )}
          </p>
        </div>
        <Button onClick={() => setCreateOpen(true)}>
          <Plus size={14} /> Create application
        </Button>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2">
        {BUCKET_TABS.map((t) => {
          const isNewTab = t === "New";
          const highlight = isNewTab && counts.New > 0;
          return (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-xs font-medium transition ${
                tab === t
                  ? "bg-[var(--sd-ink)] text-white"
                  : highlight
                    ? "border border-amber-300 bg-amber-50 text-amber-700 hover:bg-amber-100"
                    : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
              }`}
            >
              {isNewTab && <Sparkles size={12} />}
              {t}
              <span
                className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${
                  tab === t ? "bg-white/20" : highlight ? "bg-amber-200 text-amber-800" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[t]}
              </span>
            </button>
          );
        })}
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
        <span className="mr-1 flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
          <Globe2 size={12} /> Country
        </span>
        {countryTabs.map((c) => (
          <button
            key={c}
            onClick={() => setCountryTab(c)}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium transition ${
              countryTab === c ? "bg-slate-800 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-50"
            }`}
          >
            {c}
            <span className={`flex h-4 min-w-[16px] items-center justify-center rounded-full px-1 text-[10px] ${countryTab === c ? "bg-white/20" : "bg-slate-100 text-slate-500"}`}>
              {countryCounts[c] ?? 0}
            </span>
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 max-w-sm">
        <Search size={14} className="text-slate-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search student, university, course, or ID…"
          className="w-full bg-transparent text-sm text-slate-700 placeholder:text-slate-400 focus:outline-none"
        />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-slate-100 text-xs uppercase tracking-wide text-slate-400">
                <th className="px-5 py-3 font-medium">Application ID</th>
                <th className="px-5 py-3 font-medium">Student</th>
                <th className="px-5 py-3 font-medium">University — Course</th>
                <th className="px-5 py-3 font-medium">Status</th>
                <th className="px-5 py-3 font-medium">Progress</th>
                <th className="px-5 py-3 font-medium">Next Action</th>
                <th className="px-5 py-3 font-medium" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.map(({ student, app }) => {
                const isNew = isNewSubmission(app);
                const openApplication = () => {
                  markSeenByCounsellor(app.id);
                  navigate(`/staff/counsellor/students/${student.id}`, { state: { tab: "Applications", appId: app.id } });
                };
                return (
                  <tr
                    key={app.id}
                    onClick={openApplication}
                    className={`cursor-pointer ${isNew ? "bg-amber-50/50 hover:bg-amber-50" : "hover:bg-slate-50"}`}
                  >
                    <td className="px-5 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wide text-slate-500">
                        {formatApplicationId(app.id)}
                      </span>
                    </td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-2.5">
                        <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold text-white ${student.avatarColor}`}>
                          {student.name.split(" ").map((n) => n[0]).slice(0, 2).join("")}
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-medium text-slate-800">{student.name}</p>
                          <p className="truncate font-mono text-[10.5px] text-slate-400">{formatStudentId(student.id)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3 text-slate-600">{app.university} — {app.course}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-1.5">
                        <StatusBadge status={app.status} />
                        {isNew && (
                          <span className="flex items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <Sparkles size={10} /> New
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-5 py-3" style={{ minWidth: 120 }}><ProgressBar value={app.progress} size="sm" /></td>
                    <td className="px-5 py-3 max-w-xs truncate text-slate-500">{app.nextAction}</td>
                    <td className="px-5 py-3">
                      <button
                        onClick={(e) => { e.stopPropagation(); openApplication(); }}
                        className="text-xs font-medium text-[#2955C4]"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {filtered.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-12 text-center">
            <FileText size={22} className="text-slate-300" />
            <p className="text-sm text-slate-400">No applications match this view.</p>
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

function CreateApplicationModal({
  students, onClose, onCreated,
}: { students: Student[]; onClose: () => void; onCreated: () => void }) {
  const [studentId, setStudentId] = useState(students[0]?.id ?? "");
  const [country, setCountry] = useState(UNIVERSITIES[0]?.country ?? "");
  const universitiesInCountry = UNIVERSITIES.filter((u) => u.country === country);
  const [universityId, setUniversityId] = useState(universitiesInCountry[0]?.id ?? "");
  const university = UNIVERSITIES.find((u) => u.id === universityId);
  const [courseName, setCourseName] = useState(university?.courses[0]?.name ?? "");
  const course = university?.courses.find((c) => c.name === courseName);
  const campuses = university && course ? campusesFor(university, course.feeUSD) : [];
  const [campus, setCampus] = useState(campuses[0]?.name ?? "");
  const [intake, setIntake] = useState(university?.intakes[0] ?? "");
  const student = students.find((s) => s.id === studentId);
  const canSubmit = !!student && !!university && !!courseName && !!campus && !!intake;

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
              const c = u?.courses[0];
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c.feeUSD) : [])[0]?.name ?? "");
              setIntake(u?.intakes[0] ?? "");
            }}
            className={SELECT_CLASS}
          >
            {DESTINATION_OPTIONS.map((d) => (
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
              const c = u?.courses[0];
              setCourseName(c?.name ?? "");
              setCampus((u && c ? campusesFor(u, c.feeUSD) : [])[0]?.name ?? "");
              setIntake(u?.intakes[0] ?? "");
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
                setCampus((c ? campusesFor(university, c.feeUSD) : [])[0]?.name ?? "");
              }}
              options={university.courses.map((c) => c.name)}
              placeholder="Search subjects…"
            />
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
            {(university?.intakes ?? []).map((i) => (
              <option key={i} value={i}>{i}</option>
            ))}
          </select>
        </Field>
        <Button
          className="w-full justify-center"
          disabled={!canSubmit}
          onClick={() => {
            if (!student || !university) return;
            createApplication({
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
