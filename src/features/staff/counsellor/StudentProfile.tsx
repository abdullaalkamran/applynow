import { useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router-dom";
import {
  ArrowLeft, Check, ChevronDown, ChevronUp, FileCheck2, FileText, Copy, AlertCircle, Upload, Plus, X, History, ListChecks, CalendarDays,
  User, GraduationCap, Languages, Briefcase, SlidersHorizontal, Sparkles,
} from "lucide-react";
import { Badge, Button, ProgressBar, Modal, SearchableSelect } from "../../../components/ui";
import { LogoBadge } from "../../../components/ui/mobile";
import { UNIVERSITIES, DOCUMENTS, AGENTS } from "../../../data/mockData";
import { getAllApplications, updateApplicationStatus, getStatusHistory, createApplication } from "../../../data/applicationsStore";
import { loadUploadedDocs, addUploadedDoc } from "../../../data/applicationDocsStore";
import { buildChecklist, buildCoreChecklist, type ChecklistRow } from "../../../utils/documentChecklist";
import { loadStaffNote, saveStaffNote } from "../../../data/staffNotesStore";
import { activeApplicationsFor } from "../../../utils/counsellorData";
import { loadAssignedStudents } from "../../../data/counsellorStudentsStore";
import { getProfileCompletion } from "../../../data/profileCompletion";
import { loadAcademicLevels } from "../../../data/academicProfileStore";
import { loadPersonalInfo, loadEnglishTests, loadWorkExperience, loadPreferences } from "../../../data/studentProfileDetailsStore";
import { ALL_APP_STATUSES } from "../../../utils/applicationStatus";
import { formatStudentId, formatApplicationId } from "../../../utils/displayId";
import { DESTINATION_OPTIONS, campusesFor } from "../../../utils/universityFilter";
import { loadCustomDocRequests, addCustomDocRequest, removeCustomDocRequest } from "../../../data/customDocRequestsStore";
import {
  loadNextSteps, addNextStep, toggleNextStepDone, removeNextStep, setNextStepDueDate, dueDateTone as stepDueTone,
} from "../../../data/applicationNextStepsStore";
import { loadDocDueDate, setDocDueDate, dueDateTone as docDueTone } from "../../../data/documentDueDatesStore";
import { isSeenByCounsellor, markSeenByCounsellor } from "../../../data/counsellorSeenApplicationsStore";
import type { Student, AppStatus } from "../../../types";

const RISK_TONE: Record<NonNullable<Student["riskFlag"]>, "amber" | "red"> = { watch: "amber", high: "red", none: "amber" };

const STEP_ICON: Record<string, typeof User> = {
  "personal-information": User,
  "academic-details": GraduationCap,
  "english-proficiency": Languages,
  "work-experience": Briefcase,
  "preferences": SlidersHorizontal,
};

const TABS = ["Overview", "Applications", "Documents", "Notes"] as const;
type Tab = (typeof TABS)[number];

function daysAgo(dateStr: string): string {
  const days = Math.max(0, Math.round((Date.now() - new Date(dateStr).getTime()) / 86_400_000));
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  return `${days} days ago`;
}

export default function StudentProfile() {
  const navigate = useNavigate();
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

  // Profile completion and academic history are tracked per student (seeded for the assigned
  // caseload, empty for anyone genuinely new — e.g. just added via "Add New Student") rather than
  // only ever reflecting whichever student happens to be signed into the student app.
  const completion = getProfileCompletion(student.id);
  const academicLevels = loadAcademicLevels(student.id);
  const personalInfo = loadPersonalInfo(student.id);
  const englishTests = loadEnglishTests(student.id);
  const workExperience = loadWorkExperience(student.id);
  const preferences = loadPreferences(student.id);
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

          <div className="mt-4 rounded-2xl border border-slate-100 bg-white shadow-[0_0_10px_rgba(0,0,0,0.06)]">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-3.5">
              <p className="text-sm font-semibold text-slate-800">Profile</p>
              <span className="text-xs font-medium text-slate-400">{completion.percent}% complete</span>
            </div>
            <div className="divide-y divide-slate-50">
              {completion.steps.map((s) => {
                const Icon = STEP_ICON[s.key] ?? User;
                return (
                  <div key={s.key} className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${s.complete ? "bg-[#E1F5F0] text-[#0F8A78]" : "bg-slate-100 text-slate-400"}`}>
                        <Icon size={14} />
                      </div>
                      <p className="flex-1 text-sm text-slate-700">{s.label}</p>
                      {s.complete ? (
                        <span className="flex items-center gap-1 text-xs font-medium text-emerald-600">
                          <Check size={12} /> Complete
                        </span>
                      ) : (
                        <span className="text-xs text-slate-300">{s.required ? "Required · pending" : "Not started"}</span>
                      )}
                    </div>

                    {s.key === "personal-information" && (
                      personalInfo ? (
                        <div className="ml-11 mt-2.5 space-y-3">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                            <Detail label="First name" value={personalInfo.firstName} />
                            <Detail label="Last name" value={personalInfo.lastName} />
                            <Detail label="Email" value={personalInfo.email} />
                            <Detail label="Phone" value={personalInfo.phone} />
                            <Detail label="Date of birth" value={personalInfo.dob} />
                            <Detail label="Gender" value={personalInfo.gender} />
                            <Detail label="Nationality" value={personalInfo.nationality} />
                            <Detail label="Marital status" value={personalInfo.maritalStatus} />
                            <Detail label="Place of birth" value={personalInfo.placeOfBirth} />
                            <Detail label="Father's name" value={personalInfo.fatherName} />
                            <Detail label="Mother's name" value={personalInfo.motherName} />
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                            <Detail label="Passport number" value={personalInfo.passportNumber} />
                            <Detail label="Personal number" value={personalInfo.personalNumber} />
                            <Detail label="Previous passport no." value={personalInfo.previousPassportNumber || "—"} />
                            <Detail label="Issuing authority" value={personalInfo.issuingAuthority} />
                            <Detail label="Issue date" value={personalInfo.issueDate} />
                            <Detail label="Expiry date" value={personalInfo.passportExpiry} />
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                            <Detail label="Permanent address" value={personalInfo.permanentAddress} />
                            <Detail label="Present address" value={personalInfo.presentAddress} />
                            <Detail label="City" value={personalInfo.city} />
                            <Detail label="Country" value={personalInfo.country} />
                          </div>
                          <div className="grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                            <Detail label="Emergency contact" value={personalInfo.emergencyContactName} />
                            <Detail label="Relationship" value={personalInfo.emergencyContactRelationship} />
                            <Detail label="Contact phone" value={personalInfo.emergencyContactPhone} />
                            <Detail label="Contact email" value={personalInfo.emergencyContactEmail || "—"} />
                            <Detail label="Contact address" value={personalInfo.emergencyContactAddress} />
                          </div>
                        </div>
                      ) : (
                        <p className="ml-11 mt-1.5 text-xs text-slate-400">Not yet submitted.</p>
                      )
                    )}

                    {s.key === "academic-details" && (
                      academicLevels.length > 0 ? (
                        <div className="ml-11 mt-2.5 space-y-1.5">
                          {academicLevels.map((lvl) => (
                            <div key={lvl.level} className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-3">
                              <Detail label="Level" value={lvl.level} />
                              <Detail label="Institution" value={lvl.institution} />
                              <Detail label="Board" value={lvl.board || "—"} />
                              <Detail label="Group" value={lvl.group || "—"} />
                              <Detail label="Major" value={lvl.major || "—"} />
                              <Detail label="Grade" value={lvl.grade || "—"} />
                              <Detail label="Passing year" value={lvl.passingYear || "—"} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="ml-11 mt-1.5 text-xs text-slate-400">No education history recorded yet.</p>
                      )
                    )}

                    {s.key === "english-proficiency" && (
                      englishTests.length > 0 ? (
                        <div className="ml-11 mt-2.5 space-y-1.5">
                          {englishTests.map((t, i) => (
                            <div key={`${t.testName}-${i}`} className="grid grid-cols-2 gap-x-4 gap-y-1 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
                              <Detail label="Test" value={t.testName} />
                              <Detail label="Test type" value={t.testType || "—"} />
                              <Detail label="Overall score" value={t.overallScore} />
                              <Detail label="Listening" value={t.listening || "—"} />
                              <Detail label="Reading" value={t.reading || "—"} />
                              <Detail label="Writing" value={t.writing || "—"} />
                              <Detail label="Speaking" value={t.speaking || "—"} />
                              <Detail label="Test date" value={t.testDate} />
                              <Detail label="Expiry" value={t.expiryDate || "No expiry"} />
                              <Detail label="Report number" value={t.reportNumber || "—"} />
                              <Detail label="Issuing institution" value={t.issuingInstitution || "—"} />
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="ml-11 mt-1.5 text-xs text-slate-400">Not yet submitted.</p>
                      )
                    )}

                    {s.key === "work-experience" && (
                      workExperience.length > 0 ? (
                        <div className="ml-11 mt-2.5 space-y-1.5">
                          {workExperience.map((w, i) => (
                            <div key={`${w.company}-${i}`} className="rounded-xl bg-slate-50 p-3 text-xs">
                              <div className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-4">
                                <Detail label="Type" value={w.type} />
                                <Detail label="Company" value={w.company} />
                                <Detail label="Title" value={w.title} />
                                <Detail label="Industry" value={w.industry} />
                                <Detail label="Start date" value={w.startDate} />
                                <Detail label="End date" value={w.currentlyWorking ? "Present" : w.endDate || "—"} />
                              </div>
                              {w.description && <p className="mt-2 text-slate-500">{w.description}</p>}
                            </div>
                          ))}
                        </div>
                      ) : (
                        <p className="ml-11 mt-1.5 text-xs text-slate-400">Not yet submitted.</p>
                      )
                    )}

                    {s.key === "preferences" && (
                      preferences ? (
                        <div className="ml-11 mt-2.5 grid grid-cols-2 gap-x-4 gap-y-2 rounded-xl bg-slate-50 p-3 text-xs sm:grid-cols-4">
                          <Detail label="Study level" value={preferences.studyLevel} />
                          <Detail label="Intake" value={preferences.intake} />
                          <Detail label="Budget" value={preferences.budget} />
                          <Detail label="Accommodation" value={preferences.accommodation} />
                          <Detail label="Destinations" value={preferences.destinations.join(", ")} />
                          <Detail label="Fields of interest" value={preferences.fields.join(", ")} />
                          <Detail label="Scholarship interest" value={preferences.scholarshipInterest ? "Yes" : "No"} />
                          <Detail label="Contact language" value={preferences.contactLanguage} />
                          <Detail
                            label="Notification channels"
                            value={[
                              preferences.emailUpdates && "Email",
                              preferences.smsUpdates && "SMS",
                              preferences.whatsappUpdates && "WhatsApp",
                              preferences.pushUpdates && "Push",
                            ].filter(Boolean).join(", ") || "None"}
                          />
                        </div>
                      ) : (
                        <p className="ml-11 mt-1.5 text-xs text-slate-400">Not yet submitted.</p>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </>
      )}

      {tab === "Applications" && (
        <div className="mt-4 space-y-3">
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
          {apps.map((a) => {
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
                    <LogoBadge name={a.university} tone={university?.tone ?? "violet"} className="h-10 w-10 shrink-0" />
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5">
                        <p className="truncate text-sm font-semibold text-slate-800">{a.university}</p>
                        <span className="shrink-0 rounded-full bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] font-semibold tracking-wide text-slate-500">
                          {formatApplicationId(a.id)}
                        </span>
                        {a.source === "student" && !isSeenByCounsellor(a.id) && (
                          <span className="flex shrink-0 items-center gap-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
                            <Sparkles size={10} /> New
                          </span>
                        )}
                      </div>
                      <p className="truncate text-xs text-slate-400">{a.course} · {a.intake} · {a.campus ?? "Main Campus"}</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3 sm:flex sm:shrink-0 sm:items-center">
                    <select
                      value={a.status}
                      onClick={(e) => e.stopPropagation()}
                      onChange={(e) => {
                        updateApplicationStatus(a.id, e.target.value as AppStatus);
                        forceTick((t) => t + 1);
                      }}
                      className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[11.5px] font-medium text-slate-700"
                    >
                      {ALL_APP_STATUSES.map((st) => (
                        <option key={st} value={st}>{st}</option>
                      ))}
                    </select>
                    <div className="flex w-28 items-center gap-2">
                      <ProgressBar value={a.progress} size="sm" />
                      <span className="shrink-0 text-[11px] text-slate-400">{a.progress}%</span>
                    </div>
                    {expanded ? <ChevronUp size={16} className="hidden shrink-0 text-slate-300 sm:block" /> : <ChevronDown size={16} className="hidden shrink-0 text-slate-300 sm:block" />}
                  </div>
                </button>

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
                          dueDate={loadDocDueDate(a.id, r.type)}
                          onSetDueDate={(date) => { setDocDueDate(a.id, r.type, date); forceTick((t) => t + 1); }}
                          onUpload={(file) => {
                            const isImage = file.type.startsWith("image/");
                            addUploadedDoc(a.id, r.type, isImage ? URL.createObjectURL(file) : undefined);
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

                    <div className="mt-3 rounded-xl border border-slate-100 bg-white p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <ListChecks size={13} /> Next steps
                      </p>
                      {nextSteps.length > 0 && (
                        <div className="mb-2.5 space-y-1.5">
                          {nextSteps.map((ns) => {
                            const tone = stepDueTone(ns.dueDate, ns.done);
                            const dueClass = tone === "overdue" ? "text-rose-600" : tone === "soon" ? "text-amber-600" : "text-slate-400";
                            return (
                              <div key={ns.id} className="flex flex-wrap items-center gap-2.5">
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
                                <span className="shrink-0 text-[11px] text-slate-400">{ns.createdAt}</span>
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
                      <div className="flex flex-col gap-2 sm:flex-row">
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
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-[var(--sd-ink)] focus:outline-none"
                        />
                        <input
                          type="date"
                          value={nextStepDue}
                          onChange={(e) => setNextStepDue(e.target.value)}
                          aria-label="Next step due date"
                          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] text-slate-700 focus:border-[var(--sd-ink)] focus:outline-none"
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
                          Add step
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">Also appears on your To Do List until checked off.</p>
                    </div>

                    <div className="mt-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                        <Plus size={13} /> Request a document from the student
                      </p>
                      <div className="flex flex-col gap-2 sm:flex-row">
                        <input
                          value={requestDocType}
                          onChange={(e) => setRequestDocType(e.target.value)}
                          placeholder="e.g. Bank Guarantee Letter"
                          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-2 text-[13px] text-slate-700 placeholder:text-slate-400 focus:border-[var(--sd-ink)] focus:outline-none"
                        />
                        <input
                          type="date"
                          value={requestDocDue}
                          onChange={(e) => setRequestDocDue(e.target.value)}
                          aria-label="Requested document due date"
                          className="shrink-0 rounded-lg border border-slate-200 px-2.5 py-2 text-[12.5px] text-slate-700 focus:border-[var(--sd-ink)] focus:outline-none"
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
                          Add to checklist
                        </button>
                      </div>
                      <p className="mt-1.5 text-[11px] text-slate-400">
                        Appears immediately on the student's own Documents tab for this application, with an upload option.
                      </p>
                    </div>

                    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
                      <div className="rounded-xl border border-slate-100 bg-white p-3">
                        <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                          <History size={13} /> Status history
                        </p>
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

/** Read-only variant of the same own/reused/missing states the student's own Documents and
 * Application Detail pages use (DocChecklistRow), so a counsellor sees the identical picture. */
function ChecklistCard({ row }: { row: ChecklistRow }) {
  if (row.own) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-white p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#E7EEFC] text-[#2955C4]">
          <FileText size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
          <p className="truncate text-[11px] text-slate-400">{row.own.name}</p>
        </div>
        <span className="shrink-0 text-[11px] font-medium capitalize text-emerald-600">{row.own.status}</span>
      </div>
    );
  }
  if (row.reused) {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-[#B9E2D4] bg-[#EAF9F2] p-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#12805A]/10 text-[#12805A]">
          <Copy size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
          <p className="truncate text-[11px] text-[#12805A]">Reused from {row.reused.sourceUniversity ?? "a previous application"}</p>
        </div>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 rounded-xl border border-dashed border-slate-300 bg-white p-3">
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-100 text-slate-400">
        <AlertCircle size={14} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
        <p className="text-[11px] text-slate-400">Not uploaded yet</p>
      </div>
    </div>
  );
}

/** Same own/reused states as ChecklistCard, but a "Missing" item gets a real upload control — a
 * counsellor can supply a required document on the student's behalf directly from here, using the
 * exact same store the student's own upload flow writes to. */
function ApplicationChecklistCard({
  row, onUpload, onRemoveRequest, dueDate, onSetDueDate,
}: {
  row: ChecklistRow; onUpload: (file: File) => void; onRemoveRequest?: () => void;
  dueDate?: string; onSetDueDate: (date: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);

  if (row.own || row.reused) {
    return <ChecklistCard row={row} />;
  }

  const tone = docDueTone(dueDate);
  const dueClass = tone === "overdue" ? "text-rose-600" : tone === "soon" ? "text-amber-600" : "text-slate-500";

  return (
    <div className="rounded-xl border border-dashed border-amber-300 bg-amber-50/40 p-3">
      <div className="flex items-center gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-100 text-amber-600">
          <AlertCircle size={14} />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[12.5px] font-medium text-slate-800">{row.type}</p>
          <p className="text-[11px] text-slate-400">Required — not uploaded yet</p>
        </div>
        {onRemoveRequest && (
          <button onClick={onRemoveRequest} aria-label={`Remove request for ${row.type}`} className="shrink-0 text-slate-300 hover:text-slate-500">
            <X size={13} />
          </button>
        )}
        <button
          onClick={() => inputRef.current?.click()}
          className="flex shrink-0 items-center gap-1 rounded-lg bg-[var(--sd-ink)] px-2.5 py-1.5 text-[11px] font-semibold text-white"
        >
          <Upload size={11} /> Upload
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*,.pdf"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) onUpload(file);
            e.target.value = "";
          }}
        />
      </div>
      <div className="mt-2 flex items-center gap-1.5 pl-11">
        <CalendarDays size={11} className={dueClass} />
        <label className={`text-[10.5px] font-medium ${dueClass}`}>
          {tone === "overdue" ? "Overdue" : tone === "soon" ? "Due soon" : "Due"}
        </label>
        <input
          type="date"
          value={dueDate ?? ""}
          onChange={(e) => onSetDueDate(e.target.value)}
          className={`rounded-md border border-slate-200 bg-white px-1.5 py-0.5 text-[10.5px] ${dueClass}`}
        />
      </div>
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-0.5 font-medium text-slate-700">{value}</p>
    </div>
  );
}

function NewApplicationModal({
  student, onClose, onCreated,
}: { student: Student; onClose: () => void; onCreated: () => void }) {
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
            {DESTINATION_OPTIONS.map((d) => (
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
